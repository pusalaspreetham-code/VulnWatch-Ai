const pool = require('../db');
const matchRepository = require('../repositories/match.repository');
const versionMatcherService = require('./version_matcher.service');
const ecosystemAdvisoryService = require('./ecosystem_advisory.service');

/**
 * Normalize a product name for comparison.
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true when two normalized product names match.
 * Handles canonical aliases for Python, Docker, Node.js, Apache, PHP, Ubuntu, etc.
 */
function namesMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;

  // Exact match
  if (na === nb) return true;

  // Python aliases
  const isPythonA = na === 'python' || na === 'python3' || na === 'cpython' || na.startsWith('python ');
  const isPythonB = nb === 'python' || nb === 'python3' || nb === 'cpython' || nb.startsWith('python ');
  if (isPythonA && isPythonB) return true;

  // Docker aliases
  const isDockerA = na.includes('docker') || na.includes('moby');
  const isDockerB = nb.includes('docker') || nb.includes('moby');
  if (isDockerA && isDockerB) return true;

  // Node.js aliases
  const isNodeA = na === 'node' || na === 'nodejs' || na === 'node js';
  const isNodeB = nb === 'node' || nb === 'nodejs' || nb === 'node js';
  if (isNodeA && isNodeB) return true;

  // PHP aliases
  if ((na === 'php' && nb.includes('php')) || (nb === 'php' && na.includes('php'))) return true;

  // Amazon Linux aliases
  if ((na.includes('amazon linux') && nb.includes('amazon linux')) ||
      (na.includes('amazon') && nb.includes('amazon linux')) ||
      (na.includes('al2023') && nb.includes('amazon linux'))) return true;

  // Apache aliases
  if ((na.includes('apache') && nb.includes('apache http server')) ||
      (nb.includes('apache') && na.includes('apache http server')) ||
      (na.includes('httpd') && nb.includes('apache'))) return true;

  // Ubuntu aliases
  if ((na.includes('ubuntu') && nb.includes('ubuntu')) ||
      (na.includes('canonical') && nb.includes('ubuntu'))) return true;

  // Containment (minimum 4 chars)
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }

  // First-word + shared tokens
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  if (wordsA[0] === wordsB[0] && wordsA[0].length >= 3) {
    const setA = new Set(wordsA);
    const shared = wordsB.filter((w) => setA.has(w) && w.length >= 3);
    if (shared.length >= 2) return true;
  }

  return false;
}

/**
 * Check if a product has an active advisory source configured (Vendor Feed OR OSV Ecosystem).
 */
function isFeedSupported(productName, vendor, ecosystem) {
  return ecosystemAdvisoryService.isCoverageSupported(productName, vendor, ecosystem);
}

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

function pickHighestSeverity(sevA, sevB) {
  const rA = SEVERITY_RANK[(sevA || '').toLowerCase()] || 0;
  const rB = SEVERITY_RANK[(sevB || '').toLowerCase()] || 0;
  return rA >= rB ? (sevA || 'Unknown') : (sevB || 'Unknown');
}

class MatcherService {
  /**
   * Run vulnerability matching for a user:
   * 1. Automatically queries live ecosystem advisory sources (e.g. OSV) for user's packages.
   * 2. Compares stack items to affected products in the advisories database.
   * 3. Evaluates installed version against affected version ranges & fixes.
   * 4. Upserts matches into PostgreSQL with accurate status & reason.
   */
  async runForUser(userId) {
    console.log(`[MATCHER] Running vulnerability detection for user #${userId}`);

    // 1. Load user's stack items
    const stackResult = await pool.query(
      `SELECT id, product_name, canonical_name, vendor, ecosystem, installed_version 
       FROM stack_items 
       WHERE user_id = $1`,
      [userId]
    );
    const stackItems = stackResult.rows;

    if (stackItems.length === 0) {
      console.log(`[MATCHER] User #${userId} has no stack items.`);
      return { matchesFound: 0, matchesNew: 0, matchesExisting: 0, stackItemsChecked: 0 };
    }

    // 2. Fetch/sync ecosystem advisories (e.g. OSV) for each stack item if applicable
    for (const si of stackItems) {
      const prodNameToSync = si.canonical_name || si.product_name;
      try {
        await ecosystemAdvisoryService.syncAdvisoriesForProduct(
          prodNameToSync,
          si.vendor,
          si.installed_version,
          si.ecosystem
        );
      } catch (syncErr) {
        console.warn(`[MATCHER SYNC] Advisory sync skipped for ${prodNameToSync}:`, syncErr.message);
      }
    }

    // 3. Load all affected products joined with advisory details
    const apResult = await pool.query(
      `SELECT ap.id, ap.product_name, ap.vendor, ap.advisory_id, ap.affected_versions_raw, ap.fixed_version,
              a.cve_id, a.title, a.severity
       FROM affected_products ap
       JOIN advisories a ON a.id = ap.advisory_id`
    );
    const affectedProducts = apResult.rows;

    if (affectedProducts.length === 0) {
      console.log(`[MATCHER] No affected products in DB.`);
      return { matchesFound: 0, matchesNew: 0, matchesExisting: 0, stackItemsChecked: stackItems.length };
    }

    let matchesFound = 0;
    let matchesNew = 0;
    let matchesExisting = 0;
    let vulnerableCount = 0;

    // 4. Compare every (stack item × affected product) pair
    for (const si of stackItems) {
      const targetName = si.canonical_name || si.product_name;

      for (const ap of affectedProducts) {
        if (namesMatch(targetName, ap.product_name) || namesMatch(si.product_name, ap.product_name)) {
          // Precise Version Evaluation with Title Stream Checking
          const evaluation = versionMatcherService.evaluate(si.installed_version, {
            affectedVersionsRaw: ap.affected_versions_raw,
            fixedVersion: ap.fixed_version,
            title: ap.title,
            productName: targetName,
          });

          const reason = `${evaluation.reason} (Product: "${targetName}" ↔ "${ap.product_name}")`;
          matchesFound++;
          if (evaluation.status === 'vulnerable') vulnerableCount++;

          const record = await matchRepository.upsertMatch({
            userId,
            stackItemId: si.id,
            affectedProductId: ap.id,
            status: evaluation.status, // 'vulnerable' | 'not_affected' | 'potential_match'
            matchReason: reason,
          });

          if (record.is_new) matchesNew++;
          else matchesExisting++;
        }
      }
    }

    // 5. Clean any stale matches where the stack item was deleted
    await matchRepository.cleanStaleMatches(userId);

    console.log(`[MATCHER] User #${userId}: ${matchesFound} matches (${vulnerableCount} vulnerable, ${matchesNew} new)`);

    return {
      matchesFound,
      matchesNew,
      matchesExisting,
      vulnerableCount,
      stackItemsChecked: stackItems.length,
    };
  }

  /**
   * Product-level scan targets and deduplicated vulnerability aggregation.
   * Treats each monitored stack product as a separate scan target.
   * Deduplicates by underlying vulnerability (CVE / Advisory ID) while retaining related vendor sources.
   * Confirmed vulnerabilities are kept strictly separate from Needs Review.
   * Dashboard totals equal the exact sum of the displayed product results.
   */
  async getProductScanTargets(userId) {
    // 1. Get user stack items with catalog info
    const stackResult = await pool.query(
      `SELECT si.id, si.product_name, si.canonical_name, si.vendor, si.ecosystem, si.installed_version, si.notes,
              sc.category, sc.description as catalog_description
       FROM stack_items si
       LEFT JOIN software_catalog sc ON sc.id = si.catalog_product_id
       WHERE si.user_id = $1
       ORDER BY si.created_at ASC`,
      [userId]
    );
    const stackItems = stackResult.rows;

    // 2. Get user's active matches joined with advisories and affected products
    const matchesResult = await pool.query(
      `SELECT m.id, m.stack_item_id, m.status, m.match_reason, m.ai_explanation,
              a.id as advisory_id, a.cve_id, a.title, a.description as advisory_description,
              a.severity, a.source_name, a.source_url, a.remediation,
              ap.affected_versions_raw, ap.fixed_version
       FROM matches m
       JOIN affected_products ap ON ap.id = m.affected_product_id
       JOIN advisories a         ON a.id  = ap.advisory_id
       WHERE m.user_id = $1`,
      [userId]
    );
    const matches = matchesResult.rows;

    const matchesByStackId = new Map();
    for (const m of matches) {
      if (!matchesByStackId.has(m.stack_item_id)) {
        matchesByStackId.set(m.stack_item_id, []);
      }
      matchesByStackId.get(m.stack_item_id).push(m);
    }

    const products = stackItems.map((item) => {
      const isSupported = isFeedSupported(item.canonical_name || item.product_name, item.vendor, item.ecosystem);
      const rawMatches = matchesByStackId.get(item.id) || [];

      // Deduplicate matches by underlying vulnerability (CVE ID or source advisory ID)
      const vulnMap = new Map();

      for (const m of rawMatches) {
        const cveKey = (m.cve_id && m.cve_id.trim()) ? m.cve_id.trim().toUpperCase() : null;
        const key = cveKey || m.source_advisory_id || `adv-${m.advisory_id}`;

        if (!vulnMap.has(key)) {
          vulnMap.set(key, {
            key,
            cveId: cveKey || m.cve_id || null,
            primaryMatchId: m.id,
            title: m.title || `${key} in ${item.product_name}`,
            description: m.advisory_description || '',
            severity: m.severity || 'Medium',
            status: m.status,
            statuses: [m.status],
            matchReason: m.match_reason,
            affectedVersions: m.affected_versions_raw || 'Unknown',
            fixedVersion: m.fixed_version || null,
            remediation: m.remediation || (m.fixed_version ? `Upgrade to version ${m.fixed_version} or later.` : 'Apply latest vendor security patch.'),
            aiExplanation: m.ai_explanation || null,
            sourceUrl: m.source_url || null,
            sources: [
              {
                sourceName: m.source_name || 'Vendor Advisory',
                sourceUrl: m.source_url || null,
                advisoryId: m.source_advisory_id || m.cve_id || key,
              },
            ],
          });
        } else {
          const existing = vulnMap.get(key);
          existing.statuses.push(m.status);
          existing.severity = pickHighestSeverity(existing.severity, m.severity);
          if (!existing.fixedVersion && m.fixed_version) existing.fixedVersion = m.fixed_version;
          if (m.remediation && (!existing.remediation || existing.remediation.length < m.remediation.length)) {
            existing.remediation = m.remediation;
          }
          if (m.ai_explanation && !existing.aiExplanation) {
            existing.aiExplanation = m.ai_explanation;
          }
          if (m.source_url && !existing.sources.some((s) => s.sourceUrl === m.source_url)) {
            existing.sources.push({
              sourceName: m.source_name || 'Vendor Advisory',
              sourceUrl: m.source_url,
              advisoryId: m.source_advisory_id || m.cve_id || key,
            });
          }
        }
      }

      // Resolve final status for each deduplicated vulnerability
      const deduplicatedVulns = Array.from(vulnMap.values()).map((v) => {
        let resolvedStatus = 'not_affected';
        if (v.statuses.includes('confirmed')) resolvedStatus = 'confirmed';
        else if (v.statuses.includes('vulnerable')) resolvedStatus = 'vulnerable';
        else if (v.statuses.includes('potential_match') || v.statuses.includes('needs_review')) resolvedStatus = 'needs_review';
        else if (v.statuses.includes('not_affected')) resolvedStatus = 'not_affected';
        else if (v.statuses.includes('dismissed')) resolvedStatus = 'dismissed';

        v.status = resolvedStatus;
        return v;
      });

      // Split into confirmed vs needs review vs safe
      const confirmedVulnerabilities = deduplicatedVulns.filter((v) => v.status === 'vulnerable' || v.status === 'confirmed');
      const needsReviewVulnerabilities = deduplicatedVulns.filter((v) => v.status === 'needs_review' || v.status === 'potential_match');
      const notAffectedVulnerabilities = deduplicatedVulns.filter((v) => v.status === 'not_affected');

      // Severity breakdown strictly for verified confirmed vulnerabilities
      const severityBreakdown = {
        critical: confirmedVulnerabilities.filter((v) => (v.severity || '').toLowerCase() === 'critical').length,
        high: confirmedVulnerabilities.filter((v) => (v.severity || '').toLowerCase() === 'high').length,
        medium: confirmedVulnerabilities.filter((v) => (v.severity || '').toLowerCase() === 'medium').length,
        low: confirmedVulnerabilities.filter((v) => (v.severity || '').toLowerCase() === 'low').length,
        unknown: confirmedVulnerabilities.filter((v) => !['critical', 'high', 'medium', 'low'].includes((v.severity || '').toLowerCase())).length,
      };

      let healthStatus = 'coverage_unavailable';
      let statusLabel = 'Coverage Unavailable';

      if (!isSupported) {
        healthStatus = 'coverage_unavailable';
        statusLabel = 'Coverage Unavailable';
      } else if (confirmedVulnerabilities.length > 0) {
        healthStatus = 'vulnerable';
        statusLabel = `Vulnerable (${confirmedVulnerabilities.length})`;
      } else if (needsReviewVulnerabilities.length > 0) {
        healthStatus = 'needs_review';
        statusLabel = `Needs Review (${needsReviewVulnerabilities.length})`;
      } else {
        healthStatus = 'safe';
        statusLabel = 'Verified Safe (0 Advisories)';
      }

      return {
        id: item.id,
        productName: item.canonical_name || item.product_name,
        originalInput: item.product_name,
        vendor: item.vendor || 'Generic',
        ecosystem: item.ecosystem || 'General Software',
        installedVersion: item.installed_version,
        category: item.category || 'General Software',
        notes: item.notes,
        isSupported,
        healthStatus,
        statusLabel,
        vulnerabilityCount: confirmedVulnerabilities.length,
        needsReviewCount: needsReviewVulnerabilities.length,
        notAffectedCount: notAffectedVulnerabilities.length,
        totalAdvisories: deduplicatedVulns.length,
        severityBreakdown,
        vulnerabilities: confirmedVulnerabilities,
        needsReview: needsReviewVulnerabilities,
        notAffected: notAffectedVulnerabilities,
        allDeduplicated: deduplicatedVulns,
        // Raw advisories mapping for backward compatibility
        advisories: deduplicatedVulns.map((v) => ({
          matchId: v.primaryMatchId,
          status: v.status,
          cveId: v.cveId,
          title: v.title,
          severity: v.severity,
          sourceUrl: v.sourceUrl,
          sources: v.sources,
          affectedVersions: v.affectedVersions,
          fixedVersion: v.fixedVersion,
          reason: v.matchReason,
          remediation: v.remediation,
          aiExplanation: v.aiExplanation,
        })),
      };
    });

    // Global summary across all scan targets — totals strictly equal the sum of product results
    const summary = {
      totalMonitored: products.length,
      supportedCount: products.filter((p) => p.isSupported).length,
      unsupportedCount: products.filter((p) => !p.isSupported).length,
      vulnerableProductsCount: products.filter((p) => p.vulnerabilityCount > 0).length,
      safeProductsCount: products.filter((p) => p.healthStatus === 'safe').length,
      needsReviewProductsCount: products.filter((p) => p.healthStatus === 'needs_review').length,
      // Total confirmed vulnerabilities across all products
      vulnerableCount: products.reduce((acc, p) => acc + p.vulnerabilityCount, 0),
      totalVulnerabilities: products.reduce((acc, p) => acc + p.vulnerabilityCount, 0),
      total: products.reduce((acc, p) => acc + p.vulnerabilityCount, 0),
      // Severity sums matching exact sum of product results
      critical: products.reduce((acc, p) => acc + p.severityBreakdown.critical, 0),
      high: products.reduce((acc, p) => acc + p.severityBreakdown.high, 0),
      medium: products.reduce((acc, p) => acc + p.severityBreakdown.medium, 0),
      low: products.reduce((acc, p) => acc + p.severityBreakdown.low, 0),
      unknown: products.reduce((acc, p) => acc + p.severityBreakdown.unknown, 0),
      // Needs review sum strictly separated
      needsReviewCount: products.reduce((acc, p) => acc + p.needsReviewCount, 0),
      needsReview: products.reduce((acc, p) => acc + p.needsReviewCount, 0),
      safeCount: products.filter((p) => p.healthStatus === 'safe').length,
    };

    return {
      summary,
      products,
      items: products, // Alias for backward compatibility
    };
  }

  /**
   * Complete Coverage & Health Report for the user's software stack.
   * Delegates directly to getProductScanTargets.
   */
  async getCoverageReport(userId) {
    return this.getProductScanTargets(userId);
  }

  /**
   * Run matching for all registered users.
   */
  async runForAllUsers() {
    const result = await pool.query(`SELECT DISTINCT user_id FROM stack_items`);
    const userIds = result.rows.map((r) => r.user_id);

    const results = [];
    for (const userId of userIds) {
      try {
        const summary = await this.runForUser(userId);
        results.push({ userId, ...summary });
      } catch (err) {
        console.error(`[MATCHER ERROR] Failed for user #${userId}:`, err.message);
        results.push({ userId, error: err.message });
      }
    }
    return results;
  }
}

module.exports = new MatcherService();

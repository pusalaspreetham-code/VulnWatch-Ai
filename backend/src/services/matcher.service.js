const pool = require('../db');
const matchRepository = require('../repositories/match.repository');
const versionMatcherService = require('./version_matcher.service');

// Known officially monitored vendors & products
const SUPPORTED_FEEDS = [
  { name: 'apache http server', aliases: ['apache', 'httpd', 'apache2', 'apache http server'] },
  { name: 'node.js',            aliases: ['nodejs', 'node.js', 'node'] },
  { name: 'ubuntu',             aliases: ['ubuntu', 'ubuntu linux', 'canonical ubuntu'] },
  { name: 'php',                aliases: ['php', 'the php group'] },
  { name: 'amazon linux',       aliases: ['amazon linux', 'amazon linux 2023', 'amazon linux 2', 'amzn'] },
  { name: 'nginx',              aliases: ['nginx', 'f5 nginx'] },
];

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
 */
function namesMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;

  // Exact
  if (na === nb) return true;

  // Special aliases (e.g. PHP, NGINX)
  if ((na === 'php' && nb.includes('php')) || (nb === 'php' && na.includes('php'))) return true;
  if ((na.includes('amazon linux') && nb.includes('amazon linux')) ||
      (na.includes('amazon') && nb.includes('amazon linux'))) return true;
  if ((na.includes('apache') && nb.includes('apache http server')) ||
      (nb.includes('apache') && na.includes('apache http server'))) return true;
  if ((na.includes('node') && nb.includes('node')) || (nb.includes('node') && na.includes('node'))) return true;

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
 * Check if a product has an active official advisory feed configured.
 */
function isFeedSupported(productName, vendor) {
  const norm = normalize(`${vendor || ''} ${productName}`);
  return SUPPORTED_FEEDS.some((feed) =>
    feed.aliases.some((alias) => norm.includes(alias))
  );
}

class MatcherService {
  /**
   * Run vulnerability matching for a user:
   * 1. Compares stack items to affected products.
   * 2. Evaluates installed version against affected version ranges & fixes.
   * 3. Upserts matches into PostgreSQL with accurate status & reason.
   */
  async runForUser(userId) {
    console.log(`[MATCHER] Running vulnerability detection for user #${userId}`);

    // 1. Load user's stack items
    const stackResult = await pool.query(
      `SELECT id, product_name, vendor, installed_version FROM stack_items WHERE user_id = $1`,
      [userId]
    );
    const stackItems = stackResult.rows;

    if (stackItems.length === 0) {
      console.log(`[MATCHER] User #${userId} has no stack items.`);
      return { matchesFound: 0, matchesNew: 0, matchesExisting: 0, stackItemsChecked: 0 };
    }

    // 2. Load all affected products joined with advisory details
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

    // 3. Compare every (stack item × affected product) pair
    for (const si of stackItems) {
      for (const ap of affectedProducts) {
        if (namesMatch(si.product_name, ap.product_name)) {
          // Precise Version Evaluation
          const evaluation = versionMatcherService.evaluate(si.installed_version, {
            affectedVersionsRaw: ap.affected_versions_raw,
            fixedVersion: ap.fixed_version,
          });

          const reason = `${evaluation.reason} (Product: "${si.product_name}" ↔ "${ap.product_name}")`;
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

    // 4. Clean any stale matches where the stack item was deleted
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
   * Complete Coverage & Health Report for the user's software stack.
   * Categorizes each stack item:
   * - 'vulnerable': has at least 1 vulnerable advisory match
   * - 'needs_review': product matches advisory but version range requires verification
   * - 'safe': supported and all matching advisories are marked not_affected
   * - 'no_advisories': product has active feed, but 0 advisories affect it
   * - 'unsupported': no official security advisory feed configured yet
   */
  async getCoverageReport(userId) {
    // 1. Get user stack items with catalog info
    const stackResult = await pool.query(
      `SELECT si.id, si.product_name, si.vendor, si.installed_version, si.notes,
              sc.category, sc.description as catalog_description
       FROM stack_items si
       LEFT JOIN software_catalog sc ON sc.id = si.catalog_product_id
       WHERE si.user_id = $1
       ORDER BY si.created_at DESC`,
      [userId]
    );
    const stackItems = stackResult.rows;

    // 2. Get user's active matches grouped by stack_item_id
    const matchesResult = await pool.query(
      `SELECT m.id, m.stack_item_id, m.status, m.match_reason,
              a.cve_id, a.title, a.severity, a.source_url, a.remediation,
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

    let supportedCount = 0;
    let unsupportedCount = 0;
    let vulnerableCount = 0;
    let safeCount = 0;
    let needsReviewCount = 0;

    const itemsReport = stackItems.map((item) => {
      const isSupported = isFeedSupported(item.product_name, item.vendor);
      const itemMatches = matchesByStackId.get(item.id) || [];

      let healthStatus = 'unsupported';
      let statusLabel = 'No Official Advisory Feed';

      if (!isSupported) {
        healthStatus = 'unsupported';
        statusLabel = 'Pending Feed Coverage';
        unsupportedCount++;
      } else {
        supportedCount++;
        const hasVulnerable = itemMatches.some((m) => m.status === 'vulnerable' || m.status === 'confirmed');
        const hasNeedsReview = itemMatches.some((m) => m.status === 'potential_match' || m.status === 'needs_review');
        const hasNotAffected = itemMatches.some((m) => m.status === 'not_affected');

        if (hasVulnerable) {
          healthStatus = 'vulnerable';
          statusLabel = 'Vulnerable';
          vulnerableCount++;
        } else if (hasNeedsReview) {
          healthStatus = 'needs_review';
          statusLabel = 'Needs Review';
          needsReviewCount++;
        } else if (hasNotAffected) {
          healthStatus = 'safe';
          statusLabel = 'Patched / Safe';
          safeCount++;
        } else {
          healthStatus = 'safe';
          statusLabel = 'Clear (No Advisories)';
          safeCount++;
        }
      }

      return {
        id: item.id,
        productName: item.product_name,
        vendor: item.vendor,
        installedVersion: item.installed_version,
        category: item.category || 'General Software',
        notes: item.notes,
        isSupported,
        healthStatus,
        statusLabel,
        totalAdvisories: itemMatches.length,
        vulnerabilitiesCount: itemMatches.filter((m) => m.status === 'vulnerable' || m.status === 'confirmed').length,
        advisories: itemMatches.map((m) => ({
          matchId: m.id,
          status: m.status,
          cveId: m.cve_id,
          title: m.title,
          severity: m.severity,
          sourceUrl: m.source_url,
          affectedVersions: m.affected_versions_raw,
          fixedVersion: m.fixed_version,
          reason: m.match_reason,
        })),
      };
    });

    return {
      summary: {
        totalMonitored: stackItems.length,
        supportedCount,
        unsupportedCount,
        vulnerableCount,
        safeCount,
        needsReviewCount,
      },
      items: itemsReport,
    };
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

/**
 * Universal Ecosystem & Advisory Source Service
 * Bridges local vendor scraping feeds with the global OSV (Open Source Vulnerabilities) API.
 * Provides broad coverage for Python, Node.js, Go, Docker, Java, Rust, PHP, Linux packages, etc.
 */

const advisoryRepository = require('../repositories/advisory.repository');

const OSV_API_URL = 'https://api.osv.dev/v1/query';

// Ecosystem detection rules (extensible dictionary)
const ECOSYSTEM_RULES = [
  {
    ecosystem: 'PyPI',
    keywords: ['python', 'cpython', 'pypi', 'pip', 'django', 'flask', 'fastapi', 'requests', 'numpy', 'pandas', 'celery', 'scipy', 'sqlalchemy', 'pytest', 'gunicorn', 'uvicorn'],
    packageFormat: (name) => name.toLowerCase().replace(/\s+/g, '-'),
  },
  {
    ecosystem: 'npm',
    keywords: ['node', 'nodejs', 'npm', 'react', 'express', 'vue', 'angular', 'next.js', 'nextjs', 'lodash', 'axios', 'vite', 'webpack', 'typescript', 'eslint', 'electron'],
    packageFormat: (name) => name.toLowerCase().replace(/\s+/g, '-'),
  },
  {
    ecosystem: 'Container / Go',
    keywords: ['docker', 'moby', 'containerd', 'podman', 'kubernetes', 'k8s', 'helm', 'etcd', 'traefik'],
    packageFormat: (name) => {
      const lower = name.toLowerCase();
      if (lower.includes('docker')) return 'docker.io';
      if (lower.includes('kubernetes') || lower === 'k8s') return 'k8s.io/kubernetes';
      return lower;
    },
  },
  {
    ecosystem: 'Go',
    keywords: ['go', 'golang', 'gin', 'fiber', 'gorm'],
    packageFormat: (name) => name.toLowerCase(),
  },
  {
    ecosystem: 'Maven',
    keywords: ['java', 'spring', 'spring boot', 'quarkus', 'maven', 'gradle', 'log4j', 'tomcat', 'hibernate', 'netty', 'struts'],
    packageFormat: (name) => name.toLowerCase(),
  },
  {
    ecosystem: 'crates.io',
    keywords: ['rust', 'cargo', 'tokio', 'actix', 'serde'],
    packageFormat: (name) => name.toLowerCase(),
  },
  {
    ecosystem: 'Packagist',
    keywords: ['php', 'composer', 'laravel', 'symfony', 'wordpress', 'drupal'],
    packageFormat: (name) => name.toLowerCase(),
  },
  {
    ecosystem: 'NuGet',
    keywords: ['.net', 'dotnet', 'c#', 'nuget', 'aspnet', 'entity framework'],
    packageFormat: (name) => name.toLowerCase(),
  },
  {
    ecosystem: 'Ubuntu',
    keywords: ['ubuntu', 'canonical', 'debian', 'apt'],
    packageFormat: (name) => name.toLowerCase(),
  },
];

class EcosystemAdvisoryService {
  /**
   * Automatically detect the ecosystem from product name, vendor, or category
   */
  identifyEcosystem(productName = '', vendor = '', category = '') {
    const text = `${productName} ${vendor} ${category}`.toLowerCase();

    for (const rule of ECOSYSTEM_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return rule.ecosystem;
      }
    }

    if (category.toLowerCase().includes('database')) return 'System / Database';
    if (category.toLowerCase().includes('web server')) return 'System / Web Server';
    if (category.toLowerCase().includes('operating system')) return 'Operating System';

    return 'General Software';
  }

  /**
   * Validate that the version string conforms to expected format
   */
  validateVersionFormat(version, format = 'semver') {
    if (!version || typeof version !== 'string') {
      return { valid: false, message: 'Version string is required.' };
    }

    const trimmed = version.trim();
    if (['latest', 'current', 'stable', 'beta', 'alpha', 'rc'].includes(trimmed.toLowerCase())) {
      return {
        valid: false,
        message: `Vague version "${trimmed}" is not supported. Please provide a specific release number (e.g., 3.12.0, 24.04).`,
      };
    }

    // Must contain at least one digit
    if (!/\d/.test(trimmed)) {
      return { valid: false, message: `Invalid version "${trimmed}". Version must contain numeric digits (e.g., 1.2.3).` };
    }

    return { valid: true, sanitized: trimmed.replace(/^v/i, '') };
  }

  /**
   * Query the OSV API for real vulnerabilities matching a package and version
   */
  async queryOsv(packageName, ecosystem, version) {
    if (!packageName) return [];

    const cleanVer = String(version || '').trim().replace(/^v/i, '');
    const cleanPkg = String(packageName).trim().toLowerCase();
    const pkgVariants = [cleanPkg, cleanPkg.replace(/\s+/g, '-'), cleanPkg.replace(/[^a-z0-9]/g, '')];
    const uniqueVariants = [...new Set(pkgVariants.filter(Boolean))];

    const queries = [];

    // Query 1: Exact lowercase package with ecosystem if known
    if (ecosystem && ecosystem !== 'General Software' && ecosystem !== 'System') {
      const eco = ecosystem.includes('/') ? ecosystem.split('/')[0].trim() : ecosystem;
      for (const variant of uniqueVariants) {
        queries.push({ package: { name: variant, ecosystem: eco }, version: cleanVer });
      }
    }

    // Query 2: Package by lowercase name alone (broad search across all OSV databases)
    for (const variant of uniqueVariants) {
      queries.push({ package: { name: variant }, version: cleanVer });
    }

    // Also check common aliases if Docker
    if (cleanPkg.includes('docker')) {
      queries.push({ package: { name: 'docker.io' }, version: cleanVer });
      queries.push({ package: { name: 'github.com/docker/docker' }, version: cleanVer });
    }

    const results = [];
    const seenIds = new Set();

    for (const queryPayload of queries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(OSV_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryPayload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        const vulns = data.vulns || [];

        for (const v of vulns) {
          if (!seenIds.has(v.id)) {
            seenIds.add(v.id);
            results.push(v);
          }
        }

        // If we found specific hits, no need to over-query
        if (results.length > 0) break;
      } catch (err) {
        // Continue fallback queries if one fails/times out
      }
    }

    return results;
  }

  /**
   * Convert raw OSV vulnerability into standard VulnWatch advisory & affected product
   */
  normalizeOsvVulnerability(v, productName, vendor) {
    // 1. Extract CVE ID
    const cves = (v.aliases || []).filter((a) => /^CVE-\d{4}-\d{4,7}$/i.test(a));
    const cveId = cves.length > 0 ? cves[0].toUpperCase() : v.id.startsWith('CVE-') ? v.id.toUpperCase() : v.id;

    // 2. Extract Severity
    let severity = 'Medium';
    let cvssScore = null;

    if (v.severity && Array.isArray(v.severity)) {
      const cvss = v.severity.find((s) => s.type === 'CVSS_V3' || s.type === 'CVSS_V2');
      if (cvss && cvss.score) {
        // e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        if (typeof cvss.score === 'string' && cvss.score.includes('/')) {
          // Estimate from CVSS metrics
          if (cvss.score.includes('/C:H/') || cvss.score.includes('/I:H/')) severity = 'High';
          if (cvss.score.includes('/AV:N/AC:L/PR:N/') && cvss.score.includes('/C:H/')) severity = 'Critical';
        } else if (typeof cvss.score === 'number') {
          cvssScore = cvss.score;
          if (cvssScore >= 9.0) severity = 'Critical';
          else if (cvssScore >= 7.0) severity = 'High';
          else if (cvssScore >= 4.0) severity = 'Medium';
          else severity = 'Low';
        }
      }
    }

    if (v.database_specific && v.database_specific.severity) {
      const dbSev = String(v.database_specific.severity).toUpperCase();
      if (['CRITICAL', 'HIGH', 'MODERATE', 'MEDIUM', 'LOW'].includes(dbSev)) {
        severity = dbSev === 'MODERATE' ? 'Medium' : dbSev.charAt(0) + dbSev.slice(1).toLowerCase();
      }
    }

    // 3. Extract Affected Ranges & Fix Versions
    let fixedVersion = null;
    const affectedParts = [];

    if (v.affected && Array.isArray(v.affected)) {
      for (const aff of v.affected) {
        if (aff.ranges && Array.isArray(aff.ranges)) {
          for (const r of aff.ranges) {
            const events = r.events || [];
            let intro = null;
            for (const ev of events) {
              if (ev.introduced !== undefined) intro = ev.introduced;
              if (ev.fixed) {
                if (!fixedVersion) fixedVersion = ev.fixed;
                affectedParts.push(intro && intro !== '0' ? `>= ${intro}, < ${ev.fixed}` : `< ${ev.fixed}`);
              }
            }
          }
        }
        if (!fixedVersion && aff.versions && Array.isArray(aff.versions)) {
          affectedParts.push(aff.versions.slice(0, 5).join(', '));
        }
      }
    }

    const affectedVersionsRaw = affectedParts.length > 0 ? affectedParts.join('; ') : 'All versions prior to fix';

    // 4. Source URL & References
    let sourceUrl = `https://osv.dev/vulnerability/${v.id}`;
    if (v.references && Array.isArray(v.references) && v.references.length > 0) {
      const advRef = v.references.find((r) => r.type === 'ADVISORY' || r.type === 'WEB') || v.references[0];
      if (advRef && advRef.url) sourceUrl = advRef.url;
    }

    const title = v.summary || `${cveId} in ${productName}`;
    const description = (v.details || v.summary || `Vulnerability reported in ${productName}`).slice(0, 2000);
    const remediation = fixedVersion
      ? `Upgrade ${productName} to version ${fixedVersion} or later.`
      : `Apply the latest vendor security patch from ${sourceUrl}.`;

    return {
      cveId,
      sourceName: `OSV (${v.id.split('-')[0] || 'Database'})`,
      sourceAdvisoryId: v.id,
      sourceUrl,
      title,
      description,
      severity,
      cvssScore,
      remediation,
      publishedAt: v.published ? new Date(v.published) : new Date(),
      rawSourceText: JSON.stringify(v),
      affectedProducts: [
        {
          vendor: vendor || 'Open Source',
          productName,
          cpe: null,
          affectedVersionsRaw,
          fixedVersion,
        },
      ],
    };
  }

  /**
   * Fetch and save OSV vulnerabilities into the database for a monitored item
   */
  async syncAdvisoriesForProduct(productName, vendor, installedVersion, ecosystem) {
    try {
      const vulns = await this.queryOsv(productName, ecosystem, installedVersion);
      if (!vulns || vulns.length === 0) {
        return { count: 0, newCount: 0 };
      }

      let count = 0;
      let newCount = 0;

      for (const v of vulns) {
        const adv = this.normalizeOsvVulnerability(v, productName, vendor);
        const record = await advisoryRepository.upsertAdvisory(adv);
        if (record.is_new) newCount++;
        count++;

        if (adv.affectedProducts && adv.affectedProducts.length > 0) {
          await advisoryRepository.saveAffectedProducts(record.id, adv.affectedProducts);
        }
      }

      return { count, newCount };
    } catch (err) {
      console.warn(`[ECOSYSTEM ADVISORY] OSV sync failed for ${productName}:`, err.message);
      return { count: 0, newCount: 0, error: err.message };
    }
  }

  /**
   * Determine whether a product has advisory coverage available (Vendor Feeds OR OSV)
   */
  isCoverageSupported(productName, vendor, ecosystem) {
    if (!productName) return false;

    const norm = `${vendor || ''} ${productName}`.toLowerCase();

    // 1. Direct vendor feed support
    const vendorFeeds = ['apache', 'node', 'nodejs', 'ubuntu', 'php', 'amazon linux', 'amzn', 'nginx'];
    if (vendorFeeds.some((vf) => norm.includes(vf))) return true;

    // 2. Extensible OSV ecosystem coverage
    const supportedEcosystems = ['PyPI', 'npm', 'Go', 'Maven', 'crates.io', 'Packagist', 'NuGet', 'Ubuntu', 'Container / Go'];
    if (supportedEcosystems.includes(ecosystem)) return true;

    // 3. Known supported open-source technologies in catalog
    const openSourceKeywords = ['python', 'docker', 'kubernetes', 'postgres', 'mysql', 'redis', 'openssl', 'git', 'django', 'express', 'spring', 'flask', 'fastapi'];
    if (openSourceKeywords.some((k) => norm.includes(k))) return true;

    return false;
  }
}

module.exports = new EcosystemAdvisoryService();

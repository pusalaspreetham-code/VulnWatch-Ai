// Deterministic Parsers for Official Vendor Security Notices (No LLM Guessing)

class AdvisoryParser {
  // Extract all CVE identifiers using official standard format
  extractCves(text) {
    if (!text) return [];
    const matches = text.match(/CVE-\d{4}-\d{4,7}/gi) || [];
    return [...new Set(matches.map((c) => c.toUpperCase()))];
  }

  // Parse CVSS score safely
  extractCvss(text) {
    if (!text) return null;
    const match = text.match(/CVSS(?:\s*v[23](?:\.[01])?)?\s*:\s*([0-9]+(?:\.[0-9])?)/i);
    if (match) {
      const score = parseFloat(match[1]);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        return score;
      }
    }
    return null;
  }

  // Parse Severity without inventing levels
  extractSeverity(text) {
    if (!text) return null;
    const match = text.match(/(?:Severity|Impact)\s*:\s*(Critical|Important|High|Moderate|Medium|Low)/i);
    if (match) {
      const val = match[1].toLowerCase();
      if (val === 'critical') return 'Critical';
      if (val === 'important' || val === 'high') return 'High';
      if (val === 'moderate' || val === 'medium') return 'Medium';
      if (val === 'low') return 'Low';
    }
    // Check header labels like "## Critical: ..." or "(important):"
    const headerMatch = text.match(/(?:^##\s*|\()(?:\s*)(Critical|Important|High|Moderate|Medium|Low)(?:\s*)(?::|\))/im);
    if (headerMatch) {
      const val = headerMatch[1].toLowerCase();
      if (val === 'critical') return 'Critical';
      if (val === 'important' || val === 'high') return 'High';
      if (val === 'moderate' || val === 'medium') return 'Medium';
      if (val === 'low') return 'Low';
    }
    return null;
  }

  // Parse Published Date
  extractDate(text) {
    if (!text) return null;
    const match = text.match(/Published\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i) ||
                  text.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (match) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  // 1. Apache HTTP Server Parser (handles fixtures & live Firecrawl markdown tables)
  parseApacheHttpd(markdown, sourceUrl) {
    const advisories = [];
    const vendor = 'Apache Software Foundation';
    const productName = 'Apache HTTP Server';
    const cpe = 'cpe:2.3:a:apache:http_server';

    // Support sections split by "## " or "### "
    const sections = markdown.split(/^#{2,3}\s+/m).slice(1);

    for (const section of sections) {
      const cves = this.extractCves(section);
      if (cves.length === 0) continue;

      const firstLine = section.split('\n')[0].trim();
      const title = firstLine
        .replace(/\[CVE-[^\]]+\]\([^)]+\)/gi, '')
        .replace(/\(CVE-[^)]+\)/gi, '')
        .replace(/^(Critical|Important|Moderate|Low):\s*/i, '')
        .replace(/\([a-zA-Z]+\):/i, '')
        .replace(/\[¶\]\([^)]+\)/g, '')
        .trim();

      const severity = this.extractSeverity(section) || 'Important';
      const cvssScore = this.extractCvss(section);
      const publishedAt = this.extractDate(section);

      // Extract affected versions from plain lines or tables:
      // "| Affects | 2.4.0 through 2.4.59 |" or "Affects: 2.4.0 through 2.4.59"
      let affectedVersionsRaw = null;
      const tableAffMatch = section.match(/\|\s*Affects\s*\|\s*([^|\n]+)\s*\|/i);
      if (tableAffMatch) {
        affectedVersionsRaw = tableAffMatch[1].trim();
      } else {
        const affMatch = section.match(/Affects\s*:\s*(.+)$/im);
        if (affMatch) affectedVersionsRaw = affMatch[1].trim();
      }

      // Extract fixed version from table or line
      let fixedVersion = null;
      const tableFixMatch = section.match(/\|\s*Update\s+([0-9]+(?:\.[0-9]+)+)\s+released/i) ||
                            section.match(/Update\s+([0-9]+(?:\.[0-9]+)+)\s+released/i) ||
                            section.match(/version\s+([0-9]+(?:\.[0-9]+)+),\s+which\s+fixes/i);
      if (tableFixMatch) {
        fixedVersion = tableFixMatch[1].trim();
      } else {
        const fixMatch = section.match(/Fixed in\s*:\s*(.+)$/im);
        if (fixMatch) fixedVersion = fixMatch[1].trim();
      }

      // Remediation
      let remediation = null;
      const remMatch = section.match(/Remediation\s*:\s*(.+)$/im) ||
                        section.match(/(Users are recommended to upgrade to [^\n.]+)/i);
      if (remMatch) {
        remediation = remMatch[1].trim();
      }

      for (const cve of cves) {
        advisories.push({
          cveId: cve,
          sourceName: 'Apache HTTP Server Security',
          sourceAdvisoryId: cve,
          sourceUrl,
          title: title || `${cve} in Apache HTTP Server`,
          description: section.slice(0, 2000).trim(),
          severity,
          cvssScore,
          remediation,
          publishedAt,
          rawSourceText: section,
          affectedProducts: [
            {
              vendor,
              productName,
              cpe,
              affectedVersionsRaw,
              fixedVersion,
            },
          ],
        });
      }
    }

    return advisories;
  }

  // 2. Node.js Security Advisory Parser
  parseNodeJs(markdown, sourceUrl) {
    const advisories = [];
    const vendor = 'OpenJS Foundation';
    const productName = 'Node.js';
    const cpe = 'cpe:2.3:a:nodejs:node.js';

    const sections = markdown.split(/^#{2,3}\s+/m).slice(1);

    for (const section of sections) {
      const cves = this.extractCves(section);
      if (cves.length === 0) continue;

      const firstLine = section.split('\n')[0].trim();
      const title = firstLine.replace(/\(CVE-[^)]+\)/gi, '').trim();

      const severity = this.extractSeverity(section);
      const cvssScore = this.extractCvss(section);
      const publishedAt = this.extractDate(section);

      let affectedVersionsRaw = null;
      const affMatch = section.match(/Affected\s*:\s*(.+)$/im);
      if (affMatch) {
        affectedVersionsRaw = affMatch[1].trim();
      }

      let fixedVersion = null;
      const fixMatch = section.match(/Fixed in\s*:\s*(.+)$/im);
      if (fixMatch) {
        fixedVersion = fixMatch[1].trim();
      }

      let remediation = null;
      const remMatch = section.match(/Remediation\s*:\s*(.+)$/im);
      if (remMatch) {
        remediation = remMatch[1].trim();
      }

      for (const cve of cves) {
        advisories.push({
          cveId: cve,
          sourceName: 'Node.js Security Announcements',
          sourceAdvisoryId: cve,
          sourceUrl,
          title: title || `${cve} in Node.js`,
          description: section.slice(0, 2000).trim(),
          severity,
          cvssScore,
          remediation,
          publishedAt,
          rawSourceText: section,
          affectedProducts: [
            {
              vendor,
              productName,
              cpe,
              affectedVersionsRaw,
              fixedVersion,
            },
          ],
        });
      }
    }

    return advisories;
  }

  // 3. Ubuntu Security Notice (USN) Parser
  parseUbuntu(markdown, sourceUrl) {
    const advisories = [];
    const vendor = 'Canonical';

    const usnMatch = markdown.match(/USN-[0-9]+-[0-9]+/i);
    const sourceAdvisoryId = usnMatch ? usnMatch[0].toUpperCase() : null;

    const pkgMatch = markdown.match(/Package\s*:\s*([^\n]+)/i);
    const productName = pkgMatch ? pkgMatch[1].trim() : 'Ubuntu';

    const cves = this.extractCves(markdown);
    const severity = this.extractSeverity(markdown);
    const publishedAt = this.extractDate(markdown);

    let fixedVersion = null;
    const fixMatch = markdown.match(/Fixed in\s*:\s*([^\n]+)/i);
    if (fixMatch) {
      fixedVersion = fixMatch[1].trim();
    }

    let affectedVersionsRaw = null;
    const affMatch = markdown.match(/Affected Releases\s*:\s*([\s\S]*?)(?=Fixed in|Remediation|$)/i);
    if (affMatch) {
      affectedVersionsRaw = affMatch[1].replace(/[-*]\s*/g, '').trim().split('\n').join(', ');
    }

    let remediation = null;
    const remMatch = markdown.match(/Remediation\s*:\s*([^\n]+)/i);
    if (remMatch) {
      remediation = remMatch[1].trim();
    }

    const title = sourceAdvisoryId
      ? `Ubuntu Security Notice ${sourceAdvisoryId}: ${productName}`
      : `Security update for ${productName}`;

    if (cves.length > 0) {
      for (const cve of cves) {
        advisories.push({
          cveId: cve,
          sourceName: 'Ubuntu Security Notices',
          sourceAdvisoryId: sourceAdvisoryId || cve,
          sourceUrl,
          title: `${title} (${cve})`,
          description: markdown.slice(0, 2000).trim(),
          severity,
          cvssScore: null,
          remediation,
          publishedAt,
          rawSourceText: markdown,
          affectedProducts: [
            {
              vendor,
              productName,
              cpe: `cpe:2.3:o:canonical:ubuntu_linux`,
              affectedVersionsRaw,
              fixedVersion,
            },
          ],
        });
      }
    } else {
      advisories.push({
        cveId: null,
        sourceName: 'Ubuntu Security Notices',
        sourceAdvisoryId: sourceAdvisoryId || 'USN-UNKNOWN',
        sourceUrl,
        title,
        description: markdown.slice(0, 2000).trim(),
        severity,
        cvssScore: null,
        remediation,
        publishedAt,
        rawSourceText: markdown,
        affectedProducts: [
          {
            vendor,
            productName,
            cpe: `cpe:2.3:o:canonical:ubuntu_linux`,
            affectedVersionsRaw,
            fixedVersion,
          },
        ],
      });
    }

    return advisories;
  }

  // 4. PHP Security Advisory Parser
  parsePhp(markdown, sourceUrl) {
    const advisories = [];
    const vendor = 'The PHP Group';
    const productName = 'PHP';
    const cpe = 'cpe:2.3:a:php:php';

    const sections = markdown.split(/^#{2,3}\s+/m).slice(1);

    for (const section of sections) {
      const cves = this.extractCves(section);
      if (cves.length === 0) continue;

      const firstLine = section.split('\n')[0].trim();
      const title = firstLine.replace(/\(CVE-[^)]+\)/gi, '').trim();

      const severity = this.extractSeverity(section) || 'High';
      const cvssScore = this.extractCvss(section);
      const publishedAt = this.extractDate(section);

      let affectedVersionsRaw = null;
      const affMatch = section.match(/Affected\s*:\s*(.+)$/im) ||
                        section.match(/PHP versions ([0-9x.,\s*<>-]+)/i);
      if (affMatch) {
        affectedVersionsRaw = affMatch[1].trim();
      }

      let fixedVersion = null;
      const fixMatch = section.match(/Fixed in\s*:\s*(.+)$/im) ||
                        section.match(/(?:Upgrade to|Released in)\s+PHP\s+([0-9.,\s]+)/i);
      if (fixMatch) {
        fixedVersion = fixMatch[1].trim();
      }

      let remediation = null;
      const remMatch = section.match(/Remediation\s*:\s*(.+)$/im);
      if (remMatch) {
        remediation = remMatch[1].trim();
      }

      for (const cve of cves) {
        advisories.push({
          cveId: cve,
          sourceName: 'PHP Security Announcements',
          sourceAdvisoryId: cve,
          sourceUrl,
          title: title || `${cve} in PHP`,
          description: section.slice(0, 2000).trim(),
          severity,
          cvssScore,
          remediation,
          publishedAt,
          rawSourceText: section,
          affectedProducts: [
            {
              vendor,
              productName,
              cpe,
              affectedVersionsRaw,
              fixedVersion,
            },
          ],
        });
      }
    }

    return advisories;
  }

  // 5. Amazon Linux Security Center (ALAS) Parser
  parseAmazonLinux(markdown, sourceUrl) {
    const advisories = [];
    const vendor = 'Amazon';
    const productName = 'Amazon Linux';
    const cpe = 'cpe:2.3:o:amazon:amazon_linux';

    const sections = markdown.split(/^#{2,3}\s+/m).slice(1);

    for (const section of sections) {
      const alasMatch = section.match(/ALAS[0-9]*-[0-9]{4}-[0-9]+/i);
      const sourceAdvisoryId = alasMatch ? alasMatch[0].toUpperCase() : null;
      const cves = this.extractCves(section);

      const firstLine = section.split('\n')[0].trim();
      const title = firstLine.replace(/ALAS[0-9]*-[0-9]{4}-[0-9]+/i, '').trim() ||
                    `Amazon Linux Security Advisory ${sourceAdvisoryId || ''}`;

      const severity = this.extractSeverity(section) || 'Important';
      const cvssScore = this.extractCvss(section);
      const publishedAt = this.extractDate(section);

      let affectedVersionsRaw = null;
      const affMatch = section.match(/Affected\s*:\s*(.+)$/im) ||
                        section.match(/Amazon Linux (2023|2|1)/i);
      if (affMatch) {
        affectedVersionsRaw = affMatch[1].trim();
      } else {
        affectedVersionsRaw = 'Amazon Linux 2023, Amazon Linux 2';
      }

      let fixedVersion = null;
      const fixMatch = section.match(/Fixed in\s*:\s*(.+)$/im);
      if (fixMatch) {
        fixedVersion = fixMatch[1].trim();
      }

      let remediation = null;
      const remMatch = section.match(/Remediation\s*:\s*(.+)$/im) ||
                        section.match(/(Run 'dnf update[^']+' or 'yum update[^']+')/i);
      if (remMatch) {
        remediation = remMatch[1].trim();
      }

      // Emit one advisory record per CVE in the ALAS section (bug fix: previously only stored cves[0])
      if (cves.length > 0) {
        for (const cve of cves) {
          advisories.push({
            cveId: cve,
            sourceName: 'Amazon Linux Security Center',
            sourceAdvisoryId: sourceAdvisoryId || cve,
            sourceUrl,
            title: `${sourceAdvisoryId ? sourceAdvisoryId + ': ' : ''}${title}`,
            description: section.slice(0, 2000).trim(),
            severity,
            cvssScore,
            remediation,
            publishedAt,
            rawSourceText: section,
            affectedProducts: [
              {
                vendor,
                productName,
                cpe,
                affectedVersionsRaw,
                fixedVersion,
              },
            ],
          });
        }
      } else if (sourceAdvisoryId) {
        // No CVEs found — store the ALAS advisory without a CVE ID
        advisories.push({
          cveId: null,
          sourceName: 'Amazon Linux Security Center',
          sourceAdvisoryId,
          sourceUrl,
          title: `${sourceAdvisoryId}: ${title}`,
          description: section.slice(0, 2000).trim(),
          severity,
          cvssScore,
          remediation,
          publishedAt,
          rawSourceText: section,
          affectedProducts: [
            {
              vendor,
              productName,
              cpe,
              affectedVersionsRaw,
              fixedVersion,
            },
          ],
        });
      }
    }

    return advisories;
  }

  // Dispatch to the matching vendor parser based on URL or source config
  parse(sourceConfig, markdown) {
    if (!markdown || !markdown.trim()) return [];

    const url = (sourceConfig.sourceUrl || '').toLowerCase();
    const id = (sourceConfig.id || '').toLowerCase();

    if (id.includes('php') || url.includes('php')) {
      return this.parsePhp(markdown, sourceConfig.sourceUrl);
    } else if (id.includes('amazon') || url.includes('amazon') || url.includes('alas')) {
      return this.parseAmazonLinux(markdown, sourceConfig.sourceUrl);
    } else if (id.includes('apache') || url.includes('apache')) {
      return this.parseApacheHttpd(markdown, sourceConfig.sourceUrl);
    } else if (id.includes('node') || url.includes('nodejs') || url.includes('node')) {
      return this.parseNodeJs(markdown, sourceConfig.sourceUrl);
    } else if (id.includes('ubuntu') || url.includes('ubuntu')) {
      return this.parseUbuntu(markdown, sourceConfig.sourceUrl);
    }

    return [];
  }
}

module.exports = new AdvisoryParser();

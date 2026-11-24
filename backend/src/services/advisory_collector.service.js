const firecrawlService = require('./firecrawl.service');
const advisoryParser = require('./advisory.parser');
const advisoryRepository = require('../repositories/advisory.repository');
const matcherService = require('./matcher.service');

// Official Vendor Security Sources Only
const OFFICIAL_SOURCES = [
  {
    id: 'apache-httpd',
    sourceName: 'Apache HTTP Server Security',
    vendor: 'Apache Software Foundation',
    productName: 'Apache HTTP Server',
    sourceUrl: 'https://httpd.apache.org/security/vulnerabilities_24.html',
    description: 'Official security advisories for Apache HTTP Server 2.4 releases'
  },
  {
    id: 'nodejs',
    sourceName: 'Node.js Security Announcements',
    vendor: 'OpenJS Foundation',
    productName: 'Node.js',
    sourceUrl: 'https://nodejs.org/en/blog/vulnerability',
    description: 'Official security vulnerability releases for Node.js runtimes'
  },
  {
    id: 'ubuntu',
    sourceName: 'Ubuntu Security Notices',
    vendor: 'Canonical',
    productName: 'Ubuntu',
    sourceUrl: 'https://ubuntu.com/security/notices',
    description: 'Canonical Ubuntu Security Notices (USN) for core packages'
  },
  {
    id: 'php',
    sourceName: 'PHP Security Announcements',
    vendor: 'The PHP Group',
    productName: 'PHP',
    sourceUrl: 'https://www.php.net/archive/',
    description: 'Official PHP security vulnerability releases and patches'
  },
  {
    id: 'amazon-linux',
    sourceName: 'Amazon Linux Security Center',
    vendor: 'Amazon',
    productName: 'Amazon Linux',
    sourceUrl: 'https://alas.aws.amazon.com/alas2023.html',
    description: 'Amazon Linux Security Bulletins (ALAS) for Amazon Linux OS'
  }
];

class AdvisoryCollectorService {
  getSources() {
    return OFFICIAL_SOURCES;
  }

  async collectFromSource(sourceConfig) {
    console.log(`[COLLECTOR] Starting collection from official source: ${sourceConfig.sourceName}`);
    const runId = await advisoryRepository.logRunStart(sourceConfig.sourceName, sourceConfig.sourceUrl);

    try {
      // 1. Scrape via Firecrawl
      const scrapeResult = await firecrawlService.scrapeUrl(sourceConfig.sourceUrl);
      if (!scrapeResult || !scrapeResult.markdown) {
        throw new Error(`Firecrawl returned empty markdown content for ${sourceConfig.sourceUrl}`);
      }

      // 2. Deterministic Parse
      const parsedAdvisories = advisoryParser.parse(sourceConfig, scrapeResult.markdown);
      console.log(`[COLLECTOR] Discovered ${parsedAdvisories.length} structured advisories from ${sourceConfig.sourceName}`);

      let itemsNew = 0;
      let itemsUpdated = 0;

      // 3. Upsert advisories and affected products
      for (const adv of parsedAdvisories) {
        const record = await advisoryRepository.upsertAdvisory(adv);
        if (record.is_new) {
          itemsNew++;
        } else {
          itemsUpdated++;
        }

        if (adv.affectedProducts && adv.affectedProducts.length > 0) {
          await advisoryRepository.saveAffectedProducts(record.id, adv.affectedProducts);
        }
      }

      // 4. Complete Audit Run
      await advisoryRepository.logRunComplete(runId, {
        status: 'completed',
        itemsCollected: parsedAdvisories.length,
        itemsNew,
        itemsUpdated,
      });

      console.log(`[COLLECTOR SUCCESS] ${sourceConfig.sourceName}: ${itemsNew} new, ${itemsUpdated} updated`);

      return {
        runId,
        sourceName: sourceConfig.sourceName,
        itemsCollected: parsedAdvisories.length,
        itemsNew,
        itemsUpdated,
        status: 'completed',
      };
    } catch (err) {
      console.error(`[COLLECTOR ERROR] Collection failed for ${sourceConfig.sourceName}:`, err.message);
      await advisoryRepository.logRunComplete(runId, {
        status: 'failed',
        errorMessage: err.message,
      });
      throw err;
    }
  }

  async collectAll() {
    const results = [];
    for (const source of OFFICIAL_SOURCES) {
      try {
        const res = await this.collectFromSource(source);
        results.push(res);
      } catch (err) {
        results.push({
          sourceName: source.sourceName,
          status: 'failed',
          error: err.message,
        });
      }
    }

    // After all sources are collected, re-scan every user's stack in the background
    console.log('[COLLECTOR] Collection finished — triggering background re-scan for all users...');
    matcherService.runForAllUsers().catch(err => {
      console.warn('[COLLECTOR] Background re-scan failed:', err.message);
    });

    return results;
  }
}

module.exports = new AdvisoryCollectorService();


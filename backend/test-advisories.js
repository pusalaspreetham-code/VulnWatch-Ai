process.env.FIRECRAWL_MOCK_MODE = 'true';
require('dotenv').config();
const pool = require('./src/db');
const firecrawlService = require('./src/services/firecrawl.service');
const advisoryParser = require('./src/services/advisory.parser');
const advisoryRepository = require('./src/repositories/advisory.repository');
const advisoryCollectorService = require('./src/services/advisory_collector.service');

// === SOURCE CONFIGS ===
const APACHE_SOURCE = {
  id: 'apache-httpd',
  sourceName: 'Apache HTTP Server Security',
  vendor: 'Apache Software Foundation',
  productName: 'Apache HTTP Server',
  sourceUrl: 'https://httpd.apache.org/security/vulnerabilities_24.html',
};

const NODE_SOURCE = {
  id: 'nodejs',
  sourceName: 'Node.js Security Announcements',
  vendor: 'OpenJS Foundation',
  productName: 'Node.js',
  sourceUrl: 'https://nodejs.org/en/blog/vulnerability',
};

const UBUNTU_SOURCE = {
  id: 'ubuntu',
  sourceName: 'Ubuntu Security Notices',
  vendor: 'Canonical',
  productName: 'Ubuntu',
  sourceUrl: 'https://ubuntu.com/security/notices',
};

const PHP_SOURCE = {
  id: 'php',
  sourceName: 'PHP Security Announcements',
  vendor: 'The PHP Group',
  productName: 'PHP',
  sourceUrl: 'https://www.php.net/archive/',
};

const ALAS_SOURCE = {
  id: 'amazon-linux',
  sourceName: 'Amazon Linux Security Center',
  vendor: 'Amazon',
  productName: 'Amazon Linux',
  sourceUrl: 'https://alas.aws.amazon.com/alas2023.html',
};

async function runTests() {
  console.log('\n===========================================');
  console.log('TEST SUITE: SECURITY ADVISORY COLLECTION');
  console.log('===========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ─────────────────────────────────────────────────────
    // 1. Firecrawl Service — Scrape & Offline Fixtures
    // ─────────────────────────────────────────────────────
    console.log('[1] Testing Firecrawl Service (Mock / Fixture Mode)');
    const scrapeResult = await firecrawlService.scrapeUrl(APACHE_SOURCE.sourceUrl);
    assert(scrapeResult.success === true, 'scrapeUrl returns success:true');
    assert(typeof scrapeResult.markdown === 'string' && scrapeResult.markdown.length > 50, 'scrapeUrl returns non-empty markdown');
    assert(scrapeResult.url === APACHE_SOURCE.sourceUrl, 'scrapeUrl preserves source URL');

    // ─────────────────────────────────────────────────────
    // 2. Deterministic Parsers for Official Vendors
    // ─────────────────────────────────────────────────────
    console.log('\n[2] Testing Deterministic Parsers for Official Vendors');

    // 2a. Apache HTTP Server
    const apacheScrape = await firecrawlService.scrapeUrl(APACHE_SOURCE.sourceUrl);
    const apacheParsed = advisoryParser.parse(APACHE_SOURCE, apacheScrape.markdown);
    assert(Array.isArray(apacheParsed) && apacheParsed.length > 0,
      `Apache parser extracted ${apacheParsed.length} advisories`);

    const cve_38476 = apacheParsed.find(a => a.cveId === 'CVE-2024-38476');
    assert(!!cve_38476, 'Extracted CVE-2024-38476 from Apache fixture');
    if (cve_38476) {
      assert(!!cve_38476.severity, `Extracted Apache severity: ${cve_38476.severity}`);
      assert(Array.isArray(cve_38476.affectedProducts) && cve_38476.affectedProducts.length > 0,
        'Extracted affectedProducts list for Apache CVE');
      assert(cve_38476.affectedProducts[0].fixedVersion === '2.4.60',
        'Identified fixed version 2.4.60');
      assert(cve_38476.sourceName === 'Apache HTTP Server Security',
        'Attributed sourceName correctly');
      assert(typeof cve_38476.rawSourceText === 'string' && cve_38476.rawSourceText.length > 0,
        'Preserved rawSourceText for traceability');
    }

    // 2b. Node.js Security
    const nodeScrape = await firecrawlService.scrapeUrl(NODE_SOURCE.sourceUrl);
    const nodeParsed = advisoryParser.parse(NODE_SOURCE, nodeScrape.markdown);
    assert(Array.isArray(nodeParsed) && nodeParsed.length > 0,
      `Node.js parser extracted ${nodeParsed.length} advisories`);
    const cve_36138 = nodeParsed.find(a => a.cveId === 'CVE-2024-36138');
    assert(!!cve_36138, 'Extracted CVE-2024-36138 from Node.js fixture');

    // 2c. PHP Security
    const phpScrape = await firecrawlService.scrapeUrl(PHP_SOURCE.sourceUrl);
    const phpParsed = advisoryParser.parse(PHP_SOURCE, phpScrape.markdown);
    assert(Array.isArray(phpParsed) && phpParsed.length > 0,
      `PHP parser extracted ${phpParsed.length} advisories`);
    const cve_4577 = phpParsed.find(a => a.cveId === 'CVE-2024-4577');
    assert(!!cve_4577, 'Extracted CVE-2024-4577 from PHP fixture');
    if (cve_4577) {
      assert(cve_4577.severity === 'Critical', 'PHP CVE-2024-4577 severity is Critical');
      assert(cve_4577.affectedProducts[0].productName === 'PHP', 'PHP affected product name is correct');
    }

    // 2d. Amazon Linux Security
    const alasScrape = await firecrawlService.scrapeUrl(ALAS_SOURCE.sourceUrl);
    const alasParsed = advisoryParser.parse(ALAS_SOURCE, alasScrape.markdown);
    assert(Array.isArray(alasParsed) && alasParsed.length > 0,
      `ALAS parser extracted ${alasParsed.length} advisories`);
    assert(alasParsed[0].affectedProducts[0].productName === 'Amazon Linux',
      'ALAS affected product name is Amazon Linux');

    // ─────────────────────────────────────────────────────
    // 3. Advisory Collector Service & Postgres Persistence
    // ─────────────────────────────────────────────────────
    console.log('\n[3] Testing Advisory Collector Service & Postgres Persistence');

    const collectResult = await advisoryCollectorService.collectFromSource(APACHE_SOURCE);
    assert(collectResult.status === 'completed',
      `Single-source collection completed (status: ${collectResult.status})`);
    assert(typeof collectResult.itemsCollected === 'number' && collectResult.itemsCollected > 0,
      `Found ${collectResult.itemsCollected} advisories from Apache`);

    // Verify DB record via findAll
    const listByCve = await advisoryRepository.findAll({ cve: 'CVE-2024-38476', limit: 1 });
    assert(Array.isArray(listByCve.advisories) && listByCve.advisories.length > 0,
      'findAll by CVE-2024-38476 returns saved record from PostgreSQL');

    // ─────────────────────────────────────────────────────
    // 4. Batch Collection across configured sources
    // ─────────────────────────────────────────────────────
    console.log('\n[4] Testing Batch Collection Across All Configured Sources');

    const allResults = await advisoryCollectorService.collectAll();
    const sources = advisoryCollectorService.getSources();
    assert(allResults.length === sources.length,
      `collectAll ran across all ${sources.length} configured sources`);

    const allCompleted = allResults.every(r => r.status === 'completed');
    assert(allCompleted, 'All sources completed successfully');

    console.log('\n===========================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('===========================================\n');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('\nTest execution failed with unexpected error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

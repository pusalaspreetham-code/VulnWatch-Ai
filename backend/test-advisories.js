require('dotenv').config();
const pool = require('./src/db');
const firecrawlService = require('./src/services/firecrawl.service');
const advisoryParser = require('./src/services/advisory.parser');
const advisoryRepository = require('./src/repositories/advisory.repository');
const advisoryCollectorService = require('./src/services/advisory_collector.service');

// === SOURCE CONFIGS (mirror OFFICIAL_SOURCES in advisory_collector.service.js) ===
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
    // 1. Firecrawl Service — Mock Mode
    // ─────────────────────────────────────────────────────
    console.log('[1] Testing Firecrawl Service (Mock Mode)');
    const scrapeResult = await firecrawlService.scrapeUrl(APACHE_SOURCE.sourceUrl);
    assert(scrapeResult.success === true, 'scrapeUrl returns success:true in mock mode');
    assert(typeof scrapeResult.markdown === 'string' && scrapeResult.markdown.length > 50, 'scrapeUrl returns non-empty markdown');
    assert(scrapeResult.url === APACHE_SOURCE.sourceUrl, 'scrapeUrl preserves source URL');

    // ─────────────────────────────────────────────────────
    // 2. Deterministic Parsers
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
    if (cve_36138) {
      assert(cve_36138.severity === 'High', 'Node.js advisory has High severity');
      assert(cve_36138.affectedProducts[0].productName === 'Node.js',
        'Node.js affected product name correct');
    }

    // 2c. Ubuntu USN
    const ubuntuScrape = await firecrawlService.scrapeUrl(UBUNTU_SOURCE.sourceUrl);
    const ubuntuParsed = advisoryParser.parse(UBUNTU_SOURCE, ubuntuScrape.markdown);
    assert(Array.isArray(ubuntuParsed) && ubuntuParsed.length > 0,
      `Ubuntu parser extracted ${ubuntuParsed.length} notices`);

    const ubuntuNotice = ubuntuParsed[0];
    assert(!!ubuntuNotice.cveId || (ubuntuNotice.title && ubuntuNotice.title.includes('USN-')),
      'Ubuntu notice has CVE or USN identifier');
    assert(ubuntuNotice.sourceName === 'Ubuntu Security Notices',
      'Ubuntu source attributed correctly');

    // ─────────────────────────────────────────────────────
    // 3. Advisory Collector Service & Postgres Persistence
    // ─────────────────────────────────────────────────────
    console.log('\n[3] Testing Advisory Collector Service & Postgres Persistence');

    const collectResult = await advisoryCollectorService.collectFromSource(APACHE_SOURCE);
    assert(collectResult.status === 'completed',
      `Single-source collection completed (status: ${collectResult.status})`);
    assert(typeof collectResult.itemsCollected === 'number' && collectResult.itemsCollected > 0,
      `Found ${collectResult.itemsCollected} advisories from Apache`);
    assert(typeof collectResult.itemsNew === 'number',
      'itemsNew reported in result');

    // Verify DB record via findAll with CVE filter
    const listByCve = await advisoryRepository.findAll({ cve: 'CVE-2024-38476', limit: 1 });
    assert(Array.isArray(listByCve.advisories) && listByCve.advisories.length > 0,
      'findAll by CVE-2024-38476 returns saved record from PostgreSQL');
    if (listByCve.advisories.length > 0) {
      const record = listByCve.advisories[0];
      assert(record.source_name === 'Apache HTTP Server Security',
        `DB record has correct source_name: ${record.source_name}`);
    }

    // Verify affected products via findById
    if (listByCve.advisories.length > 0) {
      const full = await advisoryRepository.findById(listByCve.advisories[0].id);
      assert(!!full, 'findById returns the advisory record');
      assert(Array.isArray(full.affected_products) && full.affected_products.length > 0,
        'findById returns populated affected_products');
      assert(full.affected_products[0].fixed_version === '2.4.60',
        'DB affected_product contains correct fixed_version');
    }

    // ─────────────────────────────────────────────────────
    // 4. Deduplication / Idempotent Re-runs
    // ─────────────────────────────────────────────────────
    console.log('\n[4] Testing Deduplication & Re-collection Idempotency');

    const repeatResult = await advisoryCollectorService.collectFromSource(APACHE_SOURCE);
    assert(repeatResult.status === 'completed', 'Repeat collection completed successfully');
    assert(repeatResult.itemsNew === 0,
      `No new inserts on re-run (itemsNew=${repeatResult.itemsNew})`);
    assert(repeatResult.itemsUpdated >= 0, 'itemsUpdated reported correctly on re-run');

    // Confirm exactly 1 row for CVE-2024-38476 in DB
    const dupCheck = await pool.query(
      'SELECT COUNT(*)::int as count FROM advisories WHERE cve_id = $1',
      ['CVE-2024-38476']
    );
    assert(dupCheck.rows[0].count === 1,
      'PostgreSQL maintains exactly 1 record for CVE-2024-38476 after re-run');

    // ─────────────────────────────────────────────────────
    // 5. Audit Log — Advisory Collection Runs
    // ─────────────────────────────────────────────────────
    console.log('\n[5] Testing Advisory Collection Runs Audit Log');

    const runs = await advisoryRepository.getCollectionRuns({ limit: 10 });
    assert(Array.isArray(runs) && runs.length >= 2,
      `Retrieved ${runs.length} collection audit run records`);

    const latestRun = runs[0];
    assert(
      latestRun.status === 'completed' || latestRun.status === 'COMPLETED',
      `Latest audit run status is completed: ${latestRun.status}`
    );
    assert(!!latestRun.started_at, 'Audit run recorded started_at timestamp');
    assert(!!latestRun.source_name, `Audit run recorded source_name: ${latestRun.source_name}`);

    // ─────────────────────────────────────────────────────
    // 6. Advisory Filtering & Listing
    // ─────────────────────────────────────────────────────
    console.log('\n[6] Testing Advisory Filtering & Search');

    const apacheFilter = await advisoryRepository.findAll({ vendor: 'Apache', limit: 10 });
    assert(Array.isArray(apacheFilter.advisories) && apacheFilter.advisories.length > 0,
      `Filtered by vendor 'Apache' returned ${apacheFilter.advisories.length} records`);
    assert(typeof apacheFilter.total === 'number' && apacheFilter.total >= 1,
      `Total count reported: ${apacheFilter.total}`);

    const severityFilter = await advisoryRepository.findAll({ severity: 'Critical', limit: 10 });
    assert(Array.isArray(severityFilter.advisories),
      `Filtered by severity 'Critical' returned ${severityFilter.advisories.length} records`);

    const allAdvisories = await advisoryRepository.findAll({ limit: 50 });
    assert(allAdvisories.total >= 1, `Total advisories in DB: ${allAdvisories.total}`);

    // ─────────────────────────────────────────────────────
    // 7. Full Batch Collection Across All Sources
    // ─────────────────────────────────────────────────────
    console.log('\n[7] Testing Batch Collection Across All Configured Sources');

    const allResults = await advisoryCollectorService.collectAll();
    const sources = advisoryCollectorService.getSources();
    assert(allResults.length === sources.length,
      `collectAll ran across all ${sources.length} configured sources`);

    const allCompleted = allResults.every(r => r.status === 'completed');
    assert(allCompleted, 'All sources completed successfully in mock mode');

    for (const r of allResults) {
      assert(typeof r.itemsCollected === 'number',
        `Source '${r.sourceName}' returned itemsCollected: ${r.itemsCollected}`);
    }

    // ─────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────
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

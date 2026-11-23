process.env.FIRECRAWL_MOCK_MODE = 'true';
require('dotenv').config();
const pool = require('./src/db');
const matcherService = require('./src/services/matcher.service');
const matchRepository = require('./src/repositories/match.repository');
const advisoryCollectorService = require('./src/services/advisory_collector.service');

async function runTests() {
  console.log('\n===========================================');
  console.log('TEST SUITE: VULNERABILITY DETECTION & MATCHING');
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

  let testUserId;
  let testUser2Id;

  try {
    // Setup: create two isolated test users
    const u1 = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified) VALUES ($1, 'testhash', true) RETURNING id`,
      [`matchtest_u1_${Date.now()}@example.com`]
    );
    testUserId = u1.rows[0].id;

    const u2 = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified) VALUES ($1, 'testhash', true) RETURNING id`,
      [`matchtest_u2_${Date.now()}@example.com`]
    );
    testUser2Id = u2.rows[0].id;

    console.log(`Setup: created test users #${testUserId} and #${testUser2Id}`);

    // Populate advisories from configured official sources (Apache, Node, PHP)
    const sources = advisoryCollectorService.getSources();
    for (const src of sources) {
      await advisoryCollectorService.collectFromSource(src);
    }

    // ─────────────────────────────────────────────────────
    // 1. Exact Installed Version Matching: Vulnerable Range
    // ─────────────────────────────────────────────────────
    console.log('\n[1] Testing: Exact Installed Version in Vulnerable Range (Apache 2.4.52)');

    // Add vulnerable Apache HTTP Server (2.4.52 is within 2.4.0 through 2.4.59, fixed in 2.4.60)
    const si1 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, vendor, installed_version)
       VALUES ($1, 'Apache HTTP Server', 'Apache Software Foundation', '2.4.52')
       RETURNING id`,
      [testUserId]
    );
    const stackItemId1 = si1.rows[0].id;

    const result1 = await matcherService.runForUser(testUserId);
    assert(result1.stackItemsChecked >= 1, `stackItemsChecked = ${result1.stackItemsChecked}`);
    assert(result1.matchesFound >= 1, `Found ${result1.matchesFound} matches for Apache HTTP Server`);
    assert(result1.vulnerableCount >= 1, `Accurately identified ${result1.vulnerableCount} vulnerable advisory`);

    // Verify DB record status with search
    const { matches } = await matchRepository.findMatchesByUser(testUserId, { search: 'CVE-2024-38476' });
    assert(matches.length >= 1, 'Found match for CVE-2024-38476');
    const cve38476 = matches[0];
    if (cve38476) {
      assert(cve38476.status === 'vulnerable', `Version 2.4.52 correctly flagged as status='vulnerable' (got ${cve38476.status})`);
      assert(cve38476.match_reason.includes('vulnerable') || cve38476.match_reason.includes('affected range'),
        `Match reason explains vulnerability: ${cve38476.match_reason}`);
      assert(cve38476.fixed_version === '2.4.60', 'Identified fixed version 2.4.60');
    }

    // ─────────────────────────────────────────────────────
    // 2. Patched / Safe Version: Not Affected
    // ─────────────────────────────────────────────────────
    console.log('\n[2] Testing: Patched Installed Version (Apache 2.4.62 is >= fixed 2.4.60)');

    // Update Apache installed version to 2.4.62 (patched)
    await pool.query(
      `UPDATE stack_items SET installed_version = '2.4.62' WHERE id = $1`,
      [stackItemId1]
    );

    await matcherService.runForUser(testUserId);
    const { matches: matchesAfterPatch } = await matchRepository.findMatchesByUser(testUserId, { search: 'CVE-2024-38476' });
    assert(matchesAfterPatch.length >= 1, 'Match record preserved for CVE-2024-38476');
    const cvePatched = matchesAfterPatch[0];
    if (cvePatched) {
      assert(cvePatched.status === 'not_affected', `Patched version 2.4.62 correctly evaluated as status='not_affected' (got ${cvePatched.status})`);
      assert(cvePatched.match_reason.includes('patched') || cvePatched.match_reason.includes('higher'),
        `Match reason explains patched status: ${cvePatched.match_reason}`);
    }

    // ─────────────────────────────────────────────────────
    // 3. PHP Vulnerability Matching (CVE-2024-4577)
    // ─────────────────────────────────────────────────────
    console.log('\n[3] Testing: PHP Vulnerability Detection (PHP 8.1.0 vs CVE-2024-4577)');

    // Add PHP 8.1.0 to stack
    const si2 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, vendor, installed_version)
       VALUES ($1, 'PHP', 'The PHP Group', '8.1.0')
       RETURNING id`,
      [testUserId]
    );

    await matcherService.runForUser(testUserId);
    const { matches: phpMatches } = await matchRepository.findMatchesByUser(testUserId, { search: 'CVE-2024-4577' });
    assert(phpMatches.length >= 1, 'Found PHP match for CVE-2024-4577');
    const cve4577 = phpMatches[0];
    if (cve4577) {
      assert(cve4577.status === 'vulnerable', `PHP 8.1.0 correctly flagged as 'vulnerable' (got ${cve4577.status})`);
      assert(cve4577.severity === 'Critical', 'PHP CVE-2024-4577 severity is Critical');
    }

    // ─────────────────────────────────────────────────────
    // 4. Coverage Report: Supported vs Unsupported Feeds
    // ─────────────────────────────────────────────────────
    console.log('\n[4] Testing: Stack Coverage Report (Supported vs Unsupported Feeds)');

    // Add an unsupported product (SQLite - no advisory feed configured)
    await pool.query(
      `INSERT INTO stack_items (user_id, product_name, vendor, installed_version)
       VALUES ($1, 'SQLite', 'SQLite Development Team', '3.45.0')`,
      [testUserId]
    );

    const coverage = await matcherService.getCoverageReport(testUserId);
    assert(coverage.summary.totalMonitored >= 3, `Total monitored items in coverage: ${coverage.summary.totalMonitored}`);
    assert(coverage.summary.supportedCount >= 2, `Supported items count: ${coverage.summary.supportedCount}`);
    assert(coverage.summary.unsupportedCount >= 1, `Unsupported items count: ${coverage.summary.unsupportedCount}`);

    const sqliteItem = coverage.items.find(i => i.productName === 'SQLite');
    assert(!!sqliteItem, 'Found SQLite in coverage items');
    if (sqliteItem) {
      assert(sqliteItem.isSupported === false, 'SQLite correctly classified as unsupported feed');
      assert(sqliteItem.healthStatus === 'unsupported', 'SQLite healthStatus is unsupported');
    }

    const phpItem = coverage.items.find(i => i.productName === 'PHP');
    assert(!!phpItem, 'Found PHP in coverage items');
    if (phpItem) {
      assert(phpItem.isSupported === true, 'PHP correctly classified as supported feed');
      assert(phpItem.healthStatus === 'vulnerable', 'PHP healthStatus is vulnerable');
    }

    // ─────────────────────────────────────────────────────
    // 5. User Isolation & Status Updates
    // ─────────────────────────────────────────────────────
    console.log('\n[5] Testing: User Isolation and Status Management');

    // User 2 has 0 matches
    const u2Matches = await matchRepository.findMatchesByUser(testUser2Id);
    assert(u2Matches.total === 0, `User 2 has 0 matches (got ${u2Matches.total}) - strict user isolation`);

    // User 1 updates match status to confirmed
    if (cve4577) {
      const updateRes = await matchRepository.updateMatchStatus(cve4577.id, testUserId, 'confirmed', 'Confirmed by Security Lead');
      assert(!!updateRes, 'Status update returned success');
      assert(updateRes.status === 'confirmed', `Status updated to 'confirmed' (got ${updateRes.status})`);

      // Verify audit history
      const hist = await pool.query(
        `SELECT review_status, notes FROM review_history WHERE match_id = $1 AND user_id = $2`,
        [cve4577.id, testUserId]
      );
      assert(hist.rows.length >= 1, 'Audit record persisted in review_history');
      assert(hist.rows[0].review_status === 'confirmed', 'Audit record status is confirmed');
    }

    console.log('\n===========================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('===========================================\n');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('\nTest execution failed with unexpected error:', err);
    process.exit(1);
  } finally {
    if (testUserId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    }
    if (testUser2Id) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUser2Id]);
    }
    await pool.end();
  }
}

runTests();

require('dotenv').config();
const pool = require('./src/db');
const matcherService = require('./src/services/matcher.service');
const matchRepository = require('./src/repositories/match.repository');

async function runTest() {
  console.log('\n======================================================');
  console.log('TEST SUITE: PRODUCT SCAN TARGETS, DEDUPLICATION & DASHBOARD TOTALS');
  console.log('======================================================\n');

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

  try {
    // 0. Setup isolated test user
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified) 
       VALUES ($1, 'test_hash', true) RETURNING id`,
      [`scan_target_test_${Date.now()}@example.com`]
    );
    testUserId = userRes.rows[0].id;
    console.log(`Created test user #${testUserId}`);

    // ──────────────────────────────────────────────────────────
    // 1. Monitor Three Distinct Products
    // ──────────────────────────────────────────────────────────
    console.log('\n[1] Testing: Monitored Products as Distinct Scan Targets');

    const p1 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, canonical_name, vendor, ecosystem, installed_version)
       VALUES ($1, 'Docker Engine', 'Docker Engine', 'Docker Inc.', 'Container / Go', '24.0.9')
       RETURNING id`,
      [testUserId]
    );
    const dockerStackId = p1.rows[0].id;

    const p2 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, canonical_name, vendor, ecosystem, installed_version)
       VALUES ($1, 'Python', 'Python', 'Python Software Foundation', 'PyPI', '3.12.0')
       RETURNING id`,
      [testUserId]
    );
    const pythonStackId = p2.rows[0].id;

    const p3 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, canonical_name, vendor, ecosystem, installed_version)
       VALUES ($1, 'PHP', 'PHP', 'The PHP Group', 'Packagist', '8.1.0')
       RETURNING id`,
      [testUserId]
    );
    const phpStackId = p3.rows[0].id;

    // Verify 3 distinct scan targets returned
    const targetsInitial = await matcherService.getProductScanTargets(testUserId);
    assert(targetsInitial.products.length === 3, `Expected 3 product scan targets, got ${targetsInitial.products.length}`);
    assert(targetsInitial.products.some(p => p.id === dockerStackId && p.productName === 'Docker Engine'), 'Docker Engine is a distinct scan target');
    assert(targetsInitial.products.some(p => p.id === pythonStackId && p.productName === 'Python'), 'Python is a distinct scan target');
    assert(targetsInitial.products.some(p => p.id === phpStackId && p.productName === 'PHP'), 'PHP is a distinct scan target');

    // ──────────────────────────────────────────────────────────
    // 2. Duplicate Advisories Deduplication & Vendor Sources
    // ──────────────────────────────────────────────────────────
    console.log('\n[2] Testing: Duplicate Advisory Deduplication by Underlying CVE');

    // Insert Advisory 1: OSV Feed for CVE-2024-21626
    const adv1 = await pool.query(
      `INSERT INTO advisories (source_name, source_advisory_id, cve_id, title, description, severity, source_url)
       VALUES ('OSV', 'GHSA-test-docker-1', 'CVE-2024-21626', 'runc container breakout in Docker Engine', 'A container breakout vulnerability in runc', 'Critical', 'https://osv.dev/vulnerability/GHSA-test-docker-1')
       RETURNING id`
    );
    const adv1Id = adv1.rows[0].id;

    const aff1 = await pool.query(
      `INSERT INTO affected_products (advisory_id, product_name, vendor, affected_versions_raw, fixed_version)
       VALUES ($1, 'Docker Engine', 'Docker Inc.', '<= 24.0.9', '25.0.3')
       RETURNING id`,
      [adv1Id]
    );
    const aff1Id = aff1.rows[0].id;

    // Insert Advisory 2: Vendor / Ubuntu Notice for the SAME CVE-2024-21626
    const adv2 = await pool.query(
      `INSERT INTO advisories (source_name, source_advisory_id, cve_id, title, description, severity, source_url)
       VALUES ('Ubuntu USN', 'USN-6600-1', 'CVE-2024-21626', 'Ubuntu USN runc vulnerability in docker', 'Ubuntu security notice for runc', 'Critical', 'https://ubuntu.com/security/notices/USN-6600-1')
       RETURNING id`
    );
    const adv2Id = adv2.rows[0].id;

    const aff2 = await pool.query(
      `INSERT INTO affected_products (advisory_id, product_name, vendor, affected_versions_raw, fixed_version)
       VALUES ($1, 'Docker Engine', 'Docker Inc.', '>= 20.10.0, <= 24.0.9', '25.0.3')
       RETURNING id`,
      [adv2Id]
    );
    const aff2Id = aff2.rows[0].id;

    // Also insert a Medium vulnerability for Python: CVE-2024-1234
    const advPy = await pool.query(
      `INSERT INTO advisories (source_name, source_advisory_id, cve_id, title, description, severity, source_url)
       VALUES ('PyPI / PSF', 'PSF-2024-01', 'CVE-2024-1234', 'Denial of service in Python urlparse', 'Improper input validation in Python', 'Medium', 'https://python.org/security/CVE-2024-1234')
       RETURNING id`
    );
    const advPyId = advPy.rows[0].id;

    const affPy = await pool.query(
      `INSERT INTO affected_products (advisory_id, product_name, vendor, affected_versions_raw, fixed_version)
       VALUES ($1, 'Python', 'Python Software Foundation', '< 3.12.2', '3.12.2')
       RETURNING id`,
      [advPyId]
    );
    const affPyId = affPy.rows[0].id;

    // Also insert an uncertain / needs_review advisory for PHP
    const advPhp = await pool.query(
      `INSERT INTO advisories (source_name, source_advisory_id, cve_id, title, description, severity, source_url)
       VALUES ('PHP Advisory', 'SEC-PHP-01', 'CVE-2024-5555', 'Potential buffer overrun in PHP GD', 'Uncertain version range', 'High', 'https://php.net/security')
       RETURNING id`
    );
    const advPhpId = advPhp.rows[0].id;

    const affPhp = await pool.query(
      `INSERT INTO affected_products (advisory_id, product_name, vendor, affected_versions_raw, fixed_version)
       VALUES ($1, 'PHP', 'The PHP Group', 'custom-branch-only', NULL)
       RETURNING id`,
      [advPhpId]
    );
    const affPhpId = affPhp.rows[0].id;

    // ──────────────────────────────────────────────────────────
    // 3. Database Persistence of Matches
    // ──────────────────────────────────────────────────────────
    console.log('\n[3] Testing: Database Persistence in PostgreSQL matches table');

    // Persist matches into PostgreSQL matches table
    await matchRepository.upsertMatch({
      userId: testUserId,
      stackItemId: dockerStackId,
      affectedProductId: aff1Id,
      status: 'vulnerable',
      matchReason: 'Installed version 24.0.9 is <= 24.0.9 (fixed in 25.0.3)'
    });

    await matchRepository.upsertMatch({
      userId: testUserId,
      stackItemId: dockerStackId,
      affectedProductId: aff2Id,
      status: 'vulnerable',
      matchReason: 'Installed version 24.0.9 is within 20.10.0 to 24.0.9 (fixed in 25.0.3)'
    });

    await matchRepository.upsertMatch({
      userId: testUserId,
      stackItemId: pythonStackId,
      affectedProductId: affPyId,
      status: 'vulnerable',
      matchReason: 'Installed version 3.12.0 is < 3.12.2'
    });

    await matchRepository.upsertMatch({
      userId: testUserId,
      stackItemId: phpStackId,
      affectedProductId: affPhpId,
      status: 'needs_review',
      matchReason: 'Non-standard version format requires manual analyst verification'
    });

    // Check DB directly: 4 records exist in PostgreSQL
    const dbCheck = await pool.query(
      `SELECT count(*)::int as count FROM matches WHERE user_id = $1`,
      [testUserId]
    );
    assert(dbCheck.rows[0].count === 4, `PostgreSQL stores all 4 match records (got ${dbCheck.rows[0].count})`);

    // Verify deduplication in getProductScanTargets
    const targetsWithMatches = await matcherService.getProductScanTargets(testUserId);
    const dockerTarget = targetsWithMatches.products.find(p => p.id === dockerStackId);
    assert(dockerTarget !== undefined, 'Found Docker Engine scan target');
    assert(dockerTarget.vulnerabilityCount === 1, `Docker Engine vulnerabilityCount = 1 (deduplicated), got ${dockerTarget.vulnerabilityCount}`);
    assert(dockerTarget.vulnerabilities.length === 1, `Docker Engine has exactly 1 deduplicated vulnerability object, got ${dockerTarget.vulnerabilities.length}`);
    
    const vuln = dockerTarget.vulnerabilities[0];
    assert(vuln.cveId === 'CVE-2024-21626', `Vulnerability is CVE-2024-21626`);
    assert(vuln.sources.length === 2, `Retains both vendor sources (OSV & Ubuntu USN), got ${vuln.sources.length}`);
    assert(vuln.sources.some(s => s.sourceName === 'OSV'), 'Includes OSV source');
    assert(vuln.sources.some(s => s.sourceName === 'Ubuntu USN'), 'Includes Ubuntu USN source');

    const pythonTarget = targetsWithMatches.products.find(p => p.id === pythonStackId);
    assert(pythonTarget.vulnerabilityCount === 1, `Python vulnerabilityCount = 1, got ${pythonTarget.vulnerabilityCount}`);
    assert(pythonTarget.severityBreakdown.medium === 1, 'Python has 1 Medium severity vulnerability');

    const phpTarget = targetsWithMatches.products.find(p => p.id === phpStackId);
    assert(phpTarget.vulnerabilityCount === 0, `PHP confirmed vulnerabilityCount = 0, got ${phpTarget.vulnerabilityCount}`);
    assert(phpTarget.needsReviewCount === 1, `PHP needsReviewCount = 1, got ${phpTarget.needsReviewCount}`);
    assert(phpTarget.healthStatus === 'needs_review', `PHP healthStatus is 'needs_review', got ${phpTarget.healthStatus}`);

    // ──────────────────────────────────────────────────────────
    // 4. Dashboard Totals Consistency
    // ──────────────────────────────────────────────────────────
    console.log('\n[4] Testing: Dashboard Totals Equal Exact Sum of Product Results');

    const summary = targetsWithMatches.summary;
    const sumProductVulns = targetsWithMatches.products.reduce((acc, p) => acc + p.vulnerabilityCount, 0);
    const sumProductCritical = targetsWithMatches.products.reduce((acc, p) => acc + p.severityBreakdown.critical, 0);
    const sumProductHigh = targetsWithMatches.products.reduce((acc, p) => acc + p.severityBreakdown.high, 0);
    const sumProductMedium = targetsWithMatches.products.reduce((acc, p) => acc + p.severityBreakdown.medium, 0);
    const sumProductLow = targetsWithMatches.products.reduce((acc, p) => acc + p.severityBreakdown.low, 0);
    const sumProductNeedsReview = targetsWithMatches.products.reduce((acc, p) => acc + p.needsReviewCount, 0);

    assert(summary.total === sumProductVulns, `summary.total (${summary.total}) === sum(product.vulnerabilityCount) (${sumProductVulns})`);
    assert(summary.critical === sumProductCritical, `summary.critical (${summary.critical}) === sum(product.critical) (${sumProductCritical})`);
    assert(summary.high === sumProductHigh, `summary.high (${summary.high}) === sum(product.high) (${sumProductHigh})`);
    assert(summary.medium === sumProductMedium, `summary.medium (${summary.medium}) === sum(product.medium) (${sumProductMedium})`);
    assert(summary.low === sumProductLow, `summary.low (${summary.low}) === sum(product.low) (${sumProductLow})`);
    assert(summary.needsReview === sumProductNeedsReview, `summary.needsReview (${summary.needsReview}) === sum(product.needsReviewCount) (${sumProductNeedsReview})`);
    assert(summary.total === 2, `Confirmed total is exactly 2 (Docker: 1 + Python: 1), got ${summary.total}`);
    assert(summary.needsReview === 1, `Needs review total is 1 (PHP: 1), strictly not added to confirmed total`);

    // ──────────────────────────────────────────────────────────
    // 5. Version Change and Rescanning
    // ──────────────────────────────────────────────────────────
    console.log('\n[5] Testing: Version Change, Rescanning & Refresh');

    // Upgrade Docker Engine to 25.0.3 (patched for CVE-2024-21626)
    await pool.query(
      `UPDATE stack_items SET installed_version = '25.0.3' WHERE id = $1`,
      [dockerStackId]
    );

    // Re-run matching for user
    const rescanResult = await matcherService.runForUser(testUserId);
    assert(rescanResult !== null, 'Rescan executed successfully');

    // Verify stored matches for CVE-2024-21626 in PostgreSQL were updated to not_affected
    const updatedDockerMatches = await pool.query(
      `SELECT status FROM matches WHERE stack_item_id = $1 AND affected_product_id IN ($2, $3)`,
      [dockerStackId, aff1Id, aff2Id]
    );
    assert(
      updatedDockerMatches.rows.length === 2 && updatedDockerMatches.rows.every(r => r.status === 'not_affected'),
      'Database matches for CVE-2024-21626 updated to not_affected in PostgreSQL for patched version 25.0.3'
    );

    // Fetch updated scan targets
    const rescannedTargets = await matcherService.getProductScanTargets(testUserId);
    const rescannedDocker = rescannedTargets.products.find(p => p.id === dockerStackId);
    assert(rescannedDocker.installedVersion === '25.0.3', `Docker Engine version updated to 25.0.3 in scan target (got ${rescannedDocker.installedVersion})`);
    assert(!rescannedDocker.vulnerabilities.some(v => v.cveId === 'CVE-2024-21626'), 'Patched CVE-2024-21626 no longer appears in confirmed vulnerabilities');
    assert(rescannedDocker.notAffected.some(v => v.cveId === 'CVE-2024-21626'), 'Patched CVE-2024-21626 moved to notAffected list in scan targets');

    // Verify that dashboard totals still strictly equal the sum of displayed product scan targets
    const rescannedSumVulns = rescannedTargets.products.reduce((acc, p) => acc + p.vulnerabilityCount, 0);
    const rescannedSumCritical = rescannedTargets.products.reduce((acc, p) => acc + p.severityBreakdown.critical, 0);
    const rescannedSumHigh = rescannedTargets.products.reduce((acc, p) => acc + p.severityBreakdown.high, 0);
    const rescannedSumMedium = rescannedTargets.products.reduce((acc, p) => acc + p.severityBreakdown.medium, 0);
    const rescannedSumLow = rescannedTargets.products.reduce((acc, p) => acc + p.severityBreakdown.low, 0);
    const rescannedSumNeedsReview = rescannedTargets.products.reduce((acc, p) => acc + p.needsReviewCount, 0);

    assert(rescannedTargets.summary.total === rescannedSumVulns, `Rescanned summary.total (${rescannedTargets.summary.total}) === sum(product.vulnerabilityCount) (${rescannedSumVulns})`);
    assert(rescannedTargets.summary.critical === rescannedSumCritical, `Rescanned summary.critical (${rescannedTargets.summary.critical}) === sum(product.critical) (${rescannedSumCritical})`);
    assert(rescannedTargets.summary.high === rescannedSumHigh, `Rescanned summary.high (${rescannedTargets.summary.high}) === sum(product.high) (${rescannedSumHigh})`);
    assert(rescannedTargets.summary.medium === rescannedSumMedium, `Rescanned summary.medium (${rescannedTargets.summary.medium}) === sum(product.medium) (${rescannedSumMedium})`);
    assert(rescannedTargets.summary.low === rescannedSumLow, `Rescanned summary.low (${rescannedTargets.summary.low}) === sum(product.low) (${rescannedSumLow})`);
    assert(rescannedTargets.summary.needsReview === rescannedSumNeedsReview, `Rescanned summary.needsReview (${rescannedTargets.summary.needsReview}) === sum(product.needsReviewCount) (${rescannedSumNeedsReview})`);

    console.log('\nCleaning up test data...');
    await pool.query(`DELETE FROM matches WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM stack_items WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM affected_products WHERE advisory_id IN ($1, $2, $3, $4)`, [adv1Id, adv2Id, advPyId, advPhpId]);
    await pool.query(`DELETE FROM advisories WHERE id IN ($1, $2, $3, $4)`, [adv1Id, adv2Id, advPyId, advPhpId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);

    console.log(`\n======================================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    if (testUserId) {
      try {
        await pool.query(`DELETE FROM matches WHERE user_id = $1`, [testUserId]);
        await pool.query(`DELETE FROM stack_items WHERE user_id = $1`, [testUserId]);
        await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
      } catch (e) {}
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();

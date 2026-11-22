require('dotenv').config();
const pool = require('./src/db');
const matcherService = require('./src/services/matcher.service');
const matchRepository = require('./src/repositories/match.repository');
const advisoryCollectorService = require('./src/services/advisory_collector.service');

async function runTests() {
  console.log('\n===========================================');
  console.log('TEST SUITE: VULNERABILITY MATCHING');
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
    // Setup: create two isolated test users and a stack
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

    // Ensure advisories exist (use mock collection)
    const sources = advisoryCollectorService.getSources();
    const apacheSource = sources.find(s => s.id === 'apache-httpd');
    await advisoryCollectorService.collectFromSource(apacheSource);

    // Verify advisory exists
    const advisoryCheck = await pool.query(
      `SELECT a.id, ap.id as ap_id, ap.product_name 
       FROM advisories a 
       JOIN affected_products ap ON ap.advisory_id = a.id 
       LIMIT 1`
    );
    assert(advisoryCheck.rows.length > 0, 'Advisory and affected_product records exist in DB');

    const affectedProductName = advisoryCheck.rows[0].product_name;
    console.log(`  Advisory affected product: "${affectedProductName}"`);

    // ─────────────────────────────────────────────────────
    // 1. Stack with matching product — should produce matches
    // ─────────────────────────────────────────────────────
    console.log('\n[1] Testing: Stack item matching an advisory affected product');

    // Add Apache HTTP Server to user 1's stack
    const si1 = await pool.query(
      `INSERT INTO stack_items (user_id, product_name, vendor, installed_version)
       VALUES ($1, 'Apache HTTP Server', 'Apache Software Foundation', '2.4.52')
       RETURNING id`,
      [testUserId]
    );
    const stackItemId = si1.rows[0].id;

    const result1 = await matcherService.runForUser(testUserId);
    assert(result1.stackItemsChecked >= 1, `stackItemsChecked = ${result1.stackItemsChecked}`);
    assert(result1.matchesFound >= 1, `Found ${result1.matchesFound} matches for Apache HTTP Server`);
    assert(result1.matchesNew >= 1, `${result1.matchesNew} new match records inserted`);

    // ─────────────────────────────────────────────────────
    // 2. Database persistence
    // ─────────────────────────────────────────────────────
    console.log('\n[2] Testing: Match persistence in PostgreSQL');

    const { matches, total } = await matchRepository.findMatchesByUser(testUserId);
    assert(total >= 1, `findMatchesByUser returns total >= 1 (got ${total})`);
    assert(matches.length >= 1, `findMatchesByUser returns ${matches.length} match rows`);

    const m = matches[0];
    assert(m.stack_item_id === stackItemId, 'Match linked to correct stack_item_id');
    assert(m.status === 'potential_match', `Initial status is 'potential_match' (got ${m.status})`);
    assert(typeof m.advisory_id === 'number' || typeof m.advisory_id === 'string', 'Match has advisory_id');
    assert(!!m.cve_id || !!m.advisory_title, 'Match includes CVE or advisory title');
    assert(!!m.match_reason && m.match_reason.includes('↔'), 'match_reason explains the pairing');
    assert(!!m.affected_product_name, 'Match includes affected_product_name');
    assert(!!m.installed_version, 'Match includes installed_version from stack item');

    // ─────────────────────────────────────────────────────
    // 3. findMatchById — ownership check
    // ─────────────────────────────────────────────────────
    console.log('\n[3] Testing: findMatchById with ownership enforcement');

    const matchId = m.id;
    const foundById = await matchRepository.findMatchById(matchId, testUserId);
    assert(!!foundById, 'findMatchById returns match for correct owner');
    assert(foundById.id === matchId, 'findMatchById returns correct match ID');

    const notFoundById = await matchRepository.findMatchById(matchId, testUser2Id);
    assert(notFoundById === null, 'findMatchById returns null for wrong user (isolation enforced)');

    // ─────────────────────────────────────────────────────
    // 4. Status filtering
    // ─────────────────────────────────────────────────────
    console.log('\n[4] Testing: Status filter on findMatchesByUser');

    const potentialMatches = await matchRepository.findMatchesByUser(testUserId, { status: 'potential_match' });
    assert(potentialMatches.matches.length >= 1, `Filter by 'potential_match' returns ${potentialMatches.matches.length} records`);

    const confirmedMatches = await matchRepository.findMatchesByUser(testUserId, { status: 'confirmed' });
    assert(confirmedMatches.matches.length === 0, 'Filter by confirmed returns 0 (none confirmed yet)');

    // ─────────────────────────────────────────────────────
    // 5. Update match status + review_history audit
    // ─────────────────────────────────────────────────────
    console.log('\n[5] Testing: Status update and review_history audit trail');

    const updated = await matchRepository.updateMatchStatus(matchId, testUserId, 'confirmed', 'Confirmed affected version');
    assert(!!updated, 'updateMatchStatus returns updated record');
    assert(updated.id === matchId, 'updateMatchStatus returns correct match ID');

    const afterUpdate = await matchRepository.findMatchById(matchId, testUserId);
    assert(afterUpdate.status === 'confirmed', `Status updated to 'confirmed' (got ${afterUpdate.status})`);

    // Verify review_history row was written
    const histCheck = await pool.query(
      `SELECT review_status, notes FROM review_history WHERE match_id = $1 AND user_id = $2`,
      [matchId, testUserId]
    );
    assert(histCheck.rows.length >= 1, 'review_history row inserted after status update');
    assert(histCheck.rows[0].review_status === 'confirmed', `review_history status = 'confirmed'`);
    assert(histCheck.rows[0].notes === 'Confirmed affected version', 'review_history notes preserved');

    // Wrong user cannot update
    const wrongUpdate = await matchRepository.updateMatchStatus(matchId, testUser2Id, 'dismissed', null);
    assert(wrongUpdate === null, 'updateMatchStatus returns null for wrong user (isolation)');

    // ─────────────────────────────────────────────────────
    // 6. Summary counts for dashboard
    // ─────────────────────────────────────────────────────
    console.log('\n[6] Testing: getMatchSummaryForUser for dashboard card');

    // Reset to potential_match for summary test
    await matchRepository.updateMatchStatus(matchId, testUserId, 'potential_match', null);

    const summary = await matchRepository.getMatchSummaryForUser(testUserId);
    assert(typeof summary.total === 'number', `Summary total is a number: ${summary.total}`);
    assert(summary.total >= 1, `Summary total >= 1 (got ${summary.total})`);
    assert(typeof summary.critical === 'number', 'Summary has critical field');
    assert(typeof summary.high === 'number', 'Summary has high field');
    assert(typeof summary.medium === 'number', 'Summary has medium field');
    assert(typeof summary.low === 'number', 'Summary has low field');

    const user2Summary = await matchRepository.getMatchSummaryForUser(testUser2Id);
    assert(user2Summary.total === 0, `User 2 summary total = 0 (user isolation in summary)`);

    // ─────────────────────────────────────────────────────
    // 7. User isolation — user 2 stack has no matches
    // ─────────────────────────────────────────────────────
    console.log('\n[7] Testing: User isolation — user 2 sees no matches');

    const { matches: u2Matches } = await matchRepository.findMatchesByUser(testUser2Id);
    assert(u2Matches.length === 0, `User 2 has 0 matches (got ${u2Matches.length}) — user isolation`);

    // ─────────────────────────────────────────────────────
    // 8. Idempotency — re-run matching produces no new duplicates
    // ─────────────────────────────────────────────────────
    console.log('\n[8] Testing: Idempotent re-runs');

    const result2 = await matcherService.runForUser(testUserId);
    assert(result2.matchesNew === 0, `Re-run inserts 0 new matches (got ${result2.matchesNew})`);
    assert(result2.matchesExisting >= 1, `Re-run updates ${result2.matchesExisting} existing matches`);

    const dupCheck = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM matches WHERE user_id = $1 AND stack_item_id = $2`,
      [testUserId, stackItemId]
    );
    assert(dupCheck.rows[0].cnt === result1.matchesFound,
      `No duplicate rows — count still ${dupCheck.rows[0].cnt}`);

    // ─────────────────────────────────────────────────────
    // 9. Stack item with no advisory match
    // ─────────────────────────────────────────────────────
    console.log('\n[9] Testing: Stack item with no matching advisory product');

    await pool.query(
      `INSERT INTO stack_items (user_id, product_name, vendor, installed_version)
       VALUES ($1, 'AcmeInHouseApp', 'Acme Corp', '3.0.0')`,
      [testUserId]
    );

    const result3 = await matcherService.runForUser(testUserId);
    assert(result3.stackItemsChecked >= 2, `Checked ${result3.stackItemsChecked} stack items`);
    // AcmeInHouseApp won't match anything — total matches should be same as before
    assert(result3.matchesFound === result1.matchesFound,
      `Unrecognised product produces no extra matches (found ${result3.matchesFound})`);

    console.log('\n===========================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('===========================================\n');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('\nTest execution failed with unexpected error:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
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

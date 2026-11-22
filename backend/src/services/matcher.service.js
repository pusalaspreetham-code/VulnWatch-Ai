const pool = require('../db');
const matchRepository = require('../repositories/match.repository');

/**
 * Normalize a product name for comparison:
 * lowercase, strip punctuation/extra spaces, collapse whitespace.
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
 * Returns true when two normalized product names are considered a match.
 * Rules (all deterministic — no AI):
 *   1. Exact match after normalization.
 *   2. One name contains the other (at least 4 chars).
 *   3. First significant word matches and both names share ≥2 words.
 */
function namesMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;

  // Exact
  if (na === nb) return true;

  // Containment (minimum 4 chars to avoid noise like "php" ↔ "graphql")
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }

  // First-word + shared tokens
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  if (wordsA[0] === wordsB[0] && wordsA[0].length >= 3) {
    const setA = new Set(wordsA);
    const shared = wordsB.filter(w => setA.has(w) && w.length >= 3);
    if (shared.length >= 2) return true;
  }

  return false;
}

class MatcherService {
  /**
   * Run matching for a single user.
   * Loads their stack items and all affected products, then upserts matches.
   * Returns a summary: { matchesFound, matchesNew, matchesExisting, stackItemsChecked }
   */
  async runForUser(userId) {
    console.log(`[MATCHER] Running vulnerability matching for user #${userId}`);

    // 1. Load user's stack items
    const stackResult = await pool.query(
      `SELECT id, product_name, vendor, installed_version FROM stack_items WHERE user_id = $1`,
      [userId]
    );
    const stackItems = stackResult.rows;

    if (stackItems.length === 0) {
      console.log(`[MATCHER] User #${userId} has no stack items — skipping.`);
      return { matchesFound: 0, matchesNew: 0, matchesExisting: 0, stackItemsChecked: 0 };
    }

    // 2. Load all affected products with their advisory id
    const apResult = await pool.query(
      `SELECT ap.id, ap.product_name, ap.vendor, ap.advisory_id
       FROM affected_products ap
       JOIN advisories a ON a.id = ap.advisory_id`
    );
    const affectedProducts = apResult.rows;

    if (affectedProducts.length === 0) {
      console.log(`[MATCHER] No affected products in DB — skipping.`);
      return { matchesFound: 0, matchesNew: 0, matchesExisting: 0, stackItemsChecked: stackItems.length };
    }

    let matchesFound = 0;
    let matchesNew = 0;
    let matchesExisting = 0;

    // 3. Compare every (stack item × affected product) pair
    for (const si of stackItems) {
      for (const ap of affectedProducts) {
        if (namesMatch(si.product_name, ap.product_name)) {
          const reason = `Product name match: "${si.product_name}" ↔ "${ap.product_name}" (advisory affected product)`;
          matchesFound++;

          const record = await matchRepository.upsertMatch({
            userId,
            stackItemId: si.id,
            affectedProductId: ap.id,
            matchReason: reason,
          });

          if (record.is_new) matchesNew++;
          else matchesExisting++;
        }
      }
    }

    // 4. Clean any stale matches where the stack item was deleted
    const cleaned = await matchRepository.cleanStaleMatches(userId);
    if (cleaned > 0) {
      console.log(`[MATCHER] Cleaned ${cleaned} stale matches for user #${userId}`);
    }

    console.log(`[MATCHER] User #${userId}: ${matchesFound} matches found, ${matchesNew} new, ${matchesExisting} existing`);

    return {
      matchesFound,
      matchesNew,
      matchesExisting,
      stackItemsChecked: stackItems.length,
    };
  }

  /**
   * Run matching for ALL users (for use after advisory collection).
   */
  async runForAllUsers() {
    const result = await pool.query(`SELECT DISTINCT user_id FROM stack_items`);
    const userIds = result.rows.map(r => r.user_id);

    console.log(`[MATCHER] Running for ${userIds.length} users with stack items.`);
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

const pool = require('../db');

class MatchRepository {
  /**
   * Upsert a match record.
   * If (stack_item_id, affected_product_id) already exists, update status & match_reason,
   * while preserving human analyst overrides ('confirmed', 'dismissed').
   */
  async upsertMatch({ userId, stackItemId, affectedProductId, status = 'potential_match', matchReason }) {
    const query = `
      INSERT INTO matches (user_id, stack_item_id, affected_product_id, status, match_reason, last_checked_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
      ON CONFLICT (stack_item_id, affected_product_id) DO UPDATE SET
        status = CASE 
          WHEN matches.status IN ('confirmed', 'dismissed') THEN matches.status
          ELSE EXCLUDED.status
        END,
        match_reason    = EXCLUDED.match_reason,
        last_checked_at = NOW(),
        updated_at      = NOW()
      RETURNING id, (xmax = 0) AS is_new, status;
    `;
    const result = await pool.query(query, [userId, stackItemId, affectedProductId, status, matchReason]);
    return result.rows[0];
  }

  /**
   * List all matches for a user, joined with advisory and stack item details.
   * Optionally filter by status, severity, or search query.
   */
  async findMatchesByUser(userId, { status = '', severity = '', search = '', limit = 100, offset = 0 } = {}) {
    const params = [userId];
    const clauses = ['m.user_id = $1'];

    if (status && status.trim()) {
      params.push(status.trim());
      clauses.push(`m.status = $${params.length}`);
    }

    if (severity && severity.trim()) {
      params.push(severity.trim());
      clauses.push(`LOWER(a.severity) = LOWER($${params.length})`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      clauses.push(`(
        LOWER(a.title) LIKE $${pIdx} OR
        LOWER(COALESCE(a.cve_id, '')) LIKE $${pIdx} OR
        LOWER(si.product_name) LIKE $${pIdx} OR
        LOWER(ap.product_name) LIKE $${pIdx}
      )`);
    }

    const whereSQL = clauses.join(' AND ');

    params.push(Math.min(Math.max(Number(limit) || 100, 1), 200));
    const limitIdx = params.length;
    params.push(Math.max(Number(offset) || 0, 0));
    const offsetIdx = params.length;

    // Count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total 
       FROM matches m
       JOIN stack_items si        ON si.id = m.stack_item_id
       JOIN affected_products ap  ON ap.id = m.affected_product_id
       JOIN advisories a          ON a.id  = ap.advisory_id
       WHERE ${whereSQL}`,
      params.slice(0, params.length - 2)
    );
    const total = countResult.rows[0].total;

    const query = `
      SELECT
        m.id,
        m.status,
        m.match_reason,
        m.last_checked_at,
        m.created_at,
        -- Stack item fields
        si.id              AS stack_item_id,
        si.product_name    AS stack_product_name,
        si.vendor          AS stack_vendor,
        si.installed_version,
        -- Advisory fields
        a.id               AS advisory_id,
        a.cve_id,
        a.title            AS advisory_title,
        a.description      AS advisory_description,
        a.severity,
        a.cvss_score,
        a.source_url,
        a.source_name,
        a.published_at,
        a.remediation,
        -- Affected product fields
        ap.id              AS affected_product_id,
        ap.product_name    AS affected_product_name,
        ap.vendor          AS affected_vendor,
        ap.affected_versions_raw,
        ap.fixed_version
      FROM matches m
      JOIN stack_items si        ON si.id = m.stack_item_id
      JOIN affected_products ap  ON ap.id = m.affected_product_id
      JOIN advisories a          ON a.id  = ap.advisory_id
      WHERE ${whereSQL}
      ORDER BY
        CASE m.status
          WHEN 'vulnerable'      THEN 1
          WHEN 'confirmed'       THEN 2
          WHEN 'potential_match' THEN 3
          WHEN 'needs_review'    THEN 4
          WHEN 'not_affected'    THEN 5
          WHEN 'dismissed'       THEN 6
          ELSE 7
        END,
        CASE a.severity
          WHEN 'Critical' THEN 1
          WHEN 'High'     THEN 2
          WHEN 'Medium'   THEN 3
          WHEN 'Low'      THEN 4
          ELSE 5
        END,
        m.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const result = await pool.query(query, params);
    return { matches: result.rows, total };
  }

  /**
   * Retrieve a single match by ID, verifying ownership.
   */
  async findMatchById(id, userId) {
    const query = `
      SELECT
        m.id, m.status, m.match_reason, m.last_checked_at, m.created_at, m.updated_at,
        si.id              AS stack_item_id,
        si.product_name    AS stack_product_name,
        si.vendor          AS stack_vendor,
        si.installed_version,
        a.id               AS advisory_id,
        a.cve_id,
        a.title            AS advisory_title,
        a.description      AS advisory_description,
        a.severity,
        a.cvss_score,
        a.source_url,
        a.source_name,
        a.published_at,
        a.remediation,
        ap.id              AS affected_product_id,
        ap.product_name    AS affected_product_name,
        ap.vendor          AS affected_vendor,
        ap.affected_versions_raw,
        ap.fixed_version
      FROM matches m
      JOIN stack_items si        ON si.id = m.stack_item_id
      JOIN affected_products ap  ON ap.id = m.affected_product_id
      JOIN advisories a          ON a.id  = ap.advisory_id
      WHERE m.id = $1 AND m.user_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  /**
   * Update the status of a match (must belong to the user).
   * Also appends to review_history for auditability.
   */
  async updateMatchStatus(id, userId, newStatus, notes = null) {
    const validStatuses = ['vulnerable', 'potential_match', 'needs_review', 'not_affected', 'dismissed', 'confirmed'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    // 1. Update match status
    const updateResult = await pool.query(
      `UPDATE matches
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, status;`,
      [newStatus, id, userId]
    );

    if (updateResult.rowCount === 0) return null;

    // 2. Append to review_history (audit trail)
    const reviewStatus = ['confirmed', 'not_affected', 'dismissed'].includes(newStatus)
      ? newStatus
      : 'reviewed';

    await pool.query(
      `INSERT INTO review_history (user_id, match_id, review_status, notes, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW());`,
      [userId, id, reviewStatus, notes]
    );

    return updateResult.rows[0];
  }

  /**
   * Summary counts by severity and status for the dashboard card.
   */
  async getMatchSummaryForUser(userId) {
    const query = `
      SELECT
        a.severity,
        m.status,
        COUNT(*)::int AS count
      FROM matches m
      JOIN affected_products ap ON ap.id = m.affected_product_id
      JOIN advisories a         ON a.id  = ap.advisory_id
      WHERE m.user_id = $1
      GROUP BY a.severity, m.status;
    `;
    const result = await pool.query(query, [userId]);

    const summary = {
      total: 0,
      vulnerable: 0,
      needsReview: 0,
      confirmed: 0,
      notAffected: 0,
      dismissed: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };

    for (const row of result.rows) {
      const sev = (row.severity || 'unknown').toLowerCase();
      const status = row.status;
      const count = row.count;

      if (['vulnerable', 'confirmed', 'potential_match', 'needs_review'].includes(status)) {
        summary.total += count;

        if (sev === 'critical') summary.critical += count;
        else if (sev === 'high') summary.high += count;
        else if (sev === 'medium') summary.medium += count;
        else if (sev === 'low') summary.low += count;
        else summary.unknown += count;
      }

      if (status === 'vulnerable') summary.vulnerable += count;
      else if (status === 'confirmed') summary.confirmed += count;
      else if (['potential_match', 'needs_review'].includes(status)) summary.needsReview += count;
      else if (status === 'not_affected') summary.notAffected += count;
      else if (status === 'dismissed') summary.dismissed += count;
    }

    return summary;
  }

  /**
   * Delete stale matches for a user where the stack item no longer exists.
   */
  async cleanStaleMatches(userId) {
    const result = await pool.query(
      `DELETE FROM matches m
       WHERE m.user_id = $1
         AND NOT EXISTS (SELECT 1 FROM stack_items si WHERE si.id = m.stack_item_id)
       RETURNING id;`,
      [userId]
    );
    return result.rowCount;
  }
}

module.exports = new MatchRepository();

const pool = require('../db');

class MatchRepository {
  /**
   * Upsert a match record. If (stack_item_id, affected_product_id) already exists,
   * update match_reason and last_checked_at only — do not overwrite a user-reviewed status.
   */
  async upsertMatch({ userId, stackItemId, affectedProductId, matchReason }) {
    const query = `
      INSERT INTO matches (user_id, stack_item_id, affected_product_id, status, match_reason, last_checked_at, created_at, updated_at)
      VALUES ($1, $2, $3, 'potential_match', $4, NOW(), NOW(), NOW())
      ON CONFLICT (stack_item_id, affected_product_id) DO UPDATE SET
        match_reason    = EXCLUDED.match_reason,
        last_checked_at = NOW(),
        updated_at      = NOW()
      RETURNING id, (xmax = 0) AS is_new;
    `;
    const result = await pool.query(query, [userId, stackItemId, affectedProductId, matchReason]);
    return result.rows[0];
  }

  /**
   * List all matches for a user, joined with advisory and stack item details.
   * Optionally filter by status.
   */
  async findMatchesByUser(userId, { status = '', limit = 100, offset = 0 } = {}) {
    const params = [userId];
    const clauses = ['m.user_id = $1'];

    if (status && status.trim()) {
      params.push(status.trim());
      clauses.push(`m.status = $${params.length}`);
    }

    const whereSQL = clauses.join(' AND ');

    params.push(Math.min(Math.max(Number(limit) || 100, 1), 200));
    const limitIdx = params.length;
    params.push(Math.max(Number(offset) || 0, 0));
    const offsetIdx = params.length;

    // Count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM matches m WHERE ${whereSQL}`,
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
          WHEN 'potential_match' THEN 1
          WHEN 'confirmed'       THEN 2
          WHEN 'not_affected'    THEN 3
          WHEN 'dismissed'       THEN 4
          ELSE 5
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
    const validStatuses = ['potential_match', 'confirmed', 'not_affected', 'dismissed'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    // 1. Update match status
    const updateResult = await pool.query(
      `UPDATE matches
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id;`,
      [newStatus, id, userId]
    );

    if (updateResult.rowCount === 0) return null;

    // 2. Append to review_history (audit trail)
    const reviewStatus = newStatus === 'potential_match' ? 'reviewed' : newStatus;
    await pool.query(
      `INSERT INTO review_history (user_id, match_id, review_status, notes, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW());`,
      [userId, id, reviewStatus, notes]
    );

    return updateResult.rows[0];
  }

  /**
   * Summary counts by severity for the dashboard card — only potential_match and confirmed.
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
      WHERE m.user_id = $1 AND m.status IN ('potential_match', 'confirmed')
      GROUP BY a.severity, m.status
      ORDER BY
        CASE a.severity
          WHEN 'Critical' THEN 1
          WHEN 'High'     THEN 2
          WHEN 'Medium'   THEN 3
          WHEN 'Low'      THEN 4
          ELSE 5
        END;
    `;
    const result = await pool.query(query, [userId]);

    // Aggregate into a flat summary object
    const summary = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };

    for (const row of result.rows) {
      const sev = (row.severity || 'unknown').toLowerCase();
      summary.total += row.count;
      if (sev === 'critical') summary.critical += row.count;
      else if (sev === 'high') summary.high += row.count;
      else if (sev === 'medium') summary.medium += row.count;
      else if (sev === 'low') summary.low += row.count;
      else summary.unknown += row.count;
    }

    return summary;
  }

  /**
   * Delete stale matches for a user where the stack item or advisory no longer exists
   * (cascade handles most cases; this is a safety cleanup).
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

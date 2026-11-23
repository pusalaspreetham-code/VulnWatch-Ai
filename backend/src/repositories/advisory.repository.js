const pool = require('../db');

class AdvisoryRepository {
  async upsertAdvisory(data) {
    const {
      cveId = null,
      sourceName,
      sourceAdvisoryId = null,
      sourceUrl,
      title,
      description = null,
      severity = null,
      cvssScore = null,
      remediation = null,
      publishedAt = null,
      rawSourceText = null,
    } = data;

    let query = '';
    let params = [];

    if (cveId) {
      query = `
        INSERT INTO advisories (
          cve_id, source_name, source_advisory_id, source_url, title, description,
          severity, cvss_score, remediation, published_at, raw_source_text, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (cve_id, source_name) WHERE cve_id IS NOT NULL DO UPDATE SET
          source_name = EXCLUDED.source_name,
          source_advisory_id = COALESCE(EXCLUDED.source_advisory_id, advisories.source_advisory_id),
          source_url = EXCLUDED.source_url,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          severity = COALESCE(EXCLUDED.severity, advisories.severity),
          cvss_score = COALESCE(EXCLUDED.cvss_score, advisories.cvss_score),
          remediation = COALESCE(EXCLUDED.remediation, advisories.remediation),
          published_at = COALESCE(EXCLUDED.published_at, advisories.published_at),
          raw_source_text = EXCLUDED.raw_source_text,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_new;
      `;
      params = [
        cveId,
        sourceName,
        sourceAdvisoryId,
        sourceUrl,
        title,
        description,
        severity,
        cvssScore,
        remediation,
        publishedAt,
        rawSourceText,
      ];
    } else {
      query = `
        INSERT INTO advisories (
          cve_id, source_name, source_advisory_id, source_url, title, description,
          severity, cvss_score, remediation, published_at, raw_source_text, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (source_name, source_url) WHERE cve_id IS NULL DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          severity = COALESCE(EXCLUDED.severity, advisories.severity),
          cvss_score = COALESCE(EXCLUDED.cvss_score, advisories.cvss_score),
          remediation = COALESCE(EXCLUDED.remediation, advisories.remediation),
          published_at = COALESCE(EXCLUDED.published_at, advisories.published_at),
          raw_source_text = EXCLUDED.raw_source_text,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_new;
      `;
      params = [
        null,
        sourceName,
        sourceAdvisoryId,
        sourceUrl,
        title,
        description,
        severity,
        cvssScore,
        remediation,
        publishedAt,
        rawSourceText,
      ];
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  async saveAffectedProducts(advisoryId, products) {
    if (!products || products.length === 0) return;

    // Delete existing affected products for this advisory to avoid duplicates on re-scrape
    await pool.query('DELETE FROM affected_products WHERE advisory_id = $1', [advisoryId]);

    for (const prod of products) {
      const query = `
        INSERT INTO affected_products (
          advisory_id, vendor, product_name, cpe, affected_versions_raw, fixed_version
        ) VALUES ($1, $2, $3, $4, $5, $6);
      `;
      await pool.query(query, [
        advisoryId,
        prod.vendor,
        prod.productName,
        prod.cpe || null,
        prod.affectedVersionsRaw || null,
        prod.fixedVersion || null,
      ]);
    }
  }

  async findAll({ vendor = '', severity = '', cve = '', limit = 50, offset = 0 }) {
    const params = [];
    let whereClauses = [];

    if (cve && cve.trim()) {
      params.push(`%${cve.trim().toUpperCase()}%`);
      whereClauses.push(`a.cve_id LIKE $${params.length}`);
    }

    if (severity && severity.trim()) {
      params.push(severity.trim());
      whereClauses.push(`LOWER(a.severity) = LOWER($${params.length})`);
    }

    if (vendor && vendor.trim()) {
      params.push(`%${vendor.trim().toLowerCase()}%`);
      whereClauses.push(`EXISTS (
        SELECT 1 FROM affected_products ap 
        WHERE ap.advisory_id = a.id AND LOWER(ap.vendor) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM advisories a ${whereSql}`, params);
    const total = countResult.rows[0].total;

    // Data query with affected products aggregated
    params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
    const limitIdx = params.length;
    params.push(Math.max(Number(offset) || 0, 0));
    const offsetIdx = params.length;

    const query = `
      SELECT a.id, a.cve_id, a.source_name, a.source_advisory_id, a.source_url, a.title,
             a.severity, a.cvss_score, a.published_at, a.collected_at, a.updated_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'vendor', ap.vendor,
                   'product_name', ap.product_name,
                   'affected_versions_raw', ap.affected_versions_raw,
                   'fixed_version', ap.fixed_version
                 )
               ) FILTER (WHERE ap.id IS NOT NULL),
               '[]'
             ) as affected_products
      FROM advisories a
      LEFT JOIN affected_products ap ON ap.advisory_id = a.id
      ${whereSql}
      GROUP BY a.id
      ORDER BY a.published_at DESC NULLS LAST, a.collected_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const result = await pool.query(query, params);
    return { advisories: result.rows, total };
  }

  async findById(id) {
    const query = `
      SELECT a.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', ap.id,
                   'vendor', ap.vendor,
                   'product_name', ap.product_name,
                   'cpe', ap.cpe,
                   'affected_versions_raw', ap.affected_versions_raw,
                   'fixed_version', ap.fixed_version
                 )
               ) FILTER (WHERE ap.id IS NOT NULL),
               '[]'
             ) as affected_products
      FROM advisories a
      LEFT JOIN affected_products ap ON ap.advisory_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async logRunStart(sourceName, sourceUrl) {
    const query = `
      INSERT INTO advisory_collection_runs (source_name, source_url, status, started_at)
      VALUES ($1, $2, 'in_progress', NOW())
      RETURNING id;
    `;
    const result = await pool.query(query, [sourceName, sourceUrl]);
    return result.rows[0].id;
  }

  async logRunComplete(runId, { status, itemsCollected = 0, itemsNew = 0, itemsUpdated = 0, errorMessage = null }) {
    const query = `
      UPDATE advisory_collection_runs
      SET status = $1,
          items_collected = $2,
          items_new = $3,
          items_updated = $4,
          error_message = $5,
          completed_at = NOW()
      WHERE id = $6;
    `;
    await pool.query(query, [status, itemsCollected, itemsNew, itemsUpdated, errorMessage, runId]);
  }

  async getCollectionRuns({ limit = 20 }) {
    const query = `
      SELECT id, source_name, source_url, status, items_collected, items_new, items_updated, error_message, started_at, completed_at
      FROM advisory_collection_runs
      ORDER BY started_at DESC
      LIMIT $1;
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}

module.exports = new AdvisoryRepository();


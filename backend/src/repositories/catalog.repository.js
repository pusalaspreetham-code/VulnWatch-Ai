const pool = require('../db');

class CatalogRepository {
  async search({ query = '', category = '', limit = 50 }) {
    const params = [];
    let sql = `
      SELECT id, vendor, product_name, category, ecosystem, package_names, aliases, version_format, cpe_prefix, known_versions, description, created_at
      FROM software_catalog
      WHERE 1=1
    `;

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      params.push(`%${q}%`);
      const pIdx = params.length;
      sql += ` AND (
        LOWER(product_name) LIKE $${pIdx}
        OR LOWER(vendor) LIKE $${pIdx}
        OR LOWER(category) LIKE $${pIdx}
        OR LOWER(COALESCE(ecosystem, '')) LIKE $${pIdx}
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(aliases, ARRAY[]::text[])) AS alias
          WHERE LOWER(alias) LIKE $${pIdx}
        )
      )`;
    }

    if (category && category.trim()) {
      params.push(category.trim().toLowerCase());
      const pIdx = params.length;
      sql += ` AND LOWER(category) = $${pIdx}`;
    }

    params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
    sql += ` ORDER BY product_name ASC LIMIT $${params.length};`;

    const result = await pool.query(sql, params);
    return result.rows;
  }

  async findById(id) {
    const query = `
      SELECT id, vendor, product_name, category, ecosystem, package_names, aliases, version_format, cpe_prefix, known_versions, description, created_at
      FROM software_catalog
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find a catalog product by exact name, vendor, or any alias.
   * Resolves e.g. "python3" -> "Python", "nodejs" -> "Node.js", "docker" -> "Docker Engine".
   */
  async findByCanonicalOrAlias(name) {
    if (!name || !name.trim()) return null;
    const clean = name.trim().toLowerCase();

    const query = `
      SELECT id, vendor, product_name, category, ecosystem, package_names, aliases, version_format, cpe_prefix, known_versions, description, created_at
      FROM software_catalog
      WHERE LOWER(TRIM(product_name)) = $1
         OR LOWER(TRIM(COALESCE(vendor, ''))) = $1
         OR $1 = ANY(SELECT LOWER(a) FROM unnest(COALESCE(aliases, ARRAY[]::text[])) a)
      ORDER BY (CASE WHEN LOWER(TRIM(product_name)) = $1 THEN 0 ELSE 1 END) ASC
      LIMIT 1;
    `;
    const result = await pool.query(query, [clean]);
    return result.rows[0] || null;
  }

  /**
   * Extensibly register a custom product into the software catalog
   */
  async registerProduct({ vendor, productName, category = 'General', ecosystem = 'General Software', aliases = [], versionFormat = 'semver', description = '' }) {
    const query = `
      INSERT INTO software_catalog (vendor, product_name, category, ecosystem, aliases, version_format, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (COALESCE(LOWER(TRIM(vendor)), ''), LOWER(TRIM(product_name)))
      DO UPDATE SET
        ecosystem = EXCLUDED.ecosystem,
        aliases = ARRAY(SELECT DISTINCT unnest(software_catalog.aliases || EXCLUDED.aliases)),
        version_format = EXCLUDED.version_format
      RETURNING id, vendor, product_name, category, ecosystem, aliases, version_format;
    `;
    const result = await pool.query(query, [
      vendor || null,
      productName,
      category,
      ecosystem,
      aliases,
      versionFormat,
      description || `${productName} package`,
    ]);
    return result.rows[0];
  }

  async getCategories() {
    const query = `
      SELECT category, COUNT(*)::int as product_count
      FROM software_catalog
      GROUP BY category
      ORDER BY category ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = new CatalogRepository();


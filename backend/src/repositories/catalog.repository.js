const pool = require('../db');

class CatalogRepository {
  async search({ query = '', category = '', limit = 50 }) {
    const params = [];
    let sql = `
      SELECT id, vendor, product_name, category, cpe_prefix, known_versions, description, created_at
      FROM software_catalog
      WHERE 1=1
    `;

    if (query && query.trim()) {
      params.push(`%${query.trim().toLowerCase()}%`);
      const pIdx = params.length;
      sql += ` AND (LOWER(product_name) LIKE $${pIdx} OR LOWER(vendor) LIKE $${pIdx} OR LOWER(category) LIKE $${pIdx})`;
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
      SELECT id, vendor, product_name, category, cpe_prefix, known_versions, description, created_at
      FROM software_catalog
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
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


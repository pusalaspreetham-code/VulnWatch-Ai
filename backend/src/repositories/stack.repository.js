const pool = require('../db');

class StackRepository {
  async findAllByUserId(userId) {
    const query = `
      SELECT s.id, s.user_id, s.catalog_product_id, s.vendor, s.product_name, s.installed_version, s.notes, s.created_at, s.updated_at,
             c.category, c.cpe_prefix, c.known_versions
      FROM stack_items s
      LEFT JOIN software_catalog c ON s.catalog_product_id = c.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async findByIdAndUserId(id, userId) {
    const query = `
      SELECT s.id, s.user_id, s.catalog_product_id, s.vendor, s.product_name, s.installed_version, s.notes, s.created_at, s.updated_at,
             c.category, c.cpe_prefix, c.known_versions
      FROM stack_items s
      LEFT JOIN software_catalog c ON s.catalog_product_id = c.id
      WHERE s.id = $1 AND s.user_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  async create({ userId, catalogProductId = null, vendor, productName, installedVersion, notes }) {
    const query = `
      INSERT INTO stack_items (user_id, catalog_product_id, vendor, product_name, installed_version, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, catalog_product_id, vendor, product_name, installed_version, notes, created_at, updated_at;
    `;
    const result = await pool.query(query, [
      userId,
      catalogProductId,
      vendor,
      productName,
      installedVersion,
      notes,
    ]);
    return result.rows[0];
  }

  async update(id, userId, { catalogProductId = null, vendor, productName, installedVersion, notes }) {
    const query = `
      UPDATE stack_items
      SET catalog_product_id = $1,
          vendor = $2,
          product_name = $3,
          installed_version = $4,
          notes = $5,
          updated_at = NOW()
      WHERE id = $6 AND user_id = $7
      RETURNING id, user_id, catalog_product_id, vendor, product_name, installed_version, notes, created_at, updated_at;
    `;
    const result = await pool.query(query, [
      catalogProductId,
      vendor,
      productName,
      installedVersion,
      notes,
      id,
      userId,
    ]);
    return result.rows[0] || null;
  }

  async delete(id, userId) {
    const query = `
      DELETE FROM stack_items
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  }
}

module.exports = new StackRepository();

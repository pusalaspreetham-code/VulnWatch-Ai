const pool = require('../db');

class StackRepository {
  async findByUserAndProductName(userId, productName, canonicalName = null) {
    const cName = canonicalName || productName;
    const query = `
      SELECT id, user_id, catalog_product_id, vendor, product_name, canonical_name, ecosystem, installed_version, notes, created_at, updated_at
      FROM stack_items
      WHERE user_id = $1 
        AND (
          LOWER(TRIM(product_name)) = LOWER(TRIM($2))
          OR LOWER(TRIM(COALESCE(canonical_name, ''))) = LOWER(TRIM($2))
          OR LOWER(TRIM(product_name)) = LOWER(TRIM($3))
          OR LOWER(TRIM(COALESCE(canonical_name, ''))) = LOWER(TRIM($3))
        )
      LIMIT 1;
    `;
    const result = await pool.query(query, [userId, productName, cName]);
    return result.rows[0] || null;
  }

  async findAllByUserId(userId) {
    const query = `
      SELECT s.id, s.user_id, s.catalog_product_id, s.vendor, s.product_name, s.canonical_name, s.ecosystem, s.installed_version, s.notes, s.created_at, s.updated_at,
             c.category, c.cpe_prefix, c.known_versions, c.version_format, c.aliases
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
      SELECT s.id, s.user_id, s.catalog_product_id, s.vendor, s.product_name, s.canonical_name, s.ecosystem, s.installed_version, s.notes, s.created_at, s.updated_at,
             c.category, c.cpe_prefix, c.known_versions, c.version_format, c.aliases
      FROM stack_items s
      LEFT JOIN software_catalog c ON s.catalog_product_id = c.id
      WHERE s.id = $1 AND s.user_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  async create({ userId, catalogProductId = null, vendor, productName, canonicalName = null, ecosystem = 'General Software', installedVersion, notes }) {
    const query = `
      INSERT INTO stack_items (user_id, catalog_product_id, vendor, product_name, canonical_name, ecosystem, installed_version, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, catalog_product_id, vendor, product_name, canonical_name, ecosystem, installed_version, notes, created_at, updated_at;
    `;
    const result = await pool.query(query, [
      userId,
      catalogProductId,
      vendor,
      productName,
      canonicalName || productName,
      ecosystem || 'General Software',
      installedVersion,
      notes,
    ]);
    return result.rows[0];
  }

  async update(id, userId, { catalogProductId = null, vendor, productName, canonicalName = null, ecosystem = 'General Software', installedVersion, notes }) {
    const query = `
      UPDATE stack_items
      SET catalog_product_id = $1,
          vendor = $2,
          product_name = $3,
          canonical_name = $4,
          ecosystem = $5,
          installed_version = $6,
          notes = $7,
          updated_at = NOW()
      WHERE id = $8 AND user_id = $9
      RETURNING id, user_id, catalog_product_id, vendor, product_name, canonical_name, ecosystem, installed_version, notes, created_at, updated_at;
    `;
    const result = await pool.query(query, [
      catalogProductId,
      vendor,
      productName,
      canonicalName || productName,
      ecosystem || 'General Software',
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

/**
 * Migration: Remove duplicate stack entries (same user + same product name, case-insensitive)
 * Keeps the most recently added entry per duplicate group.
 * Run: node backend/database/migrate_stack_dedup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find and delete older duplicates — keep the max id (most recent) per group
    const result = await client.query(`
      DELETE FROM stack_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, LOWER(TRIM(product_name))
                   ORDER BY created_at DESC
                 ) AS rn
          FROM stack_items
        ) ranked
        WHERE rn > 1
      )
      RETURNING id, user_id, product_name;
    `);

    if (result.rowCount > 0) {
      console.log(`Removed ${result.rowCount} duplicate stack entries:`);
      result.rows.forEach(r => console.log(`  - id=${r.id} user=${r.user_id} product="${r.product_name}"`));
    } else {
      console.log('No duplicate stack entries found.');
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete: duplicate stack items removed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();


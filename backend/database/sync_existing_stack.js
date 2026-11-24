require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db');
const catalogRepo = require('../src/repositories/catalog.repository');

async function sync() {
  const items = await pool.query('SELECT id, user_id, product_name FROM stack_items');
  for (const item of items.rows) {
    const resolved = await catalogRepo.findByCanonicalOrAlias(item.product_name);
    if (resolved) {
      await pool.query(
        'UPDATE stack_items SET canonical_name = $1, ecosystem = $2, catalog_product_id = $3 WHERE id = $4',
        [resolved.product_name, resolved.ecosystem, resolved.id, item.id]
      );
      console.log(`Updated stack item #${item.id} (${item.product_name}) -> canonical: ${resolved.product_name} [${resolved.ecosystem}]`);
    }
  }

  // Deduplicate items with identical canonical_name for same user (keep row 72 "Python", remove row 73 "Python3")
  const del = await pool.query(`
    DELETE FROM stack_items
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, LOWER(TRIM(COALESCE(canonical_name, product_name)))
                 ORDER BY id ASC
               ) AS rn
        FROM stack_items
      ) ranked
      WHERE rn > 1
    )
    RETURNING id, product_name, canonical_name;
  `);

  if (del.rowCount > 0) {
    console.log('\nCleaned duplicate stack items:');
    del.rows.forEach(r => console.log(`  - removed duplicate #${r.id} (${r.product_name} -> canonical: ${r.canonical_name})`));
  } else {
    console.log('No duplicates found.');
  }

  await pool.end();
}

sync().catch(err => {
  console.error(err);
  pool.end();
});


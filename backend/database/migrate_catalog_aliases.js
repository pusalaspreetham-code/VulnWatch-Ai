/**
 * Migration: Add aliases column to software_catalog
 * Run: node backend/database/migrate_catalog_aliases.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add aliases column if not exists
    await client.query(`
      ALTER TABLE software_catalog
      ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
    `);

    // Create GIN index for fast alias lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS software_catalog_aliases_gin_idx
      ON software_catalog USING GIN(aliases);
    `);

    // Seed known aliases for existing catalog entries
    const aliasUpdates = [
      { productName: 'Node.js',              aliases: ['node', 'nodejs', 'node.js', 'node js'] },
      { productName: 'PHP',                  aliases: ['php', 'php-fpm', 'php8', 'php7', 'php 8', 'php 7'] },
      { productName: 'Apache HTTP Server',   aliases: ['apache', 'httpd', 'apache2', 'apache http server', 'apache httpd'] },
      { productName: 'Amazon Linux',         aliases: ['amzn', 'amazon linux 2', 'amazon linux 2023', 'al2', 'al2023'] },
      { productName: 'Ubuntu',               aliases: ['ubuntu linux', 'canonical ubuntu', 'ubuntu server'] },
      { productName: 'Nginx',                aliases: ['nginx', 'nginx http server', 'f5 nginx', 'openresty'] },
      { productName: 'MySQL',                aliases: ['mysql server', 'mysql community', 'mariadb'] },
      { productName: 'PostgreSQL',           aliases: ['postgres', 'pgsql', 'postgresql server'] },
      { productName: 'OpenSSL',              aliases: ['openssl', 'open ssl', 'openssl library'] },
      { productName: 'Redis',                aliases: ['redis server', 'redis cache', 'redis-server'] },
    ];

    for (const { productName, aliases } of aliasUpdates) {
      const res = await client.query(
        `UPDATE software_catalog SET aliases = $1 WHERE LOWER(TRIM(product_name)) = LOWER(TRIM($2)) RETURNING id, product_name`,
        [aliases, productName]
      );
      if (res.rowCount > 0) {
        console.log(`  ✓ Updated aliases for: ${res.rows[0].product_name}`);
      } else {
        console.log(`  ⚠ Product not found in catalog: ${productName}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete: software_catalog.aliases column added and seeded.');
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


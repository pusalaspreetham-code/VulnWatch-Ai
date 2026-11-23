const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  console.log('Migrating advisories table unique constraint to (cve_id, source_name)...');

  // Drop old unique index on cve_id alone
  await pool.query(`DROP INDEX IF EXISTS advisories_cve_id_unique;`);

  // Create new unique index on (cve_id, source_name)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS advisories_cve_source_unique 
    ON advisories(cve_id, source_name) 
    WHERE cve_id IS NOT NULL;
  `);

  console.log('Successfully updated advisories index to (cve_id, source_name)!');
  await pool.end();
}

migrate().catch(console.error);


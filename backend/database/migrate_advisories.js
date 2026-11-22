const pool = require('../src/db');

async function migrateAdvisories() {
  console.log('Running advisory schema migration...');
  try {
    // 1. Add raw_source_text to advisories
    await pool.query(`
      ALTER TABLE advisories 
      ADD COLUMN IF NOT EXISTS raw_source_text TEXT;
    `);

    // 2. Add fixed_version to affected_products
    await pool.query(`
      ALTER TABLE affected_products 
      ADD COLUMN IF NOT EXISTS fixed_version VARCHAR(100);
    `);

    // 3. Unique index for non-CVE advisories (prevent duplicate vendor URLs)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS advisories_source_url_unique 
      ON advisories (source_name, source_url) 
      WHERE cve_id IS NULL;
    `);

    // 4. Create advisory_collection_runs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS advisory_collection_runs (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          source_name VARCHAR(255) NOT NULL,
          source_url TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
          items_collected INT NOT NULL DEFAULT 0,
          items_new INT NOT NULL DEFAULT 0,
          items_updated INT NOT NULL DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS advisory_collection_runs_source_idx 
      ON advisory_collection_runs (source_name, started_at DESC);
    `);

    console.log('Advisories migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAdvisories();


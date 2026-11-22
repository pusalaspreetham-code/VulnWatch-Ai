const pool = require('../src/db');

async function migrate() {
  try {
    console.log('Running migration...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          otp_hash TEXT NOT NULL,
          purpose VARCHAR(50) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          attempts_count INT NOT NULL DEFAULT 0,
          max_attempts INT NOT NULL DEFAULT 5,
          is_used BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS email_otps_lookup_idx
          ON email_otps (LOWER(email), purpose, is_used, expires_at);
    `);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();


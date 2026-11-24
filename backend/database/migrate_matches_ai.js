const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  console.log('Running migration: adding ai_explanation and ai_explained_at to matches table...');

  await pool.query(`
    ALTER TABLE matches 
    ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
    ADD COLUMN IF NOT EXISTS ai_explained_at TIMESTAMPTZ;
  `);

  console.log('Successfully updated matches table for AI explanations!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});


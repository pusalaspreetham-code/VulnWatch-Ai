const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  console.log('Running migration: updating matches status constraint...');
  
  await pool.query(`
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
    ALTER TABLE matches ADD CONSTRAINT matches_status_check 
      CHECK (status IN ('vulnerable', 'potential_match', 'needs_review', 'not_affected', 'dismissed', 'confirmed', 'no_match'));
  `);

  console.log('Successfully updated matches_status_check constraint!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});


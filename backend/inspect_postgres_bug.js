const pool = require('./src/db');
(async () => {
  const r = await pool.query(`
    SELECT a.id, a.cve_id, a.source_advisory_id, a.title, ap.product_name, ap.affected_versions_raw, ap.fixed_version
    FROM advisories a
    JOIN affected_products ap ON ap.advisory_id = a.id
    WHERE a.source_advisory_id IN ('SUSE-SU-2023:4495-1', 'SUSE-SU-2024:4063-1', 'SUSE-SU-2024:4173-1', 'SUSE-SU-2024:0106-1')
  `);
  console.log('Found advisories:', r.rows);
  await pool.end();
})().catch(console.error);

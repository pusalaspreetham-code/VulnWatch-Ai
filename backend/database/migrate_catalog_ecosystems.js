/**
 * Migration: Add ecosystem, package_names, version_format to software_catalog and stack_items
 * Run: node backend/database/migrate_catalog_ecosystems.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add ecosystem, package_names, version_format to software_catalog
    await client.query(`
      ALTER TABLE software_catalog
      ADD COLUMN IF NOT EXISTS ecosystem VARCHAR(100) DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS package_names TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS version_format VARCHAR(50) DEFAULT 'semver';
    `);

    // 2. Add canonical_name and ecosystem to stack_items
    await client.query(`
      ALTER TABLE stack_items
      ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS ecosystem VARCHAR(100) DEFAULT 'General';
    `);

    // 3. Populate / Update canonical ecosystems and package_names for catalog products
    const catalogUpdates = [
      {
        productName: 'Python',
        vendor: 'Python Software Foundation',
        ecosystem: 'PyPI',
        packageNames: ['python', 'cpython'],
        aliases: ['python', 'python3', 'python 3', 'cpython', 'py', 'python-runtime'],
        versionFormat: 'semver'
      },
      {
        productName: 'Docker Engine',
        vendor: 'Docker Inc.',
        ecosystem: 'Container / Go',
        packageNames: ['docker.io', 'github.com/docker/docker', 'docker'],
        aliases: ['docker', 'docker engine', 'docker-ce', 'docker.io', 'moby', 'docker-engine'],
        versionFormat: 'semver'
      },
      {
        productName: 'Node.js',
        vendor: 'OpenJS Foundation',
        ecosystem: 'npm',
        packageNames: ['node', 'nodejs'],
        aliases: ['node', 'nodejs', 'node.js', 'node js'],
        versionFormat: 'semver'
      },
      {
        productName: 'PHP',
        vendor: 'The PHP Group',
        ecosystem: 'Packagist',
        packageNames: ['php'],
        aliases: ['php', 'php-fpm', 'php8', 'php7', 'php 8', 'php 7'],
        versionFormat: 'semver'
      },
      {
        productName: 'Apache HTTP Server',
        vendor: 'Apache Software Foundation',
        ecosystem: 'System',
        packageNames: ['apache2', 'httpd'],
        aliases: ['apache', 'httpd', 'apache2', 'apache http server', 'apache httpd'],
        versionFormat: 'semver'
      },
      {
        productName: 'Ubuntu',
        vendor: 'Canonical',
        ecosystem: 'Ubuntu',
        packageNames: ['ubuntu'],
        aliases: ['ubuntu', 'ubuntu linux', 'canonical ubuntu', 'ubuntu server'],
        versionFormat: 'calver'
      },
      {
        productName: 'Amazon Linux',
        vendor: 'Amazon',
        ecosystem: 'System',
        packageNames: ['amzn'],
        aliases: ['amazon linux', 'amazon linux 2023', 'amazon linux 2', 'amzn', 'al2', 'al2023'],
        versionFormat: 'calver'
      },
      {
        productName: 'NGINX',
        vendor: 'F5 / NGINX',
        ecosystem: 'System',
        packageNames: ['nginx'],
        aliases: ['nginx', 'f5 nginx', 'nginx http server'],
        versionFormat: 'semver'
      },
      {
        productName: 'PostgreSQL',
        vendor: 'PostgreSQL Global Development Group',
        ecosystem: 'System',
        packageNames: ['postgresql'],
        aliases: ['postgres', 'pgsql', 'postgresql', 'postgresql server'],
        versionFormat: 'semver'
      },
      {
        productName: 'MySQL',
        vendor: 'Oracle',
        ecosystem: 'System',
        packageNames: ['mysql-server', 'mysql'],
        aliases: ['mysql', 'mysql server', 'mysql community'],
        versionFormat: 'semver'
      },
      {
        productName: 'Redis',
        vendor: 'Redis Ltd.',
        ecosystem: 'System',
        packageNames: ['redis-server', 'redis'],
        aliases: ['redis', 'redis server', 'redis cache'],
        versionFormat: 'semver'
      },
      {
        productName: 'Express',
        vendor: 'OpenJS Foundation',
        ecosystem: 'npm',
        packageNames: ['express'],
        aliases: ['express', 'express.js', 'expressjs'],
        versionFormat: 'semver'
      },
      {
        productName: 'Django',
        vendor: 'Django Software Foundation',
        ecosystem: 'PyPI',
        packageNames: ['django'],
        aliases: ['django', 'django framework'],
        versionFormat: 'semver'
      },
      {
        productName: 'Flask',
        vendor: 'Pallets',
        ecosystem: 'PyPI',
        packageNames: ['flask'],
        aliases: ['flask', 'flask framework'],
        versionFormat: 'semver'
      },
      {
        productName: 'FastAPI',
        vendor: 'Sebastián Ramírez',
        ecosystem: 'PyPI',
        packageNames: ['fastapi'],
        aliases: ['fastapi', 'fast-api'],
        versionFormat: 'semver'
      },
      {
        productName: 'Spring Boot',
        vendor: 'VMware / Spring',
        ecosystem: 'Maven',
        packageNames: ['org.springframework.boot:spring-boot'],
        aliases: ['spring boot', 'spring-boot', 'springboot'],
        versionFormat: 'semver'
      },
      {
        productName: 'Kubernetes',
        vendor: 'Cloud Native Computing Foundation',
        ecosystem: 'Container / Go',
        packageNames: ['k8s.io/kubernetes'],
        aliases: ['kubernetes', 'k8s'],
        versionFormat: 'semver'
      },
      {
        productName: 'OpenSSL',
        vendor: 'OpenSSL Project',
        ecosystem: 'System',
        packageNames: ['openssl'],
        aliases: ['openssl', 'libssl'],
        versionFormat: 'semver'
      },
      {
        productName: 'Git',
        vendor: 'Git Project',
        ecosystem: 'System',
        packageNames: ['git'],
        aliases: ['git', 'git-scm'],
        versionFormat: 'semver'
      },
      {
        productName: 'Go',
        vendor: 'Google',
        ecosystem: 'Go',
        packageNames: ['golang'],
        aliases: ['go', 'golang', 'go language'],
        versionFormat: 'semver'
      },
      {
        productName: 'Rust',
        vendor: 'Rust Foundation',
        ecosystem: 'crates.io',
        packageNames: ['rust'],
        aliases: ['rust', 'rust-lang'],
        versionFormat: 'semver'
      },
      {
        productName: 'Ruby',
        vendor: 'Ruby Core Team',
        ecosystem: 'RubyGems',
        packageNames: ['ruby'],
        aliases: ['ruby', 'ruby-lang'],
        versionFormat: 'semver'
      },
      {
        productName: '.NET Runtime',
        vendor: 'Microsoft',
        ecosystem: 'NuGet',
        packageNames: ['dotnet'],
        aliases: ['.net', 'dotnet', '.net runtime', 'dotnet runtime'],
        versionFormat: 'semver'
      }
    ];

    for (const item of catalogUpdates) {
      const res = await client.query(
        `UPDATE software_catalog 
         SET ecosystem = $1, package_names = $2, aliases = $3, version_format = $4
         WHERE LOWER(TRIM(product_name)) = LOWER(TRIM($5))
         RETURNING id, product_name;`,
        [item.ecosystem, item.packageNames, item.aliases, item.versionFormat, item.productName]
      );
      if (res.rowCount > 0) {
        console.log(`  ✓ Updated ecosystem & package_names for: ${res.rows[0].product_name}`);
      } else {
        // If not present in catalog, insert it
        const ins = await client.query(
          `INSERT INTO software_catalog (vendor, product_name, category, ecosystem, package_names, aliases, version_format, description)
           VALUES ($1, $2, 'General', $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING
           RETURNING id, product_name;`,
          [item.vendor, item.productName, item.ecosystem, item.packageNames, item.aliases, item.versionFormat, `${item.productName} official package`]
        );
        if (ins.rowCount > 0) {
          console.log(`  ✓ Inserted catalog entry for: ${ins.rows[0].product_name}`);
        }
      }
    }

    // 4. Update existing stack_items with canonical_name and ecosystem
    await client.query(`
      UPDATE stack_items s
      SET canonical_name = COALESCE(sc.product_name, s.product_name),
          ecosystem = COALESCE(sc.ecosystem, 'General')
      FROM software_catalog sc
      WHERE s.catalog_product_id = sc.id;
    `);

    // Deduplicate any stack items where canonical_name now overlaps for the same user
    const dedup = await client.query(`
      DELETE FROM stack_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, LOWER(TRIM(COALESCE(canonical_name, product_name)))
                   ORDER BY created_at DESC
                 ) AS rn
          FROM stack_items
        ) ranked
        WHERE rn > 1
      )
      RETURNING id, user_id, product_name, canonical_name;
    `);

    if (dedup.rowCount > 0) {
      console.log(`\nCleaned ${dedup.rowCount} duplicate stack entries during migration:`);
      dedup.rows.forEach(r => console.log(`  - removed stack item #${r.id} (${r.product_name} -> canonical: ${r.canonical_name})`));
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete: catalog ecosystems, package names, and canonical names configured.');
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


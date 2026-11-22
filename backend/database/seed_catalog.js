const pool = require('../src/db');

const catalogProducts = [
  // 1. Operating Systems & Distributions
  {
    vendor: 'Canonical',
    product_name: 'Ubuntu',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:canonical:ubuntu_linux',
    known_versions: ['24.04 LTS', '22.04 LTS', '20.04 LTS', '18.04 LTS', '23.10'],
    description: 'Debian-based open source Linux operating system'
  },
  {
    vendor: 'Debian Project',
    product_name: 'Debian',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:debian:debian_linux',
    known_versions: ['12 (Bookworm)', '11 (Bullseye)', '10 (Buster)'],
    description: 'Stable Unix-like computer operating system'
  },
  {
    vendor: 'Red Hat',
    product_name: 'Red Hat Enterprise Linux',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:redhat:enterprise_linux',
    known_versions: ['9.4', '9.3', '9.2', '9.0', '8.9', '8.8', '8.0', '7.9'],
    description: 'Commercial open-source Linux distribution developed by Red Hat'
  },
  {
    vendor: 'Alpine Linux',
    product_name: 'Alpine Linux',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:alpinelinux:alpine_linux',
    known_versions: ['3.20', '3.19', '3.18', '3.17', '3.16'],
    description: 'Security-oriented, lightweight Linux distribution based on musl libc and busybox'
  },
  {
    vendor: 'Microsoft',
    product_name: 'Windows Server',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:microsoft:windows_server',
    known_versions: ['2025', '2022', '2019', '2016'],
    description: 'Server operating system platform by Microsoft'
  },
  {
    vendor: 'Amazon',
    product_name: 'Amazon Linux',
    category: 'Operating System',
    cpe_prefix: 'cpe:2.3:o:amazon:amazon_linux',
    known_versions: ['2023', '2', '1'],
    description: 'Linux server operating system provided by AWS'
  },

  // 2. Databases
  {
    vendor: 'PostgreSQL Global Development Group',
    product_name: 'PostgreSQL',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:postgresql:postgresql',
    known_versions: ['17.0', '16.4', '16.2', '15.8', '15.4', '14.13', '13.16'],
    description: 'Advanced open-source relational database'
  },
  {
    vendor: 'Oracle',
    product_name: 'MySQL',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:oracle:mysql',
    known_versions: ['8.4 LTS', '8.0.39', '8.0.36', '8.0.32', '5.7.44'],
    description: 'Open-source relational database management system'
  },
  {
    vendor: 'Redis Ltd.',
    product_name: 'Redis',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:redis:redis',
    known_versions: ['7.4', '7.2', '7.0', '6.2', '6.0'],
    description: 'In-memory data structure store, used as a database, cache, and message broker'
  },
  {
    vendor: 'MongoDB Inc.',
    product_name: 'MongoDB',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:mongodb:mongodb',
    known_versions: ['8.0', '7.0.12', '7.0', '6.0.16', '5.0.28'],
    description: 'Source-available cross-platform document-oriented database program'
  },
  {
    vendor: 'Elastic',
    product_name: 'Elasticsearch',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:elastic:elasticsearch',
    known_versions: ['8.15', '8.14', '8.12', '7.17.23'],
    description: 'Distributed, JSON-based search and analytics engine'
  },
  {
    vendor: 'MariaDB Foundation',
    product_name: 'MariaDB',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:mariadb:mariadb',
    known_versions: ['11.4 LTS', '11.2', '10.11 LTS', '10.6 LTS'],
    description: 'Community-developed, commercially supported fork of MySQL'
  },
  {
    vendor: 'SQLite Development Team',
    product_name: 'SQLite',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:sqlite:sqlite',
    known_versions: ['3.46.1', '3.45.3', '3.42.0', '3.39.4'],
    description: 'C-language library implementing a small, fast, self-contained SQL database engine'
  },
  {
    vendor: 'Apache Software Foundation',
    product_name: 'Apache Cassandra',
    category: 'Database',
    cpe_prefix: 'cpe:2.3:a:apache:cassandra',
    known_versions: ['5.0', '4.1.6', '4.0.14', '3.11.17'],
    description: 'Free and open-source distributed NoSQL database management system'
  },

  // 3. Web Servers & Reverse Proxies
  {
    vendor: 'F5 / NGINX',
    product_name: 'NGINX',
    category: 'Web Server',
    cpe_prefix: 'cpe:2.3:a:f5:nginx',
    known_versions: ['1.26.2', '1.26.0', '1.24.0', '1.22.1', '1.20.2'],
    description: 'High-performance HTTP web server and reverse proxy'
  },
  {
    vendor: 'Apache Software Foundation',
    product_name: 'Apache HTTP Server',
    category: 'Web Server',
    cpe_prefix: 'cpe:2.3:a:apache:http_server',
    known_versions: ['2.4.62', '2.4.58', '2.4.54', '2.4.52', '2.4.48'],
    description: 'Open-source cross-platform web server software'
  },
  {
    vendor: 'HAProxy Technologies',
    product_name: 'HAProxy',
    category: 'Reverse Proxy',
    cpe_prefix: 'cpe:2.3:a:haproxy:haproxy',
    known_versions: ['3.0.4', '2.8.10', '2.6.17', '2.4.26'],
    description: 'High-availability load balancer and proxy server for TCP and HTTP-based applications'
  },
  {
    vendor: 'Caddy Project',
    product_name: 'Caddy',
    category: 'Web Server',
    cpe_prefix: 'cpe:2.3:a:caddyserver:caddy',
    known_versions: ['2.8.4', '2.7.6', '2.6.4'],
    description: 'Ultimate enterprise-ready open source web server with automatic HTTPS'
  },
  {
    vendor: 'Traefik Labs',
    product_name: 'Traefik',
    category: 'Reverse Proxy',
    cpe_prefix: 'cpe:2.3:a:traefik:traefik',
    known_versions: ['3.1.2', '3.0.4', '2.11.8', '2.10.7'],
    description: 'Modern HTTP reverse proxy and load balancer for microservices'
  },
  {
    vendor: 'Envoy Project',
    product_name: 'Envoy',
    category: 'Reverse Proxy',
    cpe_prefix: 'cpe:2.3:a:envoyproxy:envoy',
    known_versions: ['1.31.0', '1.30.2', '1.28.4', '1.26.8'],
    description: 'Open source edge and service proxy designed for cloud-native applications'
  },

  // 4. Programming Languages & Runtimes
  {
    vendor: 'The PHP Group',
    product_name: 'PHP',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:php:php',
    known_versions: ['8.3.14', '8.3.0', '8.2.26', '8.2.0', '8.1.31', '8.1.0', '8.0.30', '7.4.33'],
    description: 'Popular general-purpose scripting language suited for web development'
  },
  {
    vendor: 'OpenJS Foundation',
    product_name: 'Node.js',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:nodejs:node.js',
    known_versions: ['22.9.0', '22.0.0', '20.18.0', '20.12.2', '18.20.4', '18.16.0', '16.20.2'],
    description: 'Open-source, cross-platform JavaScript runtime environment'
  },
  {
    vendor: 'Python Software Foundation',
    product_name: 'Python',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:python:python',
    known_versions: ['3.13.0', '3.12.7', '3.12.0', '3.11.10', '3.10.15', '3.9.20', '3.8.20'],
    description: 'High-level, general-purpose programming language'
  },
  {
    vendor: 'Google',
    product_name: 'Go',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:golang:go',
    known_versions: ['1.23.2', '1.23.0', '1.22.8', '1.22.0', '1.21.13', '1.20.14'],
    description: 'Statically typed, compiled high-level programming language designed at Google'
  },
  {
    vendor: 'Oracle / OpenJDK',
    product_name: 'OpenJDK',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:oracle:openjdk',
    known_versions: ['23', '21 LTS', '17 LTS', '11 LTS', '8 LTS'],
    description: 'Free and open-source implementation of the Java Platform, Standard Edition'
  },
  {
    vendor: 'Rust Foundation',
    product_name: 'Rust',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:rust-lang:rust',
    known_versions: ['1.82.0', '1.81.0', '1.80.1', '1.75.0', '1.70.0'],
    description: 'Multi-paradigm, general-purpose programming language that emphasizes performance and safety'
  },
  {
    vendor: 'Ruby Core Team',
    product_name: 'Ruby',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:ruby-lang:ruby',
    known_versions: ['3.3.5', '3.2.5', '3.1.6', '3.0.7'],
    description: 'Interpreted, high-level, general-purpose programming language'
  },
  {
    vendor: 'Microsoft',
    product_name: '.NET Runtime',
    category: 'Language / Runtime',
    cpe_prefix: 'cpe:2.3:a:microsoft:.net',
    known_versions: ['9.0', '8.0.10', '8.0.0', '7.0.20', '6.0.35'],
    description: 'Cross-platform, high-performance developer platform by Microsoft'
  },

  // 5. Frameworks & Libraries
  {
    vendor: 'OpenJS Foundation',
    product_name: 'Express',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:expressjs:express',
    known_versions: ['5.0.1', '5.0.0', '4.21.1', '4.20.0', '4.19.2', '4.18.2'],
    description: 'Fast, unopinionated, minimalist web framework for Node.js'
  },
  {
    vendor: 'Django Software Foundation',
    product_name: 'Django',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:djangoproject:django',
    known_versions: ['5.1.2', '5.0.9', '4.2.16 LTS', '4.1.13', '3.2.25'],
    description: 'High-level Python web framework that encourages rapid development'
  },
  {
    vendor: 'VMware / Spring',
    product_name: 'Spring Boot',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:vmware:spring_boot',
    known_versions: ['3.3.4', '3.2.10', '3.1.12', '2.7.18'],
    description: 'Framework to create stand-alone, production-grade Spring-based Applications'
  },
  {
    vendor: 'Pallets',
    product_name: 'Flask',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:palletsprojects:flask',
    known_versions: ['3.0.3', '3.0.0', '2.3.3', '2.2.5'],
    description: 'Micro web framework written in Python'
  },
  {
    vendor: 'Sebastián Ramírez',
    product_name: 'FastAPI',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:fastapi:fastapi',
    known_versions: ['0.115.2', '0.112.0', '0.109.2', '0.100.0'],
    description: 'Modern, fast (high-performance) web framework for building APIs with Python'
  },
  {
    vendor: 'Taylor Otwell',
    product_name: 'Laravel',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:laravel:laravel',
    known_versions: ['11.28.0', '11.0.0', '10.48.20', '9.52.16'],
    description: 'PHP web application framework with expressive, elegant syntax'
  },
  {
    vendor: 'Meta',
    product_name: 'React',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:facebook:react',
    known_versions: ['19.0.0', '18.3.1', '18.2.0', '17.0.2', '16.14.0'],
    description: 'JavaScript library for building user interfaces'
  },
  {
    vendor: 'Vercel',
    product_name: 'Next.js',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:vercel:next.js',
    known_versions: ['15.0.0', '14.2.15', '14.1.0', '13.5.6', '12.3.4'],
    description: 'React framework for the web with server-side rendering and static generation'
  },
  {
    vendor: 'Ruby on Rails Core Team',
    product_name: 'Ruby on Rails',
    category: 'Framework',
    cpe_prefix: 'cpe:2.3:a:rubyonrails:rails',
    known_versions: ['7.2.1', '7.1.4', '7.0.8', '6.1.7'],
    description: 'Server-side web application framework written in Ruby'
  },

  // 6. Containers & Orchestration
  {
    vendor: 'Docker Inc.',
    product_name: 'Docker Engine',
    category: 'Containerization',
    cpe_prefix: 'cpe:2.3:a:docker:docker',
    known_versions: ['27.3.1', '26.1.4', '25.0.5', '24.0.9', '20.10.27'],
    description: 'Open source containerization technology for building and containerizing applications'
  },
  {
    vendor: 'Cloud Native Computing Foundation',
    product_name: 'Kubernetes',
    category: 'Orchestration',
    cpe_prefix: 'cpe:2.3:a:kubernetes:kubernetes',
    known_versions: ['1.31.1', '1.30.5', '1.29.9', '1.28.14', '1.27.16'],
    description: 'Open-source container orchestration system for automating deployment and scaling'
  },
  {
    vendor: 'containerd Authors',
    product_name: 'containerd',
    category: 'Containerization',
    cpe_prefix: 'cpe:2.3:a:containerd:containerd',
    known_versions: ['1.7.22', '1.6.35', '1.5.18'],
    description: 'Industry-standard core container runtime with an emphasis on simplicity and robustness'
  },
  {
    vendor: 'Red Hat',
    product_name: 'Podman',
    category: 'Containerization',
    cpe_prefix: 'cpe:2.3:a:podman:podman',
    known_versions: ['5.2.4', '5.1.2', '5.0.3', '4.9.4'],
    description: 'Daemonless container engine for developing, managing, and running OCI Containers'
  },
  {
    vendor: 'Helm Authors',
    product_name: 'Helm',
    category: 'Package Manager',
    cpe_prefix: 'cpe:2.3:a:helm:helm',
    known_versions: ['3.16.1', '3.15.4', '3.14.4', '3.13.3'],
    description: 'Package manager for Kubernetes'
  },

  // 7. Cloud & Infrastructure Tools
  {
    vendor: 'HashiCorp',
    product_name: 'Terraform',
    category: 'Infrastructure as Code',
    cpe_prefix: 'cpe:2.3:a:hashicorp:terraform',
    known_versions: ['1.9.8', '1.8.5', '1.7.5', '1.6.6', '1.5.7'],
    description: 'Open-source infrastructure as code software tool'
  },
  {
    vendor: 'Red Hat',
    product_name: 'Ansible',
    category: 'Automation',
    cpe_prefix: 'cpe:2.3:a:redhat:ansible',
    known_versions: ['10.5.0', '9.10.0', '8.7.0', '7.7.0'],
    description: 'Open-source IT automation tool for configuration management and provisioning'
  },
  {
    vendor: 'HashiCorp',
    product_name: 'Vault',
    category: 'Security / Secrets',
    cpe_prefix: 'cpe:2.3:a:hashicorp:vault',
    known_versions: ['1.17.6', '1.16.8', '1.15.11', '1.14.8'],
    description: 'Identity-based secrets and encryption management system'
  },
  {
    vendor: 'Prometheus Authors',
    product_name: 'Prometheus',
    category: 'Monitoring',
    cpe_prefix: 'cpe:2.3:a:prometheus:prometheus',
    known_versions: ['2.54.1', '2.53.2', '2.52.0', '2.45.6'],
    description: 'Open-source systems monitoring and alerting toolkit'
  },
  {
    vendor: 'Grafana Labs',
    product_name: 'Grafana',
    category: 'Observability',
    cpe_prefix: 'cpe:2.3:a:grafana:grafana',
    known_versions: ['11.2.2', '11.1.4', '10.4.8', '10.3.6', '9.5.18'],
    description: 'Multi-platform open source analytics and interactive visualization web application'
  },

  // 8. Network & Security Software
  {
    vendor: 'OpenBSD Project',
    product_name: 'OpenSSH',
    category: 'Network Security',
    cpe_prefix: 'cpe:2.3:a:openbsd:openssh',
    known_versions: ['9.9p1', '9.8p1', '9.7p1', '9.6p1', '9.3p2', '8.9p1'],
    description: 'Premier connectivity tool for remote login with the SSH protocol'
  },
  {
    vendor: 'OpenSSL Project',
    product_name: 'OpenSSL',
    category: 'Cryptography',
    cpe_prefix: 'cpe:2.3:a:openssl:openssl',
    known_versions: ['3.3.2', '3.2.3', '3.1.7', '3.0.15', '1.1.1w'],
    description: 'Robust, commercial-grade, and full-featured toolkit for TLS and SSL protocols'
  },
  {
    vendor: 'Jason A. Donenfeld',
    product_name: 'WireGuard',
    category: 'Network Security',
    cpe_prefix: 'cpe:2.3:a:wireguard:wireguard',
    known_versions: ['1.0.20220627', '1.0.20210914', '1.0.20200827'],
    description: 'Extremely simple yet fast and modern VPN that utilizes state-of-the-art cryptography'
  },
  {
    vendor: 'Netgate',
    product_name: 'pfSense',
    category: 'Firewall',
    cpe_prefix: 'cpe:2.3:a:netgate:pfsense',
    known_versions: ['2.7.2', '2.7.0', '2.6.0'],
    description: 'Open source firewall and router computer software distribution based on FreeBSD'
  },
  {
    vendor: 'Cisco',
    product_name: 'Snort',
    category: 'Intrusion Detection',
    cpe_prefix: 'cpe:2.3:a:cisco:snort',
    known_versions: ['3.3.3.0', '3.1.84.0', '2.9.20'],
    description: 'Open-source network intrusion detection and prevention system'
  },

  // 9. Developer Tools & Server Applications
  {
    vendor: 'Git Project',
    product_name: 'Git',
    category: 'Developer Tool',
    cpe_prefix: 'cpe:2.3:a:git-scm:git',
    known_versions: ['2.47.0', '2.46.2', '2.45.2', '2.43.5', '2.39.5'],
    description: 'Fast, scalable, distributed revision control system'
  },
  {
    vendor: 'Jenkins Project',
    product_name: 'Jenkins',
    category: 'CI/CD',
    cpe_prefix: 'cpe:2.3:a:jenkins:jenkins',
    known_versions: ['2.479', '2.462.2 LTS', '2.452.4 LTS', '2.440.3 LTS'],
    description: 'Open source automation server with hundreds of plugins to build, deploy and automate'
  },
  {
    vendor: 'GitLab Inc.',
    product_name: 'GitLab',
    category: 'DevOps',
    cpe_prefix: 'cpe:2.3:a:gitlab:gitlab',
    known_versions: ['17.5', '17.4.2', '17.3.5', '16.11.8', '16.7.8'],
    description: 'Web-based DevOps lifecycle tool providing a Git repository manager and CI/CD pipeline'
  },
  {
    vendor: 'Apache Software Foundation',
    product_name: 'Apache Kafka',
    category: 'Message Broker',
    cpe_prefix: 'cpe:2.3:a:apache:kafka',
    known_versions: ['3.8.0', '3.7.1', '3.6.2', '3.5.2', '2.8.2'],
    description: 'Open-source distributed event streaming platform used by thousands of companies'
  },
  {
    vendor: 'VMware / Pivotal',
    product_name: 'RabbitMQ',
    category: 'Message Broker',
    cpe_prefix: 'cpe:2.3:a:vmware:rabbitmq',
    known_versions: ['4.0.2', '3.13.7', '3.12.14', '3.11.28'],
    description: 'Reliable and mature messaging and streaming broker'
  }
];

async function seedCatalog() {
  console.log('Seeding software_catalog in PostgreSQL...');
  try {
    // 1. Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS software_catalog (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          vendor VARCHAR(255),
          product_name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          cpe_prefix VARCHAR(255),
          known_versions TEXT[] DEFAULT '{}',
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Create unique index to prevent duplicate entries by capitalization or spaces
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS software_catalog_vendor_product_lower_unique
          ON software_catalog (COALESCE(LOWER(TRIM(vendor)), ''), LOWER(TRIM(product_name)));
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS software_catalog_category_idx ON software_catalog (category);
    `);

    // 3. Add catalog_product_id to stack_items safely
    await pool.query(`
      ALTER TABLE stack_items 
      ADD COLUMN IF NOT EXISTS catalog_product_id BIGINT REFERENCES software_catalog(id) ON DELETE SET NULL;
    `);

    // 4. Upsert seed data
    let inserted = 0;
    for (const item of catalogProducts) {
      const query = `
        INSERT INTO software_catalog (vendor, product_name, category, cpe_prefix, known_versions, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (COALESCE(LOWER(TRIM(vendor)), ''), LOWER(TRIM(product_name)))
        DO UPDATE SET
          known_versions = EXCLUDED.known_versions,
          category = EXCLUDED.category,
          cpe_prefix = EXCLUDED.cpe_prefix,
          description = EXCLUDED.description;
      `;
      await pool.query(query, [
        item.vendor,
        item.product_name,
        item.category,
        item.cpe_prefix,
        item.known_versions,
        item.description
      ]);
      inserted++;
    }

    console.log(`Successfully seeded ${inserted} products into software_catalog!`);
  } catch (err) {
    console.error('Failed to seed catalog:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedCatalog();


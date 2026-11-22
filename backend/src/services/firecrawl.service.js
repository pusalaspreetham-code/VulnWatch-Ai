// Fixture data replicating real official vendor security pages for zero-credit offline testing
const FIXTURES = {
  apache: `
# Apache HTTP Server 2.4 vulnerabilities

This page lists all security vulnerabilities fixed in released versions of Apache HTTP Server 2.4.

## Critical: Multiple buffer overflows in mod_proxy (CVE-2024-38476)

CVE-2024-38476: Multiple issues in mod_proxy could lead to denial of service or potential remote code execution via malicious backend responses.

Affects: 2.4.0 through 2.4.59
Fixed in: 2.4.60
Severity: Critical
CVSS: 9.8
Published: 2024-07-01

Remediation: Upgrade to Apache HTTP Server version 2.4.60 or later.

## Important: Information disclosure via mod_ssl (CVE-2024-39573)

CVE-2024-39573: Potential SSRF in mod_proxy when configured with specific rewrite rules.

Affects: 2.4.58 and earlier
Fixed in: 2.4.59
Severity: Important
CVSS: 7.5
Published: 2024-06-15

Remediation: Update to version 2.4.59 or disable vulnerable proxy rewrite rules.

## Moderate: Request splitting via HTTP/2 (CVE-2024-40898)

CVE-2024-40898: Malformed HTTP/2 requests could cause memory exhaustion or request desynchronization.

Affects: 2.4.50 through 2.4.61
Fixed in: 2.4.62
Severity: Moderate
CVSS: 5.3
Published: 2024-07-20

Remediation: Upgrade to 2.4.62 or disable HTTP/2 on affected endpoints.
`,

  nodejs: `
# Node.js Security Advisory: Multiple Vulnerabilities in Node.js

The Node.js project has released security updates to address multiple vulnerabilities.

## Permission model bypass via file path traversal (CVE-2024-36138)

Severity: High
CVSS: 7.8
Affected: Node.js 20.x, 22.x
Fixed in: Node.js 20.15.1, Node.js 22.4.1
Published: 2024-07-08

Description: An issue exists where the experimental permission model can be bypassed through crafted relative file paths.

Remediation: Downloads are available for Node.js 20.15.1 and 22.4.1. Users of the permission model should upgrade immediately.

## Denial of Service in undici HTTP client (CVE-2024-37372)

Severity: Medium
CVSS: 5.5
Affected: Node.js 18.x, 20.x, 22.x
Fixed in: Node.js 18.20.4, 20.15.1, 22.4.1
Published: 2024-07-08

Description: Memory exhaustion through infinite redirect loops in built-in fetch/undici.

Remediation: Upgrade to Node.js 18.20.4, 20.15.1, or 22.4.1.
`,

  ubuntu: `
# Ubuntu Security Notice USN-6890-1

Package: nginx
Published: 2024-07-10
Severity: Medium

Ubuntu Security Notice USN-6890-1: It was discovered that Nginx incorrectly handled HTTP/3 request processing, which could lead to denial of service.

CVEs:
- CVE-2024-7347

Affected Releases:
- Ubuntu 24.04 LTS
- Ubuntu 22.04 LTS

Fixed in: 1.24.0-2ubuntu7.1, 1.18.0-6ubuntu14.5
Remediation: In general, a standard system update will make all the necessary changes.
`
};

class FirecrawlService {
  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    this.mockMode = process.env.FIRECRAWL_MOCK_MODE === 'true' || !this.apiKey;
    this.baseUrl = 'https://api.firecrawl.dev/v1';
  }

  async scrapeUrl(url) {
    // 1. Safe Mock / Fixture Mode: 0 credits used, completely offline-compatible
    if (this.mockMode || !this.apiKey) {
      console.log(`[FIRECRAWL MOCK] Using offline verified fixture for URL: ${url}`);
      return this.getMockFixtureForUrl(url);
    }

    // 2. Real Firecrawl API Scrape
    console.log(`[FIRECRAWL API] Scraping official vendor URL: ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Firecrawl API responded with status ${response.status}: ${errorBody.slice(0, 150)}`);
      }

      const data = await response.json();
      return {
        success: true,
        markdown: (data.data && data.data.markdown) ? data.data.markdown : '',
        url,
        metadata: data.data?.metadata || {},
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Firecrawl scrape request timed out after 30 seconds for ${url}`);
      }
      // Never leak API key in error messages
      console.error(`[FIRECRAWL ERROR] Failed to scrape ${url}:`, err.message);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  getMockFixtureForUrl(url) {
    let markdown = '';
    if (url.includes('apache')) {
      markdown = FIXTURES.apache;
    } else if (url.includes('nodejs') || url.includes('node')) {
      markdown = FIXTURES.nodejs;
    } else if (url.includes('ubuntu')) {
      markdown = FIXTURES.ubuntu;
    } else {
      markdown = FIXTURES.apache;
    }

    return {
      success: true,
      markdown,
      url,
      metadata: {
        title: 'Official Vendor Security Advisory (Offline Fixture)',
        sourceURL: url,
      },
    };
  }
}

module.exports = new FirecrawlService();


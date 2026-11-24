// Google Gemini API Service for Vulnerability Explanations
// Runs strictly on the Node.js backend — never exposed to client

class GeminiService {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  getApiKey() {
    return (process.env.GEMINI_API_KEY || '').trim();
  }

  getModel() {
    return (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  }

  isConfigured() {
    return Boolean(this.getApiKey());
  }

  /**
   * Explain an existing vulnerability match using Gemini API.
   * Grounded strictly in the verified database record — no invented CVEs or severities.
   */
  async explainVulnerability(match) {
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      return {
        success: false,
        configured: false,
        explanation: null,
        message: 'Google Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env to enable AI vulnerability explanations.',
      };
    }

    const prompt = `You are VulnWatch AI's security advisor. Explain the following verified vulnerability advisory finding for a security analyst.

=== VERIFIED ADVISORY DATA (GROUND TRUTH) ===
- Vulnerability Title: ${match.advisory_title || 'N/A'}
- CVE Identifier: ${match.cve_id || 'N/A'}
- Severity: ${match.severity || 'Unknown'}
- CVSS Score: ${match.cvss_score !== null && match.cvss_score !== undefined ? match.cvss_score : 'N/A'}
- Monitored Software: ${match.stack_product_name || 'N/A'}
- Installed Version in User Stack: ${match.installed_version || 'N/A'}
- Affected Products / Releases: ${match.affected_product_name || 'N/A'}
- Advisory Affected Versions: ${match.affected_versions_raw || 'N/A'}
- Fixed in Version: ${match.fixed_version || 'N/A'}
- Deterministic Evaluation: ${match.match_reason || 'N/A'}
- Official Remediation: ${match.remediation || 'N/A'}
- Official Advisory Source: ${match.source_name || 'N/A'} (${match.source_url || 'N/A'})
- Vendor Description: ${match.advisory_description ? match.advisory_description.slice(0, 1500) : 'N/A'}

=== INSTRUCTIONS & STRICT GUARDRAILS ===
1. Base your explanation strictly on the verified data above. DO NOT invent, hallucinate, or guess CVE IDs, version numbers, or severity levels.
2. The deterministic version match status is the single source of truth.
3. Format your response in clean GitHub-style markdown using these sections:
   - **Executive Summary**: What the flaw is in plain, professional terms.
   - **Infrastructure Risk**: How this affects the user's specific installed version (${match.installed_version || 'current version'}).
   - **Remediation Steps**: Safe, actionable steps to patch or mitigate (emphasize testing in staging before production updates).
   - **Reference**: Explicit note directing the analyst to the official vendor bulletin.
4. Keep the response concise, authoritative, and actionable (under 400 words).`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2, // Low temperature for factual grounding
            maxOutputTokens: 800,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errMessage = `Gemini API error (Status ${response.status})`;

        if (response.status === 429) {
          errMessage = 'Gemini AI rate limit exceeded. Please wait a few moments before requesting another explanation.';
        } else if (response.status === 400 || response.status === 403) {
          errMessage = 'Gemini API authentication failed. Please check your GEMINI_API_KEY in backend/.env.';
        }

        console.warn(`[GEMINI API WARNING] Status ${response.status}: ${errorBody.slice(0, 150)}`);
        return {
          success: false,
          configured: true,
          explanation: null,
          message: errMessage,
        };
      }

      const data = await response.json();
      const candidate = data.candidates && data.candidates[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text) {
        return {
          success: false,
          configured: true,
          explanation: null,
          message: 'Gemini returned an empty explanation. Please consult the official advisory.',
        };
      }

      return {
        success: true,
        configured: true,
        explanation: text.trim(),
        model,
        generatedAt: new Date().toISOString(),
        sourceUrl: match.source_url,
        cveId: match.cve_id,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          configured: true,
          explanation: null,
          message: 'Gemini request timed out. Please try again or check the official advisory.',
        };
      }

      console.error('[GEMINI SERVICE ERROR]:', err.message);
      return {
        success: false,
        configured: true,
        explanation: null,
        message: 'Unable to generate AI explanation at this time. Please refer to the official advisory link.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = new GeminiService();


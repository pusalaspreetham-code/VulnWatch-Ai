// Deterministic Version Comparison & Range Evaluation Engine (No LLM, No Hallucinations)

class VersionMatcherService {
  /**
   * Clean package version string to extract the upstream software version.
   * Handles Linux distro RPM/DEB/SUSE package releases, epochs, and build numbers.
   * Examples:
   *   "0:18.7-0.1.hum1"                      => "18.7"
   *   "16-150400.4.9.2"                      => "16"
   *   "15.5-150200.5.19.1"                   => "15.5"
   *   "1.4.8-1.module_el8.8.0+3487+43ec1b9f" => "1.4.8"
   *   "v13.6"                                => "13.6"
   */
  cleanUpstreamVersion(vStr) {
    if (!vStr || typeof vStr !== 'string') return '';
    let clean = vStr.trim().replace(/^[vV]/, '');
    // Strip RPM epoch (e.g., "0:18.7" -> "18.7")
    clean = clean.replace(/^[0-9]+:/, '');
    // Strip package release suffix if followed by digits or dist tag
    // (e.g., "-150400...", "-1.el8...", "-0.1...", "-1.module...")
    // But preserve pre-release tags like "-alpha", "-beta", "-rc"
    const isPreRelease = /-(alpha|beta|rc|preview|dev)/i.test(clean);
    if (!isPreRelease && clean.includes('-')) {
      const beforeHyphen = clean.split('-')[0];
      if (beforeHyphen && /[0-9]/.test(beforeHyphen)) {
        clean = beforeHyphen;
      }
    }
    return clean.trim();
  }

  /**
   * Parse a version string into an array of numeric parts and metadata.
   * Examples:
   *   "2.4.52"       => { parts: [2, 4, 52], raw: "2.4.52", tag: "" }
   *   "8.3.14"       => { parts: [8, 3, 14], raw: "8.3.14", tag: "" }
   *   "24.04 LTS"    => { parts: [24, 4],    raw: "24.04 LTS", tag: "lts" }
   *   "2023"         => { parts: [2023],     raw: "2023", tag: "" }
   *   "v1.24.0-beta" => { parts: [1, 24, 0], raw: "v1.24.0-beta", tag: "beta" }
   */
  parseVersion(vStr) {
    if (!vStr || typeof vStr !== 'string') {
      return { parts: [], raw: '', tag: '' };
    }

    const clean = this.cleanUpstreamVersion(vStr);
    const tagMatch = clean.match(/[-_\s]+([a-zA-Z]+[a-zA-Z0-9]*)/);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : '';

    const numStr = clean.split(/[-_\s]/)[0];
    const parts = numStr
      .split('.')
      .map((p) => {
        const n = parseInt(p, 10);
        return isNaN(n) ? 0 : n;
      });

    return { parts, raw: clean, tag };
  }

  /**
   * Compare two version strings.
   * Returns:
   *   -1 if v1 < v2
   *    0 if v1 === v2
   *    1 if v1 > v2
   */
  compareVersions(v1Str, v2Str) {
    const v1 = this.parseVersion(v1Str);
    const v2 = this.parseVersion(v2Str);

    const maxLen = Math.max(v1.parts.length, v2.parts.length);
    for (let i = 0; i < maxLen; i++) {
      const p1 = i < v1.parts.length ? v1.parts[i] : 0;
      const p2 = i < v2.parts.length ? v2.parts[i] : 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  /**
   * Check if an installed version matches a branch pattern like "20.x", "22.x", "8.3.*", "2.4"
   */
  matchesBranch(installedVer, branchPattern) {
    const v = this.parseVersion(installedVer);
    const b = branchPattern.trim().replace(/[xX*]$/, '').replace(/\.$/, '');
    const bParts = b.split('.').map((p) => parseInt(p, 10)).filter((p) => !isNaN(p));

    if (bParts.length === 0) return false;

    for (let i = 0; i < bParts.length; i++) {
      if (i >= v.parts.length || v.parts[i] !== bParts[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Extract version bounds from advisory text like:
   *   "2.4.0 through 2.4.59"
   *   "2.4.58 and earlier"
   *   "prior to 8.3.8"
   *   "< 2.4.60"
   */
  extractRangeBounds(affectedRaw) {
    if (!affectedRaw || typeof affectedRaw !== 'string') return null;

    const str = affectedRaw.trim();

    // 1. "<= X" or "X and earlier" / "X and prior"
    const lteMatch = str.match(/(?:<=\s*([0-9]+(?:\.[0-9]+)*)|([0-9]+(?:\.[0-9]+)*)\s*(?:and\s+earlier|and\s+prior|or\s+earlier|or\s+prior))/i);
    if (lteMatch) {
      const rawEnd = lteMatch[1] || lteMatch[2];
      return {
        type: 'upper_bound',
        end: this.cleanUpstreamVersion(rawEnd),
        endInclusive: true,
      };
    }

    // 2. "< X" or "before X" or "prior to X"
    const ltMatch = str.match(/(?:<\s*([0-9]+(?:\.[0-9]+)*)|(?:before|prior\s+to|earlier\s+than)\s*([0-9]+(?:\.[0-9]+)*))/i);
    if (ltMatch) {
      const rawEnd = ltMatch[1] || ltMatch[2];
      return {
        type: 'upper_bound',
        end: this.cleanUpstreamVersion(rawEnd),
        endInclusive: false,
      };
    }

    // 3. "X through Y" or "X to Y" or "X - Y" (with mandatory whitespace around range keyword or dash)
    const throughMatch = str.match(/(?:from\s+)?([0-9]+(?:\.[0-9]+)*)\s+(?:through|to|-)\s+([0-9]+(?:\.[0-9]+)*)/i);
    if (throughMatch) {
      return {
        type: 'interval',
        start: this.cleanUpstreamVersion(throughMatch[1]),
        startInclusive: true,
        end: this.cleanUpstreamVersion(throughMatch[2]),
        endInclusive: true,
      };
    }

    // 4. Branch lists like "Node.js 20.x, 22.x" or "8.1, 8.2, 8.3"
    const branches = str.match(/[0-9]+(?:\.[0-9]+)?(?:\.x|\.\*)?/gi);
    if (branches && branches.length > 0) {
      return {
        type: 'branches',
        branches: branches.map((b) => b.trim()),
      };
    }

    return null;
  }

  /**
   * Evaluate single clause of affected range.
   */
  evaluateSingleClause(instClean, clause, fixedVersion) {
    const bounds = this.extractRangeBounds(clause);
    if (!bounds) return null;

    if (bounds.type === 'interval') {
      const cmpStart = this.compareVersions(instClean, bounds.start);
      const cmpEnd = this.compareVersions(instClean, bounds.end);

      const inRange =
        (bounds.startInclusive ? cmpStart >= 0 : cmpStart > 0) &&
        (bounds.endInclusive ? cmpEnd <= 0 : cmpEnd < 0);

      if (inRange) {
        return {
          status: 'vulnerable',
          isVulnerable: true,
          isNotAffected: false,
          reason: `Installed version ${instClean} is within affected range (${bounds.start} to ${bounds.end}).`,
          matchedRule: 'RANGE_INTERVAL_MATCH',
        };
      } else if (cmpEnd > 0) {
        return {
          status: 'not_affected',
          isVulnerable: false,
          isNotAffected: true,
          reason: `Installed version ${instClean} is higher than affected upper bound (${bounds.end}).`,
          matchedRule: 'RANGE_ABOVE_UPPER_BOUND',
        };
      }
    }

    if (bounds.type === 'upper_bound') {
      const cmp = this.compareVersions(instClean, bounds.end);
      const inRange = bounds.endInclusive ? cmp <= 0 : cmp < 0;

      if (inRange) {
        return {
          status: 'vulnerable',
          isVulnerable: true,
          isNotAffected: false,
          reason: `Installed version ${instClean} is within affected versions (${clause.trim()}).`,
          matchedRule: 'UPPER_BOUND_MATCH',
        };
      } else {
        return {
          status: 'not_affected',
          isVulnerable: false,
          isNotAffected: true,
          reason: `Installed version ${instClean} is higher than affected upper bound (${bounds.end}).`,
          matchedRule: 'ABOVE_UPPER_BOUND',
        };
      }
    }

    if (bounds.type === 'branches') {
      const matchedBranch = bounds.branches.find((b) => this.matchesBranch(instClean, b));
      if (matchedBranch) {
        if (fixedVersion) {
          return {
            status: 'vulnerable',
            isVulnerable: true,
            isNotAffected: false,
            reason: `Installed version ${instClean} belongs to affected branch ${matchedBranch} and is below fixed version.`,
            matchedRule: 'BRANCH_BELOW_FIX',
          };
        }
        return {
          status: 'potential_match',
          isVulnerable: false,
          isNotAffected: false,
          reason: `Installed version ${instClean} belongs to affected branch ${matchedBranch} (exact patch undetermined).`,
          matchedRule: 'BRANCH_MATCH_UNCERTAIN_FIX',
        };
      } else {
        return {
          status: 'not_affected',
          isVulnerable: false,
          isNotAffected: true,
          reason: `Installed version ${instClean} is not in affected branches (${clause.trim()}).`,
          matchedRule: 'BRANCH_MISMATCH',
        };
      }
    }

    return null;
  }

  /**
   * Primary title check: check if the advisory title explicitly specifies target product version streams.
   * If the title targets specific versions (e.g. "postgresql:16", "postgresql17", "postgresql15, postgresql16", "Node.js 18.x")
   * and the installed version is in a different major/minor stream (e.g. installed is 19.0 or 13.6),
   * this immediately evaluates to not_affected without false positive range matching.
   */
  checkTitleVersionMatch(installedVersion, title, productName = '') {
    if (!title || typeof title !== 'string' || !installedVersion) return null;

    const instClean = this.cleanUpstreamVersion(installedVersion);
    const instParsed = this.parseVersion(instClean);
    if (!instParsed.parts || instParsed.parts.length === 0) return null;
    const instMajor = instParsed.parts[0];

    // Build regex for the product keyword in title
    let prodPattern = 'postgres(?:ql)?';
    if (productName) {
      const pNorm = productName.trim().toLowerCase();
      if (pNorm.includes('postgres')) prodPattern = 'postgres(?:ql)?';
      else if (pNorm.includes('node')) prodPattern = 'node(?:\\.js)?';
      else if (pNorm.includes('python')) prodPattern = 'python[23]?';
      else if (pNorm.includes('docker')) prodPattern = 'docker(?:-ce|-engine)?';
      else if (pNorm.includes('nginx')) prodPattern = 'nginx';
      else if (pNorm.includes('redis')) prodPattern = 'redis';
      else if (pNorm.includes('apache')) prodPattern = 'apache2?|httpd';
      else if (pNorm.includes('linux')) prodPattern = 'kernel|linux';
      else prodPattern = pNorm.replace(/[^a-z0-9]/g, '');
    }

    // Match product name followed by version numbers, e.g.
    // "postgresql15", "postgresql16", "postgresql:16", "postgresql 17", "postgresql-14", "node.js 18", "python 3.10"
    const regex = new RegExp(`(?:${prodPattern})[:\\s\\-_]*([0-9]+(?:\\.[0-9]+)*)`, 'gi');
    const matchedStreams = [];
    let match;
    while ((match = regex.exec(title)) !== null) {
      if (match[1]) {
        matchedStreams.push(match[1]);
      }
    }

    if (matchedStreams.length === 0) {
      return null; // Title doesn't constrain by version branch
    }

    // Check if installed version matches ANY stream mentioned in the title
    const matchesStream = matchedStreams.some((streamStr) => {
      const streamClean = this.cleanUpstreamVersion(streamStr);
      const streamParsed = this.parseVersion(streamClean);
      if (!streamParsed.parts || streamParsed.parts.length === 0) return false;
      const streamMajor = streamParsed.parts[0];

      if (streamParsed.parts.length === 1) {
        return instMajor === streamMajor;
      }
      if (streamParsed.parts.length >= 2 && instParsed.parts.length >= 2) {
        return instMajor === streamMajor && instParsed.parts[1] === streamParsed.parts[1];
      }
      return instMajor === streamMajor;
    });

    if (!matchesStream) {
      return {
        status: 'not_affected',
        isVulnerable: false,
        isNotAffected: true,
        reason: `Advisory title specifically targets version stream ${matchedStreams.join(', ')}, which does not apply to installed version ${instClean}.`,
        matchedRule: 'TITLE_VERSION_MISMATCH',
      };
    }

    return null; // Title version stream matches, proceed to detailed range/fix evaluation
  }

  /**
   * Evaluate whether an installed version is vulnerable according to advisory metadata.
   * Returns:
   * {
   *   status: 'vulnerable' | 'not_affected' | 'potential_match',
   *   isVulnerable: boolean,
   *   isNotAffected: boolean,
   *   reason: string,
   *   matchedRule: string
   * }
   */
  evaluate(installedVersion, { affectedVersionsRaw = null, fixedVersion = null, title = null, productName = null } = {}) {
    if (!installedVersion || !installedVersion.trim()) {
      return {
        status: 'potential_match',
        isVulnerable: false,
        isNotAffected: false,
        reason: 'Installed version unknown or unspecified.',
        matchedRule: 'MISSING_INSTALLED_VERSION',
      };
    }

    // 0. Primary check: check version constraints directly specified in the advisory title
    if (title) {
      const titleCheck = this.checkTitleVersionMatch(installedVersion, title, productName);
      if (titleCheck) {
        return titleCheck;
      }
    }

    const instClean = this.cleanUpstreamVersion(installedVersion);

    // 1. If Fixed Version is provided:
    if (fixedVersion && fixedVersion.trim()) {
      // Clean candidate versions from fixedVersion string
      const rawCandidates = fixedVersion.split(/[,\s;/]+/).map((s) => this.cleanUpstreamVersion(s)).filter(Boolean);
      const fixCandidates = rawCandidates.length > 0 ? rawCandidates : [this.cleanUpstreamVersion(fixedVersion)];

      // Find if installed version shares a major/minor branch with any fix candidate
      const instParsed = this.parseVersion(instClean);
      const relevantFix = fixCandidates.find((f) => {
        const fp = this.parseVersion(f);
        // Compare same major (and minor if semver has at least 2 components)
        if (instParsed.parts.length >= 2 && fp.parts.length >= 2) {
          return instParsed.parts[0] === fp.parts[0] && instParsed.parts[1] === fp.parts[1];
        }
        return instParsed.parts[0] === fp.parts[0];
      }) || fixCandidates[0];

      const cmp = this.compareVersions(instClean, relevantFix);

      // If installed is >= fixed version, it is NOT affected
      if (cmp >= 0) {
        return {
          status: 'not_affected',
          isVulnerable: false,
          isNotAffected: true,
          reason: `Installed version ${instClean} is patched (fixed in ${relevantFix}).`,
          matchedRule: 'PATCHED_VERSION_EQUAL_OR_GREATER',
        };
      }
    }

    // 2. Evaluate against Affected Range Bounds if present
    if (affectedVersionsRaw && affectedVersionsRaw.trim()) {
      // Check for compound clauses separated by ';'
      if (affectedVersionsRaw.includes(';')) {
        const clauses = affectedVersionsRaw.split(';').map((s) => s.trim()).filter(Boolean);
        const results = clauses.map((c) => this.evaluateSingleClause(instClean, c, fixedVersion)).filter(Boolean);

        // If any clause marks it vulnerable, it is vulnerable
        const vulnMatch = results.find((r) => r.status === 'vulnerable');
        if (vulnMatch) return vulnMatch;

        // If all clauses evaluated to not_affected, it is not affected
        if (results.length > 0 && results.every((r) => r.status === 'not_affected')) {
          return {
            status: 'not_affected',
            isVulnerable: false,
            isNotAffected: true,
            reason: `Installed version ${instClean} is higher than all affected package bounds.`,
            matchedRule: 'COMPOUND_RANGE_NOT_AFFECTED',
          };
        }

        const reviewMatch = results.find((r) => r.status === 'potential_match');
        if (reviewMatch) return reviewMatch;
      } else {
        const singleResult = this.evaluateSingleClause(instClean, affectedVersionsRaw, fixedVersion);
        if (singleResult) return singleResult;
      }
    }

    // 3. If fixed version was provided and installed version is strictly less than fixed version:
    if (fixedVersion && fixedVersion.trim()) {
      const cleanFix = this.cleanUpstreamVersion(fixedVersion);
      const cmp = this.compareVersions(instClean, cleanFix);
      if (cmp < 0) {
        return {
          status: 'vulnerable',
          isVulnerable: true,
          isNotAffected: false,
          reason: `Installed version ${instClean} is prior to security fix release (${cleanFix}).`,
          matchedRule: 'BELOW_FIXED_VERSION',
        };
      } else {
        return {
          status: 'not_affected',
          isVulnerable: false,
          isNotAffected: true,
          reason: `Installed version ${instClean} is equal to or higher than fix release (${cleanFix}).`,
          matchedRule: 'EQUAL_OR_ABOVE_FIXED_VERSION',
        };
      }
    }

    // 4. Fallback if version bounds could not be parsed definitively
    return {
      status: 'potential_match',
      isVulnerable: false,
      isNotAffected: false,
      reason: `Product matches, but advisory version range '${affectedVersionsRaw || 'Unspecified'}' requires analyst review.`,
      matchedRule: 'NEEDS_REVIEW_UNPARSED',
    };
  }
}

module.exports = new VersionMatcherService();



// Deterministic Version Comparison & Range Evaluation Engine (No LLM, No Hallucinations)

class VersionMatcherService {
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

    const clean = vStr.trim().replace(/^[vV]/, '');
    const tagMatch = clean.match(/[-_\s]+([a-zA-Z]+[a-zA-Z0-9]*)/);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : '';

    const numStr = clean.split(/[-_\s]/)[0];
    const parts = numStr
      .split('.')
      .map((p) => {
        const n = parseInt(p, 10);
        return isNaN(n) ? 0 : n;
      });

    return { parts, raw: vStr.trim(), tag };
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

    // 1. "X through Y" or "X to Y"
    const throughMatch = str.match(/([0-9]+(?:\.[0-9]+)+)\s*(?:through|to|-)\s*([0-9]+(?:\.[0-9]+)+)/i);
    if (throughMatch) {
      return {
        type: 'interval',
        start: throughMatch[1],
        startInclusive: true,
        end: throughMatch[2],
        endInclusive: true,
      };
    }

    // 2. "X and earlier" / "X and prior" / "<= X"
    const earlierMatch = str.match(/([0-9]+(?:\.[0-9]+)+)\s*(?:and\s+earlier|and\s+prior|or\s+earlier|or\s+prior)/i);
    if (earlierMatch) {
      return {
        type: 'upper_bound',
        end: earlierMatch[1],
        endInclusive: true,
      };
    }

    // 3. "< X" or "before X" or "prior to X"
    const beforeMatch = str.match(/(?:<|before|prior\s+to|earlier\s+than)\s*([0-9]+(?:\.[0-9]+)+)/i);
    if (beforeMatch) {
      return {
        type: 'upper_bound',
        end: beforeMatch[1],
        endInclusive: false,
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
  evaluate(installedVersion, { affectedVersionsRaw = null, fixedVersion = null } = {}) {
    if (!installedVersion || !installedVersion.trim()) {
      return {
        status: 'potential_match',
        isVulnerable: false,
        isNotAffected: false,
        reason: 'Installed version unknown or unspecified.',
        matchedRule: 'MISSING_INSTALLED_VERSION',
      };
    }

    const instClean = installedVersion.trim();

    // 1. If Fixed Version is provided:
    if (fixedVersion && fixedVersion.trim()) {
      // Fixed version might list multiple (e.g. "8.1.29, 8.2.20, 8.3.8" or "Node.js 20.15.1, Node.js 22.4.1")
      const fixCandidates = fixedVersion.match(/[0-9]+(?:\.[0-9]+)+/g) || [fixedVersion.trim()];

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
      const bounds = this.extractRangeBounds(affectedVersionsRaw);

      if (bounds) {
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
              reason: `Installed version ${instClean} is within affected versions (${affectedVersionsRaw.trim()}).`,
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
            // Branch matches! If fixed version was earlier checked and didn't clear it, it's vulnerable
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
              reason: `Installed version ${instClean} is not in affected branches (${affectedVersionsRaw.trim()}).`,
              matchedRule: 'BRANCH_MISMATCH',
            };
          }
        }
      }
    }

    // 3. If fixed version was provided and installed version is strictly less than fixed version:
    if (fixedVersion && fixedVersion.trim()) {
      return {
        status: 'vulnerable',
        isVulnerable: true,
        isNotAffected: false,
        reason: `Installed version ${instClean} is prior to security fix release (${fixedVersion.trim()}).`,
        matchedRule: 'BELOW_FIXED_VERSION',
      };
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


const matcherService = require('../services/matcher.service');
const matchRepository = require('../repositories/match.repository');

class MatchController {
  /**
   * POST /api/matches/run
   * Trigger vulnerability matching for the authenticated user.
   */
  async runMatching(req, res, next) {
    try {
      const userId = req.user.id;
      const summary = await matcherService.runForUser(userId);

      let message = 'Matching complete. No vulnerability matches found for your current stack.';
      if (summary.matchesFound > 0) {
        if (summary.vulnerableCount > 0) {
          message = `Scan complete. Found ${summary.vulnerableCount} vulnerable item(s) across ${summary.matchesFound} total matching advisories.`;
        } else {
          message = `Scan complete. Found ${summary.matchesFound} matching advisory notice(s).`;
        }
      }

      return res.status(200).json({
        message,
        summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches
   * List the authenticated user's matches.
   * Query: ?status=&severity=&search=&limit=&offset=
   */
  async getMatches(req, res, next) {
    try {
      const userId = req.user.id;
      const { status = '', severity = '', search = '', limit = 100, offset = 0 } = req.query;

      const validStatuses = ['vulnerable', 'potential_match', 'needs_review', 'confirmed', 'not_affected', 'dismissed', ''];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status filter.' });
      }

      const { matches, total } = await matchRepository.findMatchesByUser(userId, {
        status,
        severity,
        search,
        limit: Number(limit),
        offset: Number(offset),
      });

      return res.status(200).json({ matches, total });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches/summary
   * Dashboard summary: match counts by severity and status for the logged-in user.
   */
  async getMatchSummary(req, res, next) {
    try {
      const userId = req.user.id;
      const summary = await matchRepository.getMatchSummaryForUser(userId);
      return res.status(200).json({ summary });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches/coverage
   * Stack coverage report: supported vs unsupported products, vulnerabilities per stack item.
   */
  async getCoverageReport(req, res, next) {
    try {
      const userId = req.user.id;
      const coverage = await matcherService.getCoverageReport(userId);
      return res.status(200).json(coverage);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/matches/:id
   * Retrieve a single match (must belong to the authenticated user).
   */
  async getMatchById(req, res, next) {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ message: 'Invalid match ID.' });
      }

      const match = await matchRepository.findMatchById(id, userId);
      if (!match) {
        return res.status(404).json({ message: 'Match not found.' });
      }

      return res.status(200).json({ match });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/matches/:id/status
   * Update a match's status. Body: { status, notes? }
   */
  async updateStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ message: 'Invalid match ID.' });
      }

      const { status, notes } = req.body;
      const validStatuses = ['vulnerable', 'potential_match', 'needs_review', 'confirmed', 'not_affected', 'dismissed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          message: `Status must be one of: ${validStatuses.join(', ')}.`,
        });
      }

      if (notes !== undefined && typeof notes !== 'string') {
        return res.status(400).json({ message: 'Notes must be a string.' });
      }

      if (notes && notes.length > 1000) {
        return res.status(400).json({ message: 'Notes must be 1000 characters or fewer.' });
      }

      const updated = await matchRepository.updateMatchStatus(id, userId, status, notes || null);
      if (!updated) {
        return res.status(404).json({ message: 'Match not found.' });
      }

      return res.status(200).json({ message: 'Match status updated.', id: updated.id, status: updated.status });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MatchController();

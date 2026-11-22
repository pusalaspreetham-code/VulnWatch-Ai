const advisoryCollectorService = require('../services/advisory_collector.service');
const advisoryRepository = require('../repositories/advisory.repository');

class AdvisoryController {
  async getSources(req, res, next) {
    try {
      const sources = advisoryCollectorService.getSources();
      res.status(200).json({ sources });
    } catch (err) {
      next(err);
    }
  }

  async triggerCollection(req, res, next) {
    try {
      const { sourceId } = req.body || {};
      const sources = advisoryCollectorService.getSources();

      if (sourceId) {
        const source = sources.find((s) => s.id === sourceId);
        if (!source) {
          return res.status(404).json({ message: `Source ID "${sourceId}" not found.` });
        }
        const result = await advisoryCollectorService.collectFromSource(source);
        return res.status(200).json({
          message: `Collection completed for ${source.sourceName}.`,
          results: [result],
        });
      }

      // Collect all official sources
      const results = await advisoryCollectorService.collectAll();
      res.status(200).json({
        message: 'Security advisory collection finished.',
        results,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAdvisories(req, res, next) {
    try {
      const { vendor, severity, cve, limit = 50, offset = 0 } = req.query;
      const data = await advisoryRepository.findAll({
        vendor,
        severity,
        cve,
        limit,
        offset,
      });
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const advisory = await advisoryRepository.findById(req.params.id);
      if (!advisory) {
        return res.status(404).json({ message: 'Security advisory not found.' });
      }
      res.status(200).json({ advisory });
    } catch (err) {
      next(err);
    }
  }

  async getCollectionRuns(req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const runs = await advisoryRepository.getCollectionRuns({ limit: Number(limit) || 20 });
      res.status(200).json({ runs });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdvisoryController();


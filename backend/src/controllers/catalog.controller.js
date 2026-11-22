const catalogService = require('../services/catalog.service');

class CatalogController {
  async search(req, res, next) {
    try {
      const { q = '', category = '', limit = 50 } = req.query;
      const products = await catalogService.searchCatalog({
        query: q,
        category,
        limit,
      });
      res.status(200).json({ products });
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req, res, next) {
    try {
      const categories = await catalogService.getCategories();
      res.status(200).json({ categories });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const product = await catalogService.getCatalogItem(req.params.id);
      res.status(200).json({ product });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CatalogController();


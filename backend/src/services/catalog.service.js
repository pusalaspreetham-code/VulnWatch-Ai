const catalogRepository = require('../repositories/catalog.repository');

class CatalogService {
  async searchCatalog({ query = '', category = '', limit = 50 }) {
    return catalogRepository.search({ query, category, limit });
  }

  async getCatalogItem(id) {
    if (!id || !/^\d+$/.test(String(id).trim())) {
      const error = new Error('Invalid catalog product ID.');
      error.statusCode = 400;
      throw error;
    }

    const item = await catalogRepository.findById(String(id).trim());
    if (!item) {
      const error = new Error('Catalog product not found.');
      error.statusCode = 404;
      throw error;
    }

    return item;
  }

  async getCategories() {
    return catalogRepository.getCategories();
  }

  /**
   * Resolves a user-typed name to its canonical catalog entry if one exists
   */
  async resolveCanonical(name) {
    if (!name || !name.trim()) return null;
    return catalogRepository.findByCanonicalOrAlias(name);
  }

  async registerProduct(data) {
    return catalogRepository.registerProduct(data);
  }
}

module.exports = new CatalogService();


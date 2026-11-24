const stackRepository = require('../repositories/stack.repository');
const catalogRepository = require('../repositories/catalog.repository');
const stackValidator = require('../validators/stack.validator');
const matcherService = require('./matcher.service');
const matchRepository = require('../repositories/match.repository');

class StackService {
  async getStackItems(userId) {
    return stackRepository.findAllByUserId(userId);
  }

  async getStackItemById(id, userId) {
    const idValidation = stackValidator.validateId(id);
    if (!idValidation.valid) {
      const error = new Error(idValidation.message);
      error.statusCode = 400;
      throw error;
    }

    const item = await stackRepository.findByIdAndUserId(idValidation.value, userId);
    if (!item) {
      const error = new Error('Stack item not found.');
      error.statusCode = 404;
      throw error;
    }

    return item;
  }

  async createStackItem(userId, data) {
    const validation = stackValidator.validateStackItem(data);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.statusCode = 400;
      throw error;
    }

    let { catalogProductId, productName, vendor, installedVersion, notes } = validation.value;

    // If catalog_product_id is provided, pull canonical vendor and product_name
    if (catalogProductId) {
      const catalogItem = await catalogRepository.findById(catalogProductId);
      if (!catalogItem) {
        const error = new Error('Selected catalog product does not exist.');
        error.statusCode = 400;
        throw error;
      }
      productName = catalogItem.product_name;
      vendor = catalogItem.vendor || vendor;
    }

    const created = await stackRepository.create({
      userId,
      catalogProductId: catalogProductId || null,
      vendor: vendor || null,
      productName,
      installedVersion,
      notes: notes || null,
    });

    // Automatically re-evaluate vulnerability matches in background
    matcherService.runForUser(userId).catch(err => {
      console.warn('[STACK AUTO-SCAN] Matcher failed in background:', err.message);
    });

    return created;
  }

  async updateStackItem(id, userId, data) {
    const idValidation = stackValidator.validateId(id);
    if (!idValidation.valid) {
      const error = new Error(idValidation.message);
      error.statusCode = 400;
      throw error;
    }

    const existing = await stackRepository.findByIdAndUserId(idValidation.value, userId);
    if (!existing) {
      const error = new Error('Stack item not found.');
      error.statusCode = 404;
      throw error;
    }

    const validation = stackValidator.validateStackItem(data, { isUpdate: true });
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.statusCode = 400;
      throw error;
    }

    let catalogProductId = validation.value.catalogProductId !== undefined
      ? validation.value.catalogProductId
      : existing.catalog_product_id;

    let productName = validation.value.productName !== undefined
      ? validation.value.productName
      : existing.product_name;

    let vendor = validation.value.vendor !== undefined
      ? validation.value.vendor
      : existing.vendor;

    let installedVersion = validation.value.installedVersion !== undefined
      ? validation.value.installedVersion
      : existing.installed_version;

    let notes = validation.value.notes !== undefined
      ? validation.value.notes
      : existing.notes;

    if (catalogProductId && catalogProductId !== existing.catalog_product_id) {
      const catalogItem = await catalogRepository.findById(catalogProductId);
      if (!catalogItem) {
        const error = new Error('Selected catalog product does not exist.');
        error.statusCode = 400;
        throw error;
      }
      productName = catalogItem.product_name;
      vendor = catalogItem.vendor || vendor;
    }

    const updated = await stackRepository.update(idValidation.value, userId, {
      catalogProductId: catalogProductId || null,
      vendor: vendor || null,
      productName,
      installedVersion,
      notes: notes || null,
    });

    if (!updated) {
      const error = new Error('Stack item not found.');
      error.statusCode = 404;
      throw error;
    }

    // Automatically re-evaluate vulnerability matches in background
    matcherService.runForUser(userId).catch(err => {
      console.warn('[STACK AUTO-SCAN] Matcher failed in background:', err.message);
    });

    return updated;
  }

  async deleteStackItem(id, userId) {
    const idValidation = stackValidator.validateId(id);
    if (!idValidation.valid) {
      const error = new Error(idValidation.message);
      error.statusCode = 400;
      throw error;
    }

    const deleted = await stackRepository.delete(idValidation.value, userId);
    if (!deleted) {
      const error = new Error('Stack item not found.');
      error.statusCode = 404;
      throw error;
    }

    // Clean up matches for deleted stack items
    matchRepository.cleanStaleMatches(userId).catch(err => {
      console.warn('[STACK CLEANUP] Stale match cleanup failed:', err.message);
    });

    return { message: 'Stack item deleted successfully.', id: deleted.id };
  }
}

module.exports = new StackService();

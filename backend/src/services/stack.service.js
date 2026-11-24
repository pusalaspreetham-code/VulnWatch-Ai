const stackRepository = require('../repositories/stack.repository');
const catalogRepository = require('../repositories/catalog.repository');
const stackValidator = require('../validators/stack.validator');
const matcherService = require('./matcher.service');
const matchRepository = require('../repositories/match.repository');
const ecosystemAdvisoryService = require('./ecosystem_advisory.service');

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

    // Validate version format (reject "latest", "stable", non-numeric strings)
    const verCheck = ecosystemAdvisoryService.validateVersionFormat(installedVersion);
    if (!verCheck.valid) {
      const error = new Error(verCheck.message);
      error.statusCode = 400;
      throw error;
    }
    installedVersion = verCheck.sanitized;

    let canonicalName = productName;
    let ecosystem = 'General Software';

    // 1. If catalog_product_id is provided, pull canonical vendor, product_name, and ecosystem
    if (catalogProductId) {
      const catalogItem = await catalogRepository.findById(catalogProductId);
      if (!catalogItem) {
        const error = new Error('Selected catalog product does not exist.');
        error.statusCode = 400;
        throw error;
      }
      productName = catalogItem.product_name;
      canonicalName = catalogItem.product_name;
      vendor = catalogItem.vendor || vendor;
      ecosystem = catalogItem.ecosystem || 'General Software';
    } else {
      // 2. Resolve canonical product & aliases (e.g., "python3" -> "Python", "nodejs" -> "Node.js", "docker" -> "Docker Engine")
      const resolved = await catalogRepository.findByCanonicalOrAlias(productName);
      if (resolved) {
        catalogProductId = resolved.id;
        productName = resolved.product_name;
        canonicalName = resolved.product_name;
        vendor = resolved.vendor || vendor;
        ecosystem = resolved.ecosystem || 'General Software';
      } else {
        // 3. New / Custom Product: Identify ecosystem automatically & register into extensible catalog
        ecosystem = ecosystemAdvisoryService.identifyEcosystem(productName, vendor);
        canonicalName = productName;
        try {
          const registered = await catalogRepository.registerProduct({
            vendor: vendor || null,
            productName,
            category: 'Custom Package',
            ecosystem,
            aliases: [productName.toLowerCase(), productName.toLowerCase().replace(/[^a-z0-9]/g, '')],
            versionFormat: 'semver',
            description: `User-monitored ${productName} (${ecosystem})`,
          });
          if (registered) catalogProductId = registered.id;
        } catch (regErr) {
          // Non-critical if auto-register fails
          console.warn('[CATALOG EXTENSION] Dynamic catalog registration notice:', regErr.message);
        }
      }
    }

    // 4. Prevent duplicate stack entries: same user + same product name OR canonical alias
    const existing = await stackRepository.findByUserAndProductName(userId, productName, canonicalName);
    if (existing) {
      const error = new Error(
        `You are already monitoring "${existing.canonical_name || existing.product_name}" (v${existing.installed_version || 'unknown'}). ` +
        `Edit the existing entry instead of adding a duplicate.`
      );
      error.statusCode = 409;
      throw error;
    }

    const created = await stackRepository.create({
      userId,
      catalogProductId: catalogProductId || null,
      vendor: vendor || null,
      productName,
      canonicalName,
      ecosystem,
      installedVersion,
      notes: notes || null,
    });

    // 5. Automatically fetch advisories and re-evaluate vulnerability matches in background
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

    if (installedVersion) {
      const verCheck = ecosystemAdvisoryService.validateVersionFormat(installedVersion);
      if (!verCheck.valid) {
        const error = new Error(verCheck.message);
        error.statusCode = 400;
        throw error;
      }
      installedVersion = verCheck.sanitized;
    }

    let canonicalName = existing.canonical_name || productName;
    let ecosystem = existing.ecosystem || 'General Software';

    if (catalogProductId && catalogProductId !== existing.catalog_product_id) {
      const catalogItem = await catalogRepository.findById(catalogProductId);
      if (!catalogItem) {
        const error = new Error('Selected catalog product does not exist.');
        error.statusCode = 400;
        throw error;
      }
      productName = catalogItem.product_name;
      canonicalName = catalogItem.product_name;
      vendor = catalogItem.vendor || vendor;
      ecosystem = catalogItem.ecosystem || 'General Software';
    } else {
      const resolved = await catalogRepository.findByCanonicalOrAlias(productName);
      if (resolved) {
        canonicalName = resolved.product_name;
        ecosystem = resolved.ecosystem || 'General Software';
      }
    }

    const updated = await stackRepository.update(idValidation.value, userId, {
      catalogProductId: catalogProductId || null,
      vendor: vendor || null,
      productName,
      canonicalName,
      ecosystem,
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

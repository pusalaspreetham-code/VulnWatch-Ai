class StackValidator {
  validateId(id) {
    if (!id || !/^\d+$/.test(String(id).trim())) {
      return { valid: false, message: 'Invalid item ID.' };
    }
    return { valid: true, value: String(id).trim() };
  }

  validateStackItem(data, { isUpdate = false } = {}) {
    const errors = [];

    // Optional catalog_product_id
    let catalogProductId = undefined;
    if (data.catalog_product_id !== undefined) {
      if (data.catalog_product_id === null || data.catalog_product_id === '') {
        catalogProductId = null;
      } else if (!/^\d+$/.test(String(data.catalog_product_id).trim())) {
        errors.push('Invalid catalog product ID.');
      } else {
        catalogProductId = String(data.catalog_product_id).trim();
      }
    }

    // 1. product_name
    let productName = undefined;
    if (data.product_name !== undefined) {
      if (typeof data.product_name !== 'string' || !data.product_name.trim()) {
        if (!isUpdate && !catalogProductId) {
          errors.push('Product name is required.');
        }
      } else if (data.product_name.trim().length > 255) {
        errors.push('Product name must not exceed 255 characters.');
      } else {
        productName = data.product_name.trim();
      }
    } else if (!isUpdate && !catalogProductId) {
      errors.push('Product name is required.');
    }

    // 2. installed_version
    let installedVersion = undefined;
    if (data.installed_version !== undefined) {
      if (typeof data.installed_version !== 'string' || !data.installed_version.trim()) {
        errors.push('Installed version is required.');
      } else if (data.installed_version.trim().length > 100) {
        errors.push('Installed version must not exceed 100 characters.');
      } else {
        installedVersion = data.installed_version.trim();
      }
    } else if (!isUpdate) {
      errors.push('Installed version is required.');
    }

    // 3. vendor (Optional)
    let vendor = undefined;
    if (data.vendor !== undefined) {
      if (data.vendor === null || data.vendor === '') {
        vendor = null;
      } else if (typeof data.vendor !== 'string') {
        errors.push('Vendor must be a text value.');
      } else {
        const trimmed = data.vendor.trim();
        if (trimmed.length > 255) {
          errors.push('Vendor name must not exceed 255 characters.');
        } else {
          vendor = trimmed.length > 0 ? trimmed : null;
        }
      }
    }

    // 4. notes (Optional)
    let notes = undefined;
    if (data.notes !== undefined) {
      if (data.notes === null || data.notes === '') {
        notes = null;
      } else if (typeof data.notes !== 'string') {
        errors.push('Notes must be a text value.');
      } else {
        const trimmed = data.notes.trim();
        if (trimmed.length > 2000) {
          errors.push('Notes must not exceed 2000 characters.');
        } else {
          notes = trimmed.length > 0 ? trimmed : null;
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      value: {
        catalogProductId,
        productName,
        installedVersion,
        vendor,
        notes,
      },
    };
  }
}

module.exports = new StackValidator();

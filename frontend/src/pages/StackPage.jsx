import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { stackApi } from '../api/stack';
import { catalogApi } from '../api/catalog';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  X,
  Package,
  Calendar,
  Building2,
  Tag,
  FileText,
  ChevronDown,
  Sparkles,
  Info
} from 'lucide-react';

export default function StackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [mode, setMode] = useState('catalog'); // 'catalog' | 'custom'

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    product_name: '',
    installed_version: '',
    vendor: '',
    notes: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  // Close catalog dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch catalog search results
  useEffect(() => {
    if (mode !== 'catalog' || selectedCatalogProduct) return;

    const timer = setTimeout(async () => {
      setIsSearchingCatalog(true);
      try {
        const res = await catalogApi.searchCatalog(catalogQuery);
        setCatalogResults(res.products || []);
      } catch (err) {
        console.error('Catalog search error:', err);
      } finally {
        setIsSearchingCatalog(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [catalogQuery, mode, selectedCatalogProduct]);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await stackApi.getStackItems();
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load stack items.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setMode('catalog');
    setSelectedCatalogProduct(null);
    setCatalogQuery('');
    setCatalogResults([]);
    setShowDropdown(false);
    setFormData({
      product_name: '',
      installed_version: '',
      vendor: '',
      notes: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setMode(item.catalog_product_id ? 'catalog' : 'custom');
    if (item.catalog_product_id) {
      setSelectedCatalogProduct({
        id: item.catalog_product_id,
        product_name: item.product_name,
        vendor: item.vendor,
        category: item.category,
        known_versions: item.known_versions || [],
      });
    } else {
      setSelectedCatalogProduct(null);
    }
    setFormData({
      product_name: item.product_name,
      installed_version: item.installed_version,
      vendor: item.vendor || '',
      notes: item.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setSelectedCatalogProduct(null);
    setFormError('');
  };

  const handleSelectCatalogProduct = (product) => {
    setSelectedCatalogProduct(product);
    setFormData((prev) => ({
      ...prev,
      product_name: product.product_name,
      vendor: product.vendor || '',
    }));
    setShowDropdown(false);
    setCatalogQuery('');
  };

  const handleClearSelectedProduct = () => {
    setSelectedCatalogProduct(null);
    setFormData((prev) => ({
      ...prev,
      product_name: '',
      vendor: '',
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (mode === 'catalog' && !selectedCatalogProduct && !editingItem) {
      setFormError('Please select a product from the catalog, or switch to Custom Product.');
      return;
    }

    if (mode === 'custom' && !formData.product_name.trim()) {
      setFormError('Product name is required.');
      return;
    }

    if (!formData.installed_version.trim()) {
      setFormError('Installed version is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        catalog_product_id: selectedCatalogProduct ? selectedCatalogProduct.id : null,
        product_name: formData.product_name.trim(),
        vendor: formData.vendor ? formData.vendor.trim() : null,
        installed_version: formData.installed_version.trim(),
        notes: formData.notes ? formData.notes.trim() : null,
      };

      if (editingItem) {
        await stackApi.updateStackItem(editingItem.id, payload);
        setSuccessMessage(`Updated "${formData.product_name}" successfully.`);
      } else {
        await stackApi.createStackItem(payload);
        setSuccessMessage(`Added "${formData.product_name}" to monitored stack.`);
      }
      handleCloseModal();
      await fetchItems();
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err) {
      setFormError(err.message || 'Failed to save technology item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await stackApi.deleteStackItem(itemToDelete.id);
      setSuccessMessage(`Removed "${itemToDelete.product_name}" from monitored stack.`);
      setItemToDelete(null);
      await fetchItems();
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to delete item.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = item.product_name.toLowerCase().includes(q);
    const vendorMatch = (item.vendor || '').toLowerCase().includes(q);
    const versionMatch = item.installed_version.toLowerCase().includes(q);
    const notesMatch = (item.notes || '').toLowerCase().includes(q);
    const categoryMatch = (item.category || '').toLowerCase().includes(q);
    return nameMatch || vendorMatch || versionMatch || notesMatch || categoryMatch;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', width: '100%' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>
                Monitored Technology Stack
              </h1>
              <span className="count-badge">
                {items.length} {items.length === 1 ? 'software' : 'softwares'}
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
              Register software installed across your infrastructure to monitor against vulnerability advisories.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 18px' }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Technology</span>
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="stack-search-bar">
          <div className="search-input-wrapper">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, vendor, version, category, or notes..."
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="clear-search-btn"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div className="animate-spin-fast" style={{ display: 'inline-block', marginBottom: 12 }}>
              <Package size={28} />
            </div>
            <div>Loading technology stack...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon">
              <Layers size={32} color="#0f172a" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              {searchQuery ? 'No matching software found' : 'No technologies monitored yet'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 420, margin: '0 auto 20px' }}>
              {searchQuery
                ? `No items matched your query "${searchQuery}". Try a different keyword.`
                : 'Add software products and exact installed versions from our catalog or enter custom software to monitor advisories.'}
            </p>
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="btn-secondary">
                Clear Search
              </button>
            ) : (
              <button onClick={handleOpenAddModal} className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
                <Plus size={16} strokeWidth={2.5} />
                <span>Add Your First Technology</span>
              </button>
            )}
          </div>
        ) : (
          <div className="stack-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="stack-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {item.vendor && (
                        <span className="item-vendor-tag">
                          <Building2 size={12} />
                          <span>{item.vendor}</span>
                        </span>
                      )}
                      {item.category && (
                        <span className="category-pill">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h3 className="item-product-name">{item.product_name}</h3>
                  </div>

                  <div className="item-action-buttons">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="icon-action-btn"
                      title="Edit technology"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="icon-action-btn delete"
                      title="Delete technology"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="item-version-row">
                  <span className="version-pill">
                    <Tag size={12} strokeWidth={2.2} />
                    <span>v{item.installed_version}</span>
                  </span>
                  <span className="date-added">
                    <Calendar size={12} />
                    <span>Added {new Date(item.created_at).toLocaleDateString()}</span>
                  </span>
                </div>

                {item.notes ? (
                  <p className="item-notes">
                    <FileText size={13} style={{ flexShrink: 0, marginTop: 2, color: '#94a3b8' }} />
                    <span>{item.notes}</span>
                  </p>
                ) : (
                  <p className="item-notes empty">No additional notes</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Technology Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {editingItem ? 'Edit Technology' : 'Add Monitored Technology'}
              </h2>
              <button onClick={handleCloseModal} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            {/* Mode Tabs (Only for Add modal) */}
            {!editingItem && (
              <div className="mode-tabs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('catalog');
                    setFormError('');
                  }}
                  className={`mode-tab ${mode === 'catalog' ? 'active' : ''}`}
                >
                  <Sparkles size={14} />
                  <span>Search Catalog (Recommended)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('custom');
                    setSelectedCatalogProduct(null);
                    setFormError('');
                  }}
                  className={`mode-tab ${mode === 'custom' ? 'active' : ''}`}
                >
                  <span>Custom / Unlisted Product</span>
                </button>
              </div>
            )}

            {formError && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              {/* Catalog Selection Mode */}
              {mode === 'catalog' && (
                <div className="form-group" ref={dropdownRef}>
                  <label className="form-label">Software Product *</label>

                  {selectedCatalogProduct ? (
                    <div className="selected-product-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="selected-product-icon">
                          <Package size={20} color="#0f172a" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>
                            {selectedCatalogProduct.product_name}
                          </div>
                          <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                            {selectedCatalogProduct.vendor} &bull; {selectedCatalogProduct.category}
                          </div>
                        </div>
                      </div>

                      {!editingItem && (
                        <button
                          type="button"
                          onClick={handleClearSelectedProduct}
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.775rem' }}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div className="input-container">
                        <input
                          type="text"
                          placeholder="Search catalog: e.g. PHP, PostgreSQL, Ubuntu, Nginx, Docker..."
                          value={catalogQuery}
                          onChange={(e) => {
                            setCatalogQuery(e.target.value);
                            setShowDropdown(true);
                          }}
                          onFocus={() => setShowDropdown(true)}
                          className="form-input"
                          autoFocus
                        />
                        <div style={{ position: 'absolute', right: 12, color: '#94a3b8', pointerEvents: 'none' }}>
                          <ChevronDown size={16} />
                        </div>
                      </div>

                      {showDropdown && (
                        <div className="catalog-dropdown">
                          {isSearchingCatalog ? (
                            <div className="catalog-dropdown-status">Searching catalog...</div>
                          ) : catalogResults.length === 0 ? (
                            <div className="catalog-dropdown-status">
                              No catalog matches for "{catalogQuery}".
                              <div style={{ marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMode('custom');
                                    setFormData((prev) => ({ ...prev, product_name: catalogQuery }));
                                    setShowDropdown(false);
                                  }}
                                  className="btn-link"
                                >
                                  Click here to add as custom product &rarr;
                                </button>
                              </div>
                            </div>
                          ) : (
                            catalogResults.map((product) => (
                              <div
                                key={product.id}
                                onClick={() => handleSelectCatalogProduct(product)}
                                className="catalog-dropdown-item"
                              >
                                <div>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                                    {product.product_name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {product.vendor}
                                  </div>
                                </div>
                                <span className="category-pill-sm">{product.category}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Mode: Product Name & Vendor */}
              {mode === 'custom' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MyInHouseGateway, CustomAgent"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      className="form-input"
                      maxLength={255}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor / Author (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Internal Team, Acme Corp"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="form-input"
                      maxLength={255}
                    />
                  </div>
                </>
              )}

              {/* Version Input & Quick-Select Version Pills */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Exact Installed Version *</label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Enter the exact version running in your environment
                  </span>
                </div>

                <input
                  type="text"
                  required
                  placeholder="e.g. 8.3.14, 2.4.52, 16.2, 22.04 LTS"
                  value={formData.installed_version}
                  onChange={(e) => setFormData({ ...formData, installed_version: e.target.value })}
                  className="form-input"
                  maxLength={100}
                />

                {/* Automatic Version Selector Pills from Catalog */}
                {selectedCatalogProduct?.known_versions && selectedCatalogProduct.known_versions.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                      Common versions for {selectedCatalogProduct.product_name} (click to select):
                    </div>
                    <div className="version-chips-row">
                      {selectedCatalogProduct.known_versions.map((ver) => (
                        <button
                          key={ver}
                          type="button"
                          onClick={() => setFormData({ ...formData, installed_version: ver })}
                          className={`version-chip ${formData.installed_version === ver ? 'selected' : ''}`}
                        >
                          v{ver}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Notes */}
              <div className="form-group">
                <label className="form-label">Notes & Deployment Context (Optional)</label>
                <textarea
                  placeholder="e.g. Production edge reverse proxy, internal microservice cluster"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-input"
                  rows={2}
                  maxLength={2000}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                >
                  {formSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Monitored Stack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Remove Technology?
              </h2>
              <button onClick={() => setItemToDelete(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to stop monitoring <strong>{itemToDelete.product_name}</strong> (v{itemToDelete.installed_version})? Vulnerability advisories will no longer be tracked for this item.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Keep Technology
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

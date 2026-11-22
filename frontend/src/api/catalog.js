const API_BASE = '/api/catalog';

async function request(url = '', options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Failed to fetch catalog.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const catalogApi = {
  searchCatalog: (q = '', category = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(queryString);
  },

  getCategories: () => request('/categories'),

  getCatalogItemById: (id) => request(`/${id}`),
};


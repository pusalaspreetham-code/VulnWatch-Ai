const API_BASE = '/api/stack';

async function request(url = '', options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include HTTP-only session cookies
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
    const error = new Error(data.message || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const stackApi = {
  getStackItems: () => request(''),
  getStackItemById: (id) => request(`/${id}`),
  createStackItem: (data) =>
    request('', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStackItem: (id, data) =>
    request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteStackItem: (id) =>
    request(`/${id}`, {
      method: 'DELETE',
    }),
};


const API_BASE = '/api/matches';

async function request(url = '', options = {}) {
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...options.headers },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const matchesApi = {
  runMatching: () => request('/run', { method: 'POST' }),
  getMatches: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
    ).toString();
    return request(qs ? `?${qs}` : '');
  },
  getMatchSummary: () => request('/summary'),
  getCoverageReport: () => request('/coverage'),
  getMatchById: (id) => request(`/${id}`),
  explainMatch: (id, refresh = false) =>
    request(`/${id}/explain${refresh ? '?refresh=true' : ''}`, {
      method: 'POST',
    }),
  updateMatchStatus: (id, status, notes) =>
    request(`/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
};


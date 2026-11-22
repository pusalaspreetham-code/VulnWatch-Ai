// API helper with credentials (cookies) included
const API_BASE = '/api/auth';

async function request(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include HTTP-only cookies
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
    error.requiresVerification = data.requiresVerification;
    error.email = data.email;
    throw error;
  }

  return data;
}

export const authApi = {
  register: (email, password) =>
    request('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verifyRegistrationOtp: (email, otp) =>
    request('/verify-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  login: (email, password) =>
    request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request('/logout', {
      method: 'POST',
    }),

  getMe: () => request('/me', { method: 'GET' }),

  requestForgotPasswordOtp: (email) =>
    request('/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email, otp, newPassword) =>
    request('/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),

  requestChangePasswordOtp: () =>
    request('/change-password/request-otp', {
      method: 'POST',
    }),

  changePassword: (currentPassword, newPassword, otp) =>
    request('/change-password/verify', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, otp }),
    }),

  resendOtp: (email, purpose) =>
    request('/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),
};


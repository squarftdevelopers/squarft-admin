// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const getAuthToken = () => {
  try {
    return localStorage.getItem('authToken');
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const getAuthHeaders = ({ skipAuth = false } = {}) => {
  const token = getAuthToken();

  return {
    'Content-Type': 'application/json',
    ...(!skipAuth && token && { Authorization: `Bearer ${token}` }),
  };
};

export const handleApiError = async (response) => {
  const contentType = response.headers.get('content-type');
  let errorData;

  try {
    errorData = contentType?.includes('application/json')
      ? await response.json()
      : { message: await response.text() };
  } catch {
    errorData = { message: 'An unexpected error occurred' };
  }

  return {
    status: response.status,
    message: errorData.message || 'Something went wrong',
    errors: errorData.errors || [],
  };
};

// Session-expiry handling — same intent as the pattern already correct in
// squarft-project-panel/services/api.js:67-76 (clear the stored session on a
// 401), adapted for this app's plain-fetch client instead of an axios
// interceptor. A hard redirect (not a router navigate call, which isn't
// reachable from a plain module function) guarantees Redux/localStorage
// state is fully reset rather than left half-cleared.
const handleSessionExpiry = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userData');
  if (window.location.pathname !== '/auth/login') {
    window.location.href = '/auth/login';
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const { skipAuth = false, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${endpoint}`;
  const isMultipart = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...(isMultipart
          ? (() => {
              const { 'Content-Type': _contentType, ...headers } = getAuthHeaders({ skipAuth });
              return headers;
            })()
          : getAuthHeaders({ skipAuth })),
        ...fetchOptions.headers,
      },
    });

    if (response.status === 401 && !skipAuth) {
      handleSessionExpiry();
      throw { status: 401, message: 'Session expired. Please log in again.', errors: [] };
    }

    if (!response.ok) {
      throw await handleApiError(response);
    }

    const contentType = response.headers.get('content-type');
    return contentType?.includes('application/json')
      ? response.json()
      : { success: true };
  } catch (error) {
    if (error.status && error.message) {
      throw error;
    }

    throw {
      status: 0,
      message: error.message === 'Failed to fetch'
        ? `Unable to connect to backend at ${API_BASE_URL}. Make sure the backend server is running.`
        : error.message || 'Network error occurred',
      errors: [],
    };
  }
};

export default API_BASE_URL;

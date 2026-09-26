// Base API URL: Uses VITE_API_URL in production or empty string (local proxy) during development
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

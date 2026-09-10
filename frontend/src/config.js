// Config module for dynamic API URL (Vercel Frontend -> Render Backend)
export const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

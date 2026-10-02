// API Configuration
// In production, this points to the Render backend.
// In development, it uses the local server.
const API_BASE_URL = (window.location.origin.includes('onrender.com') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '' 
  : 'https://ecocloud-ai-multicloud-governance.onrender.com';

// API Configuration
// In production, this points to the Render backend.
// In development, it uses the local server.
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? '' 
  : 'https://ecocloud-ai-multicloud-governance.onrender.com';

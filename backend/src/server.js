const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { checkHealth } = require('./database/database');
const providersRouter = require('./routes/providers');
const jobsRouter = require('./routes/jobs');
const decisionsRouter = require('./routes/decisions');
const simulationsRouter = require('./routes/simulations');
const analyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://localhost:3000',
    /\.vercel\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/providers', providersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/analytics', analyticsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbHealth = checkHealth();
  const isHealthy = dbHealth.status === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    project: 'Agentic AI for Autonomous Cost- and Carbon-Aware Multi-Cloud Resource Governance',
    engineStatus: 'EcoCloud AI — Autonomous Multi-Cloud Governance Engine (Production v1.0)',
    team: [
      { name: 'Nishaan Gowda S R', usn: '1RVU23CSE311' },
      { name: 'Raksha R', usn: '1RVU23CSE367' }
    ],
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth
  });
});

// Fallback for root route if index.html is requested
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.originalUrl} does not exist.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 Multi-Cloud Governance API Server running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend UI:  http://localhost:${PORT}/`);
  console.log(`=============================================================`);
});

module.exports = { app, server };

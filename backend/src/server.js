const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const authRoutes = require('./routes/auth.routes');
const stackRoutes = require('./routes/stack.routes');
const catalogRoutes = require('./routes/catalog.routes');
const advisoryRoutes = require('./routes/advisory.routes');
const matchRoutes = require('./routes/match.routes');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for frontend requests with credentials (cookies)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parsers
app.use(express.json());
app.use(cookieParser());

// Base health routes
app.get('/', (req, res) => {
  res.json({ message: 'VulnWatch-AI backend is running' });
});

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      message: 'Healthy',
      database: 'Connected',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({
      message: 'Unhealthy',
      database: 'Disconnected',
    });
  }
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Technology Stack routes
app.use('/api/stack', stackRoutes);

// Software Product Catalog routes
app.use('/api/catalog', catalogRoutes);

// Security Advisory Collection routes
app.use('/api/advisories', advisoryRoutes);

// Vulnerability Matching routes
app.use('/api/matches', matchRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode === 500) {
    console.error('Unhandled server error:', err);
  }

  res.status(statusCode).json({
    message,
    ...(err.requiresVerification ? { requiresVerification: true, email: err.email } : {}),
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

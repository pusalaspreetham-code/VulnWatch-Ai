const express = require('express');
const matchController = require('../controllers/match.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// All match routes require authentication
router.use(authMiddleware);

// Summary for dashboard
router.get('/summary', (req, res, next) => matchController.getMatchSummary(req, res, next));

// Coverage report for monitored stack
router.get('/coverage', (req, res, next) => matchController.getCoverageReport(req, res, next));

// Trigger matching for the logged-in user
router.post('/run', (req, res, next) => matchController.runMatching(req, res, next));

// List all matches (with optional ?status=, ?severity=, ?search=)
router.get('/', (req, res, next) => matchController.getMatches(req, res, next));

// Single match detail
router.get('/:id', (req, res, next) => matchController.getMatchById(req, res, next));

// Update match status
router.patch('/:id/status', (req, res, next) => matchController.updateStatus(req, res, next));

module.exports = router;

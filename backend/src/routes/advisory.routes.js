const express = require('express');
const advisoryController = require('../controllers/advisory.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// All advisory routes require authentication
router.use(authMiddleware);

router.get('/sources', (req, res, next) => advisoryController.getSources(req, res, next));
router.post('/collect', (req, res, next) => advisoryController.triggerCollection(req, res, next));
router.get('/runs', (req, res, next) => advisoryController.getCollectionRuns(req, res, next));
router.get('/', (req, res, next) => advisoryController.getAdvisories(req, res, next));
router.get('/:id', (req, res, next) => advisoryController.getById(req, res, next));

module.exports = router;


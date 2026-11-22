const express = require('express');
const catalogController = require('../controllers/catalog.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Protected with existing authentication middleware
router.use(authMiddleware);

router.get('/', (req, res, next) => catalogController.search(req, res, next));
router.get('/categories', (req, res, next) => catalogController.getCategories(req, res, next));
router.get('/:id', (req, res, next) => catalogController.getById(req, res, next));

module.exports = router;


const express = require('express');
const stackController = require('../controllers/stack.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// All stack endpoints require an authenticated user
router.use(authMiddleware);

router.get('/', (req, res, next) => stackController.getAll(req, res, next));
router.post('/', (req, res, next) => stackController.create(req, res, next));
router.get('/:id', (req, res, next) => stackController.getById(req, res, next));
router.put('/:id', (req, res, next) => stackController.update(req, res, next));
router.delete('/:id', (req, res, next) => stackController.delete(req, res, next));

module.exports = router;


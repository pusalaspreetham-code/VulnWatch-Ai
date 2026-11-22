const stackService = require('../services/stack.service');

class StackController {
  async getAll(req, res, next) {
    try {
      const items = await stackService.getStackItems(req.user.id);
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const item = await stackService.getStackItemById(req.params.id, req.user.id);
      res.status(200).json({ item });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const item = await stackService.createStackItem(req.user.id, req.body);
      res.status(201).json({
        message: 'Technology added to stack successfully.',
        item,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const item = await stackService.updateStackItem(req.params.id, req.user.id, req.body);
      res.status(200).json({
        message: 'Technology updated successfully.',
        item,
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await stackService.deleteStackItem(req.params.id, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StackController();


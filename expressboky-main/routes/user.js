const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUserHome);
router.get('/profile', userController.getUserProfile);
router.get('/settings', userController.getUserSettings);
router.post('/add', userController.addUser);
router.get('/view', userController.listUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;

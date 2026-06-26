const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  upload,
  uploadMemory,
  getMemoriesByUserId,
  deleteMemory,
  getMemoriesFeed
} = require('../controllers/memoryController');

router.post('/', protect, upload.single('photo'), uploadMemory);
router.get('/feed', protect, getMemoriesFeed);
router.get('/user/:userId', protect, getMemoriesByUserId);
router.delete('/:id', protect, deleteMemory);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getFeedbacks,
  updateFeedbackStatus,
  deleteFeedback,
} = require('../controllers/feedbackController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.post('/', optionalAuth, submitFeedback);
router.get('/', getFeedbacks);
router.put('/:id/status', updateFeedbackStatus);
router.delete('/:id', deleteFeedback);

module.exports = router;

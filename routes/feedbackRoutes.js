const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedbacks } = require('../controllers/feedbackController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.post('/', optionalAuth, submitFeedback);
router.get('/', getFeedbacks);

module.exports = router;

const express = require('express');
const { 
  register, 
  login, 
  getMe,
  googleOAuthRedirect,
  googleOAuthCallback,
  githubOAuthRedirect,
  githubOAuthCallback
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// OAuth routes
router.get('/google', googleOAuthRedirect);
router.get('/google/callback', googleOAuthCallback);
router.get('/github', githubOAuthRedirect);
router.get('/github/callback', githubOAuthCallback);

module.exports = router;

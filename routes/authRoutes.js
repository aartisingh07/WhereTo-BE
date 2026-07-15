const express = require('express');
const { 
  register, 
  login, 
  getMe,
  googleOAuthRedirect,
  googleOAuthCallback,
  githubOAuthRedirect,
  githubOAuthCallback,
  upload,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, upload.single('photo'), updateProfile);

// OAuth routes
router.get('/google', googleOAuthRedirect);
router.get('/google/callback', googleOAuthCallback);
router.get('/github', githubOAuthRedirect);
router.get('/github/callback', githubOAuthCallback);

module.exports = router;

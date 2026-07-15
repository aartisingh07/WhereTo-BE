const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  return res.status(400).json({
    message: 'Traditional registration is disabled. Please use Google or GitHub social login.'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  return res.status(400).json({
    message: 'Traditional login is disabled. Please use Google or GitHub social login.'
  });
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      name: user.name || '',
      bio: user.bio || '',
      lastUsernameChange: user.lastUsernameChange || null,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

// Helper to get or create OAuth user in database
const getOrCreateOAuthUser = async (oauthIdField, oauthId, email, defaultUsername, defaultAvatar) => {
  let user = await User.findOne({ [oauthIdField]: oauthId });

  if (!user) {
    user = await User.findOne({ email });

    if (user) {
      user[oauthIdField] = oauthId;
      if (!user.avatar) user.avatar = defaultAvatar;
      if (!user.name) user.name = defaultUsername || '';
      await user.save();
    } else {
      const randomPassword = Math.random().toString(36).slice(-12) + 'OAuth!';
      
      let cleanUsername;
      if (oauthIdField === 'googleId') {
        // Assign random username for Google sign-in
        cleanUsername = 'User_' + Math.floor(10000 + Math.random() * 90000);
      } else {
        cleanUsername = defaultUsername.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
      }

      const usernameExists = await User.findOne({ username: cleanUsername });
      if (usernameExists) {
        cleanUsername = cleanUsername + Math.floor(Math.random() * 100);
      }

      user = await User.create({
        username: cleanUsername,
        name: defaultUsername || '',
        email,
        password: randomPassword,
        avatar: defaultAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${cleanUsername}`,
        [oauthIdField]: oauthId
      });
    }
  }

  return user;
};

// Helper for demo mock redirection
const handleDemoBypass = async (res, provider, email, username) => {
  try {
    const oauthIdField = `${provider}Id`;
    const mockId = `mock_${provider}_id_12345`;
    const defaultAvatar = `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}`;
    
    const user = await getOrCreateOAuthUser(oauthIdField, mockId, email, username, defaultAvatar);
    const token = generateToken(user._id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
  } catch (error) {
    console.error(`Bypass OAuth error for ${provider}:`, error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

// @desc    Redirect to Google OAuth consent
// @route   GET /api/auth/google
// @access  Public
const googleOAuthRedirect = async (req, res, next) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const isPlaceholder = !clientId || clientId.trim() === '' || clientId.includes('placeholder');

  if (isPlaceholder) {
    console.log('Google OAuth credentials not configured. Executing simulated bypass...');
    return handleDemoBypass(res, 'google', 'google_demo@whereto.com', 'GoogleUser');
  }

  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=profile%20email`;
  res.redirect(redirectUrl);
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const googleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, email, name, picture } = profileResponse.data;

    const user = await getOrCreateOAuthUser('googleId', id, email, name || 'GoogleUser', picture);
    const token = generateToken(user._id);

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-success?token=${token}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
};

// @desc    Redirect to GitHub OAuth consent
// @route   GET /api/auth/github
// @access  Public
const githubOAuthRedirect = async (req, res, next) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const isPlaceholder = !clientId || clientId.trim() === '' || clientId.includes('placeholder');

  if (isPlaceholder) {
    console.log('GitHub OAuth credentials not configured. Executing simulated bypass...');
    return handleDemoBypass(res, 'github', 'github_demo@whereto.com', 'GitHubUser');
  }

  const callbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback';
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=user:email`;
  res.redirect(redirectUrl);
};

// @desc    GitHub OAuth callback
// @route   GET /api/auth/github/callback
// @access  Public
const githubOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_code`);
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback';

    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = tokenResponse.data;

    const profileResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id, login, avatar_url } = profileResponse.data;
    let email = profileResponse.data.email;

    if (!email) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
      email = primaryEmail ? primaryEmail.email : `${login}@github-oauth.com`;
    }

    const user = await getOrCreateOAuthUser('githubId', id.toString(), email, login || 'GitHubUser', avatar_url);
    const token = generateToken(user._id);

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth-success?token=${token}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for In-Memory Storage (limit to 2MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }
});

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'whereto_avatars' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// @desc    Update user profile details (Photo, Name, Username)
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, username, bio } = req.body;

    // Check username change constraints
    if (username && username.trim() !== user.username) {
      const cleanUsername = username.trim();

      const usernameRegex = /^[a-zA-Z0-9._]+$/;
      if (!usernameRegex.test(cleanUsername)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, periods (.), and underscores (_)' });
      }

      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        return res.status(400).json({ message: 'Username must be between 3 and 20 characters' });
      }

      if (cleanUsername.startsWith('.') || cleanUsername.endsWith('.')) {
        return res.status(400).json({ message: 'Username cannot start or end with a period' });
      }

      if (cleanUsername.includes('..')) {
        return res.status(400).json({ message: 'Username cannot contain consecutive periods' });
      }

      // Enforce once a month constraint (30 days)
      if (user.lastUsernameChange) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const timeSinceLastChange = Date.now() - user.lastUsernameChange.getTime();
        if (timeSinceLastChange < thirtyDaysMs) {
          const nextAvailableDate = new Date(user.lastUsernameChange.getTime() + thirtyDaysMs);
          return res.status(400).json({ 
            message: `You can only change your username once a month. Next change available on ${nextAvailableDate.toLocaleDateString()}` 
          });
        }
      }

      // Check if username is already taken
      const usernameExists = await User.findOne({ username: cleanUsername });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }

      user.username = cleanUsername;
      user.lastUsernameChange = new Date();
    }

    // Update name
    if (name !== undefined) {
      user.name = name.trim();
    }

    // Update bio
    if (bio !== undefined) {
      const words = bio.trim().split(/\s+/).filter(Boolean);
      if (words.length > 300) {
        return res.status(400).json({ message: 'About Me section cannot exceed 300 words' });
      }
      user.bio = bio.trim();
    }

    // Update avatar if file is uploaded
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      user.avatar = result.secure_url;
    }

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      name: user.name || '',
      bio: user.bio || '',
      email: user.email,
      avatar: user.avatar,
      lastUsernameChange: user.lastUsernameChange || null,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  register, 
  login, 
  getMe, 
  googleOAuthRedirect, 
  googleOAuthCallback, 
  githubOAuthRedirect, 
  githubOAuthCallback,
  upload,
  updateProfile
};

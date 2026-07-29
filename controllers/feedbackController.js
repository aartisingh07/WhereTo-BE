const Feedback = require('../models/Feedback');

// @desc    Submit feedback / contact form
// @route   POST /api/feedback
// @access  Public (Optional Auth)
const submitFeedback = async (req, res) => {
  try {
    const { name, email, category, rating, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }

    const feedback = await Feedback.create({
      user: req.user ? req.user._id : null,
      name: name || (req.user ? req.user.username : 'Anonymous Explorer'),
      email: email || (req.user ? req.user.email : 'explorer@whereto.app'),
      category: category || 'General Feedback',
      rating: rating || 5,
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We appreciate your input. ❤️',
      feedback,
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ message: 'Failed to submit feedback. Please try again later.' });
  }
};

// @desc    Get all feedback submissions
// @route   GET /api/feedback
// @access  Public
const getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar');
    res.json(feedbacks);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Failed to fetch feedback' });
  }
};

module.exports = {
  submitFeedback,
  getFeedbacks,
};

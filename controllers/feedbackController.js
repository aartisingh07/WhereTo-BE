const Feedback = require('../models/Feedback');
const nodemailer = require('nodemailer');

// Optional Email Alert Helper to Admin
const sendAdminEmailNotification = async (feedback) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

    const mailOptions = {
      from: `"Where To? Feedback" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `🚨 New Feedback [${feedback.category}] from ${feedback.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #374151; border-radius: 16px; background-color: #0f172a; color: #f8fafc;">
          <h2 style="color: #6366f1; border-bottom: 1px solid #334155; padding-bottom: 12px; margin-top: 0;">
            💬 New Feedback Submission — Where To?
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #94a3b8;">Category:</td><td style="color: #38bdf8; font-weight: bold;">${feedback.category}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #94a3b8;">Rating:</td><td style="color: #fbbf24;">${'⭐'.repeat(feedback.rating)} (${feedback.rating}/5)</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #94a3b8;">Name:</td><td>${feedback.name}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #94a3b8;">Email:</td><td><a href="mailto:${feedback.email}" style="color: #818cf8;">${feedback.email}</a></td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #94a3b8;">Date:</td><td>${new Date(feedback.createdAt).toLocaleString()}</td></tr>
          </table>
          <div style="background-color: #1e293b; padding: 16px; border-radius: 12px; border-left: 4px solid #6366f1; margin: 16px 0;">
            <p style="margin: 0; color: #e2e8f0; font-size: 14px; line-height: 1.6; whitespace: pre-wrap;">
              ${feedback.message}
            </p>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
            Where To? Admin Notification System
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send admin feedback email notification:', err.message);
  }
};

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

    // Send email alert asynchronously without blocking response
    sendAdminEmailNotification(feedback);

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

// @desc    Get all feedback submissions (Admin Inbox)
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

// @desc    Update feedback status (New -> Reviewed -> Resolved)
// @route   PUT /api/feedback/:id/status
// @access  Public
const updateFeedbackStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update feedback status' });
  }
};

// @desc    Delete feedback entry
// @route   DELETE /api/feedback/:id
// @access  Public
const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete feedback' });
  }
};

module.exports = {
  submitFeedback,
  getFeedbacks,
  updateFeedbackStatus,
  deleteFeedback,
};

const Feedback = require('../models/Feedback');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Discord Webhook Notification Helper
const categoryColors = {
  'Bug Report': 15728640,     // Red
  'Feature Request': 16109579, // Gold
  'Spot Suggestion': 439892,   // Cyan
  'General Feedback': 6514417, // Purple
  'Other': 10181046,           // Magenta
};

const sendDiscordWebhookNotification = async (feedback) => {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const stars = '⭐'.repeat(feedback.rating || 5);
    const color = categoryColors[feedback.category] || 6514417;

    const embed = {
      title: `💬 New Feedback: ${feedback.category}`,
      description: feedback.message,
      color: color,
      fields: [
        { name: '👤 Name', value: feedback.name || 'Anonymous', inline: true },
        { name: '📧 Email', value: feedback.email || 'N/A', inline: true },
        { name: '⭐ Rating', value: `${stars} (${feedback.rating}/5)`, inline: true },
      ],
      footer: { text: 'Where To? App • Developer Instant Alert' },
      timestamp: new Date().toISOString(),
    };

    await axios.post(webhookUrl, {
      username: 'Where To? Feedback Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
      embeds: [embed],
    });
    console.log('✅ Discord Webhook Feedback notification sent successfully!');
  } catch (err) {
    console.error('Discord Webhook error:', err.message);
  }
};

// Telegram Bot Notification Helper
const sendTelegramNotification = async (feedback) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    const stars = '⭐'.repeat(feedback.rating || 5);
    const text = `💬 *New Feedback Received on Where To?*\n\n` +
      `📌 *Category:* ${feedback.category}\n` +
      `👤 *From:* ${feedback.name} (${feedback.email})\n` +
      `⭐ *Rating:* ${stars} (${feedback.rating}/5)\n\n` +
      `📝 *Message:*\n${feedback.message}`;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    });
    console.log('✅ Telegram Bot Feedback notification sent successfully!');
  } catch (err) {
    console.error('Telegram Bot error:', err.message);
  }
};

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
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send admin email notification:', err.message);
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

    // Console Log for Backend Terminal Output
    console.log(`\n💬 [NEW FEEDBACK RECEIVED] [${feedback.category}] from ${feedback.name} (${feedback.email}): "${feedback.message}" (${feedback.rating}/5 stars)\n`);

    // Asynchronously dispatch notifications (Discord, Telegram, Email)
    sendDiscordWebhookNotification(feedback);
    sendTelegramNotification(feedback);
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

// @desc    Update feedback status
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

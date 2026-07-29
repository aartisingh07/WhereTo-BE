const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['General Feedback', 'Feature Request', 'Bug Report', 'Spot Suggestion', 'Other'],
      default: 'General Feedback',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    message: {
      type: String,
      required: [true, 'Please provide your feedback message'],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Resolved'],
      default: 'New',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);

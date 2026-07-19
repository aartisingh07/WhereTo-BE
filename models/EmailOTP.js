const mongoose = require('mongoose');

const emailOTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'OTP code is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Expires after 5 minutes (300 seconds)
  },
});

module.exports = mongoose.model('EmailOTP', emailOTPSchema);

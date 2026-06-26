const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Memory = require('../models/Memory');
const ChatRequest = require('../models/ChatRequest');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for In-Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper: Stream buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'whereto_memories' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// @desc    Upload memory photo with caption and visibility
// @route   POST /api/memories
// @access  Private
const uploadMemory = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a photo' });
    }

    const { caption, visibility } = req.body;
    
    // Stream buffer to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    // Save to Database
    const memory = await Memory.create({
      user: req.user.id,
      imageUrl: result.secure_url,
      publicId: result.public_id,
      caption: caption || '',
      visibility: visibility || 'public'
    });

    res.status(201).json(memory);
  } catch (error) {
    next(error);
  }
};

// @desc    Get memories for a specific user based on requester relationship
// @route   GET /api/memories/user/:userId
// @access  Private
const getMemoriesByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const isOwner = req.user.id === userId;

    let allowedVisibilities = ['public'];

    if (isOwner) {
      // Owner can see everything
      allowedVisibilities = ['public', 'private', 'connections'];
    } else {
      // Check if they are accepted friends
      const connection = await ChatRequest.findOne({
        status: 'accepted',
        $or: [
          { sender: req.user.id, receiver: userId },
          { sender: userId, receiver: req.user.id }
        ]
      });

      if (connection) {
        allowedVisibilities = ['public', 'connections'];
      }
    }

    const memories = await Memory.find({
      user: userId,
      visibility: { $in: allowedVisibilities }
    }).sort({ createdAt: -1 });

    res.json(memories);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a memory entry (and its Cloudinary image)
// @route   DELETE /api/memories/:id
// @access  Private
const deleteMemory = async (req, res, next) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Verify ownership
    if (memory.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to delete this memory' });
    }

    // Delete asset from Cloudinary
    try {
      await cloudinary.uploader.destroy(memory.publicId);
    } catch (clgErr) {
      console.error('Failed to destroy Cloudinary asset:', clgErr);
    }

    // Delete from Database
    await memory.deleteOne();

    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getMemoriesFeed = async (req, res, next) => {
  try {
    const memories = await Memory.find({ visibility: 'public' })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    res.json(memories);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upload,
  uploadMemory,
  getMemoriesByUserId,
  deleteMemory,
  getMemoriesFeed
};

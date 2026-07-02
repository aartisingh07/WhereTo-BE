const User = require('../models/User');
const ChatRequest = require('../models/ChatRequest');
const DirectMessage = require('../models/DirectMessage');
const Notification = require('../models/Notification');

// @desc    Search for user by username and get connection status
// @route   GET /api/chats/search
// @access  Private
const searchUsers = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters' });
    }

    // Find user case-insensitively
    const user = await User.findOne({
      username: { $regex: new RegExp('^' + username.trim() + '$', 'i') }
    }).select('username avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot search for yourself' });
    }

    // Check if a request already exists between current user and searched user
    const request = await ChatRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: user._id },
        { sender: user._id, receiver: req.user.id }
      ]
    });

    let relationship = 'none';
    let requestId = null;

    if (request) {
      requestId = request._id;
      if (request.status === 'accepted') {
        relationship = 'accepted';
      } else if (request.status === 'pending') {
        relationship = request.sender.toString() === req.user.id ? 'pending_sent' : 'pending_received';
      } else if (request.status === 'rejected') {
        relationship = 'rejected';
      }
    }

    res.json({
      user,
      relationship,
      requestId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a chat request
// @route   POST /api/chats/request
// @access  Private
const sendChatRequest = async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    if (receiverId === req.user.id) {
      return res.status(400).json({ message: 'You cannot send a chat request to yourself' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check existing request
    const existing = await ChatRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: receiverId },
        { sender: receiverId, receiver: req.user.id }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'You are already connected to this user' });
      } else if (existing.status === 'pending') {
        return res.status(400).json({ message: 'A pending request already exists' });
      }

      // If previously rejected, allow sending again
      existing.sender = req.user.id;
      existing.receiver = receiverId;
      existing.status = 'pending';
      existing.createdAt = Date.now();
      await existing.save();

      // Notify the receiver
      const notif = await Notification.create({
        user: receiverId,
        title: '💬 Chat Request',
        message: `${req.user.username} sent you a chat request.`,
        type: 'info'
      });

      // Emit notification
      const io = req.app.get('io');
      if (io) {
        io.emit(`notification-${receiverId}`, notif);
      }

      return res.status(200).json(existing);
    }

    const newRequest = await ChatRequest.create({
      sender: req.user.id,
      receiver: receiverId,
      status: 'pending'
    });

    // Notify the receiver
    const notif = await Notification.create({
      user: receiverId,
      title: '💬 Chat Request',
      message: `${req.user.username} sent you a chat request.`,
      type: 'info'
    });

    // Emit notification
    const io = req.app.get('io');
    if (io) {
      io.emit(`notification-${receiverId}`, notif);
    }

    res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
};

// @desc    Accept or reject a chat request
// @route   POST /api/chats/request/:requestId
// @access  Private
const handleChatRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const request = await ChatRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Chat request not found' });
    }

    // Verify current user is the receiver of the request
    if (request.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to handle this chat request' });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      await request.save();

      // Notify the sender
      const notif = await Notification.create({
        user: request.sender,
        title: '✅ Chat Request Accepted',
        message: `${req.user.username} accepted your chat request! You can now start chatting.`,
        type: 'info'
      });

      // Emit notification and relationship updates
      const io = req.app.get('io');
      if (io) {
        io.emit(`notification-${request.sender.toString()}`, notif);
        io.emit(`chat-relationship-updated-${request.sender.toString()}`, { otherUserId: req.user.id, status: 'accepted' });
        io.emit(`chat-relationship-updated-${req.user.id}`, { otherUserId: request.sender.toString(), status: 'accepted' });
      }
    } else {
      request.status = 'rejected';
      await request.save();

      // Emit relationship updates
      const io = req.app.get('io');
      if (io) {
        io.emit(`chat-relationship-updated-${request.sender.toString()}`, { otherUserId: req.user.id, status: 'rejected' });
        io.emit(`chat-relationship-updated-${req.user.id}`, { otherUserId: request.sender.toString(), status: 'rejected' });
      }
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all connected users (accepted chat requests) with last messages
// @route   GET /api/chats/active
// @access  Private
const getActiveChats = async (req, res, next) => {
  try {
    // Find all accepted requests
    const connections = await ChatRequest.find({
      status: 'accepted',
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id }
      ]
    }).populate('sender receiver', 'username avatar');

    const activeChats = [];

    for (const conn of connections) {
      const otherUser = conn.sender._id.toString() === req.user.id ? conn.receiver : conn.sender;

      // Find last message
      const lastMsg = await DirectMessage.findOne({
        $or: [
          { sender: req.user.id, receiver: otherUser._id },
          { sender: otherUser._id, receiver: req.user.id }
        ]
      }).sort({ createdAt: -1 });

      // Count unread messages from this specific user
      const unreadCount = await DirectMessage.countDocuments({
        sender: otherUser._id,
        receiver: req.user.id,
        isRead: false
      });

      activeChats.push({
        user: otherUser,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          sender: lastMsg.sender
        } : null,
        unreadCount
      });
    }

    // Sort by last message date, or connections created date
    activeChats.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
      return dateB - dateA;
    });

    res.json(activeChats);
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending received requests
// @route   GET /api/chats/requests
// @access  Private
const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await ChatRequest.find({
      receiver: req.user.id,
      status: 'pending'
    }).populate('sender', 'username avatar');

    res.json(requests);
  } catch (error) {
    next(error);
  }
};

// @desc    Get message history between current user and another user
// @route   GET /api/chats/messages/:otherUserId
// @access  Private
const getMessageHistory = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;

    // Verify connection exists and is accepted
    const connection = await ChatRequest.findOne({
      status: 'accepted',
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    if (!connection) {
      return res.status(403).json({ message: 'You are not connected with this user' });
    }

    const messages = await DirectMessage.find({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Send a direct message to connected user
// @route   POST /api/chats/messages/:otherUserId
// @access  Private
const sendDirectMessage = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Verify connection is accepted
    const connection = await ChatRequest.findOne({
      status: 'accepted',
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    if (!connection) {
      return res.status(403).json({ message: 'You are not connected with this user' });
    }

    const message = await DirectMessage.create({
      sender: req.user.id,
      receiver: otherUserId,
      content: content.trim()
    });

    // Emit socket event to both sender and receiver
    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: message._id,
        sender: message.sender,
        senderUsername: req.user.username,
        receiver: message.receiver,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt
      };
      io.emit(`direct-message-${otherUserId}`, payload);
      io.emit(`direct-message-${req.user.id}`, payload);
      io.emit(`unread-count-updated-${otherUserId}`);
    }

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

// @desc    Get total unread direct messages count
// @route   GET /api/chats/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await DirectMessage.countDocuments({
      receiver: req.user.id,
      isRead: false
    });
    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all messages from specific user as read
// @route   POST /api/chats/mark-read/:senderId
// @access  Private
const markMessagesAsRead = async (req, res, next) => {
  try {
    const { senderId } = req.params;
    
    await DirectMessage.updateMany(
      { sender: senderId, receiver: req.user.id, isRead: false },
      { isRead: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit(`unread-count-updated-${req.user.id}`);
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit a direct message (within 30 minutes of sending)
// @route   PUT /api/chats/message/:messageId
// @access  Private
const editDirectMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to edit this message' });
    }

    // Check time constraint (30 minutes = 30 * 60 * 1000 ms)
    const timeDiff = Date.now() - new Date(message.createdAt).getTime();
    if (timeDiff > 30 * 60 * 1000) {
      return res.status(400).json({ message: 'Message can only be edited within 30 minutes of sending' });
    }

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    // Emit socket event to both sender and receiver
    const io = req.app.get('io');
    if (io) {
      const payload = {
        messageId: message._id.toString(),
        content: message.content,
        isEdited: true,
        sender: message.sender.toString(),
        receiver: message.receiver.toString()
      };
      io.emit(`direct-message-updated-${message.receiver.toString()}`, payload);
      io.emit(`direct-message-updated-${message.sender.toString()}`, payload);
    }

    res.json(message);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a direct message
// @route   DELETE /api/chats/message/:messageId
// @access  Private
const deleteDirectMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this message' });
    }

    await message.deleteOne();

    // Emit socket event to both sender and receiver
    const io = req.app.get('io');
    if (io) {
      const payload = {
        messageId: message._id.toString(),
        sender: message.sender.toString(),
        receiver: message.receiver.toString()
      };
      io.emit(`direct-message-deleted-${message.receiver.toString()}`, payload);
      io.emit(`direct-message-deleted-${message.sender.toString()}`, payload);
      io.emit(`unread-count-updated-${message.receiver.toString()}`);
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/clear entire conversation history with a user
// @route   DELETE /api/chats/conversation/:otherUserId
// @access  Private
const deleteConversation = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;

    // Delete all direct messages between req.user.id and otherUserId
    await DirectMessage.deleteMany({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    // Emit socket event to notify both users that the conversation has been cleared
    const io = req.app.get('io');
    if (io) {
      io.emit(`direct-conversation-deleted-${otherUserId}`, { otherUserId: req.user.id });
      io.emit(`direct-conversation-deleted-${req.user.id}`, { otherUserId });
      io.emit(`unread-count-updated-${req.user.id}`);
    }

    res.json({ message: 'Conversation history cleared successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all chat relationships for current user
// @route   GET /api/chats/relationships
// @access  Private
const getChatRelationships = async (req, res, next) => {
  try {
    const requests = await ChatRequest.find({
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id }
      ]
    });

    const relationships = {};
    for (const reqObj of requests) {
      const otherUserId = reqObj.sender.toString() === req.user.id 
        ? reqObj.receiver.toString() 
        : reqObj.sender.toString();
      
      relationships[otherUserId] = {
        status: reqObj.status === 'accepted' ? 'accepted' : (reqObj.sender.toString() === req.user.id ? 'pending_sent' : 'pending_received'),
        requestId: reqObj._id
      };
    }

    res.json(relationships);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove/delete a connection (accepted chat request) and messages
// @route   DELETE /api/chats/connection/:otherUserId
// @access  Private
const removeConnection = async (req, res, next) => {
  try {
    const { otherUserId } = req.params;

    // Find and delete accepted request
    const deletedRequest = await ChatRequest.findOneAndDelete({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    if (!deletedRequest) {
      return res.status(404).json({ message: 'No connection found with this user' });
    }

    // Delete conversation history
    await DirectMessage.deleteMany({
      $or: [
        { sender: req.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user.id }
      ]
    });

    // Emit socket event to notify both users that relationship is deleted and active chat updates
    const io = req.app.get('io');
    if (io) {
      io.emit(`chat-relationship-updated-${req.user.id}`, { otherUserId, status: 'none', requestId: null });
      io.emit(`chat-relationship-updated-${otherUserId}`, { otherUserId: req.user.id, status: 'none', requestId: null });
      
      // Also notify that direct conversation has been deleted so UI cleans up active chat
      io.emit(`direct-conversation-deleted-${otherUserId}`, { otherUserId: req.user.id });
      io.emit(`direct-conversation-deleted-${req.user.id}`, { otherUserId });
      io.emit(`unread-count-updated-${req.user.id}`);
      io.emit(`unread-count-updated-${otherUserId}`);
    }

    res.json({ message: 'Removed from chats successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchUsers,
  sendChatRequest,
  handleChatRequest,
  getActiveChats,
  getPendingRequests,
  getMessageHistory,
  sendDirectMessage,
  getUnreadCount,
  markMessagesAsRead,
  editDirectMessage,
  deleteDirectMessage,
  deleteConversation,
  getChatRelationships,
  removeConnection
};


const Room = require('../models/Room');
const Message = require('../models/Message');
const { generateRoomCode } = require('../utils/generateRoomCode');

// @desc    Create a new room
// @route   POST /api/rooms/create
// @access  Private
const createRoom = async (req, res, next) => {
  try {
    const { name } = req.body;
    const code = await generateRoomCode();

    const room = await Room.create({
      code,
      name: name || `${req.user.username}'s Room`,
      host: req.user.id,
      members: [req.user.id],
    });

    await room.populate('host', 'username avatar');
    await room.populate('members', 'username avatar');

    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
};

// @desc    Join a room by code
// @route   POST /api/rooms/join
// @access  Private
const joinRoom = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const room = await Room.findOne({
      code: code.toUpperCase(),
      isActive: true,
    })
      .populate('host', 'username avatar')
      .populate('members', 'username avatar');

    if (!room) {
      return res.status(404).json({ message: 'Room not found or has expired' });
    }

    // Add user if not already a member
    const isMember = room.members.some(
      (m) => m._id.toString() === req.user.id
    );
    if (!isMember) {
      room.members.push(req.user.id);
      await room.save();
      await room.populate('members', 'username avatar');
    }

    res.json(room);
  } catch (error) {
    next(error);
  }
};

// @desc    Get room details
// @route   GET /api/rooms/:id
// @access  Private
const getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'username avatar')
      .populate('members', 'username avatar')
      .populate('joinRequests.user', 'username name avatar');

    if (!room || !room.isActive) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    next(error);
  }
};

// @desc    Set room activity (host only)
// @route   PATCH /api/rooms/:id/activity
// @access  Private
const setActivity = async (req, res, next) => {
  try {
    const { activity } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can change the activity' });
    }

    room.activity = activity;
    await room.save();

    res.json({ activity: room.activity });
  } catch (error) {
    next(error);
  }
};

// @desc    Get room messages
// @route   GET /api/rooms/:id/messages
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ room: req.params.id })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Leave a room
// @route   POST /api/rooms/:id/leave
// @access  Private
const leaveRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    room.members = room.members.filter(
      (m) => m.toString() !== req.user.id
    );

    await room.save();
    res.json({ message: 'Left room' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a room (host only)
// @route   DELETE /api/rooms/:id
// @access  Private
const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can delete the room' });
    }

    // Fully delete room from backend database
    await room.deleteOne();

    // Delete all room messages to prevent orphaned documents
    await Message.deleteMany({ room: req.params.id });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active rooms the user is a member of
// @route   GET /api/rooms/my-rooms
// @access  Private
const getMyRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      members: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('host', 'username avatar')
      .populate('members', 'username avatar')
      .sort({ createdAt: -1 });

    res.json(rooms);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active rooms (excluding host or member rooms)
// @route   GET /api/rooms/active
// @access  Private
const getActiveRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      isActive: true,
      expiresAt: { $gt: new Date() },
      host: { $ne: req.user.id },
      members: { $ne: req.user.id }
    })
      .populate('host', 'username name')
      .populate('joinRequests.user', 'username name')
      .sort({ createdAt: -1 });

    res.json(rooms);
  } catch (error) {
    next(error);
  }
};

// @desc    Send a request to join an active room
// @route   POST /api/rooms/:id/request-join
// @access  Private
const requestJoinRoom = async (req, res, next) => {
  try {
    const { note } = req.body;
    const room = await Room.findOne({ _id: req.params.id, isActive: true });

    if (!room) {
      return res.status(404).json({ message: 'Room not found or expired' });
    }

    if (room.host.toString() === req.user.id || room.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already a member of this room' });
    }

    // Check if there is already a pending request
    const alreadyPending = room.joinRequests.some(
      (r) => r.user.toString() === req.user.id && r.status === 'pending'
    );
    if (alreadyPending) {
      return res.status(400).json({ message: 'You already have a pending join request for this room' });
    }

    room.joinRequests.push({
      user: req.user.id,
      note: note || '',
      status: 'pending',
    });

    await room.save();

    // Create notification for host
    const Notification = require('../models/Notification');
    await Notification.create({
      user: room.host,
      type: 'info',
      title: 'New Join Request',
      message: `${req.user.username} has requested to join your room "${room.name}"${note ? ` with note: "${note}"` : ''}.`,
    });

    res.json({ message: 'Join request sent successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to join request (host only)
// @route   POST /api/rooms/:id/respond-request
// @access  Private
const respondJoinRequest = async (req, res, next) => {
  try {
    const { requestId, action } = req.body; // action: 'accept' or 'reject'
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can manage join requests' });
    }

    const request = room.joinRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      if (!room.members.includes(request.user)) {
        room.members.push(request.user);
      }
      await room.save();

      // Create notification for requester
      const Notification = require('../models/Notification');
      await Notification.create({
        user: request.user,
        type: 'info',
        title: 'Join Request Accepted 🎉',
        message: `Your request to join room "${room.name}" was accepted! You can now join directly.`,
      });
    } else {
      request.status = 'rejected';
      await room.save();
    }

    // Populate updated details to return to UI
    await room.populate('host', 'username name avatar');
    await room.populate('members', 'username name avatar');
    await room.populate('joinRequests.user', 'username name avatar');

    res.json({ message: `Request successfully ${action}ed`, room });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a member from the room (host only)
// @route   POST /api/rooms/:id/remove-member
// @access  Private
const removeMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can remove members' });
    }

    if (memberId === room.host.toString()) {
      return res.status(400).json({ message: 'You cannot remove the host from the room' });
    }

    room.members = room.members.filter((m) => m.toString() !== memberId);
    
    // Also mark their joinRequest status as 'rejected' so they cannot auto-join without request
    const userRequest = room.joinRequests.find(r => r.user.toString() === memberId && r.status === 'accepted');
    if (userRequest) {
      userRequest.status = 'rejected';
    }

    await room.save();

    // Populate updated details to return
    await room.populate('host', 'username name avatar');
    await room.populate('members', 'username name avatar');
    await room.populate('joinRequests.user', 'username name avatar');

    res.json({ message: 'Member successfully removed', room });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  setActivity,
  getMessages,
  leaveRoom,
  deleteRoom,
  getMyRooms,
  getActiveRooms,
  requestJoinRoom,
  respondJoinRequest,
  removeMember,
};


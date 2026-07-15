const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const setupVotingHandler = require('./votingHandler');
const setupTimerHandler = require('./timerHandler');
const setupOutingHandler = require('./outingHandler');

// Map: roomId → Set of { socketId, userId, username, avatar }
const roomUsers = new Map();

const addUserToRoom = (roomId, socketId, userInfo) => {
  if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
  roomUsers.get(roomId).set(socketId, userInfo);
};

const removeUserFromRoom = (roomId, socketId) => {
  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socketId);
    if (roomUsers.get(roomId).size === 0) roomUsers.delete(roomId);
  }
};

const getRoomUsers = (roomId) => {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).values());
};

const setupSocket = (io) => {
  // Auth middleware — verify JWT on every socket connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: no token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;

      // Fetch user from DB to get up-to-date username and avatar
      const User = require('../models/User');
      const user = await User.findById(decoded.id).select('username avatar');
      if (!user) {
        return next(new Error('Authentication error: user not found'));
      }

      socket.username = user.username;
      socket.avatar = user.avatar || '';
      next();
    } catch (err) {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.username} (${socket.id})`);

    // Wire voting, timer, and outing handlers
    setupVotingHandler(socket, io);
    setupTimerHandler(socket, io);
    setupOutingHandler(socket, io);

    // ── Join Room ──────────────────────────────────────────
    socket.on('join-room', async ({ roomId }) => {
      socket.join(roomId);
      socket.currentRoomId = roomId;

      addUserToRoom(roomId, socket.id, {
        userId: socket.userId,
        username: socket.username,
        avatar: socket.avatar,
        socketId: socket.id,
      });

      // Send system message
      const sysMsg = await Message.create({
        room: roomId,
        senderName: 'System',
        content: `${socket.username} joined the room 🎉`,
        type: 'system',
      });

      io.to(roomId).emit('new-message', sysMsg);
      io.to(roomId).emit('room-users-update', getRoomUsers(roomId));


      console.log(`👥 ${socket.username} joined room ${roomId}`);
    });

    // ── Send Message ───────────────────────────────────────
    socket.on('send-message', async ({ roomId, content }) => {
      if (!content?.trim()) return;

      const message = await Message.create({
        room: roomId,
        sender: socket.userId,
        senderName: socket.username,
        content: content.trim(),
        type: 'text',
      });

      io.to(roomId).emit('new-message', message);
    });

    // ── Edit Message ───────────────────────────────────────
    socket.on('edit-message', async ({ roomId, messageId, content }) => {
      if (!content?.trim()) return;

      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (message.sender.toString() !== socket.userId) return;

        // Check 30 minutes constraint
        const timeDiff = Date.now() - new Date(message.createdAt).getTime();
        if (timeDiff > 30 * 60 * 1000) return;

        message.content = content.trim();
        message.isEdited = true;
        await message.save();

        io.to(roomId).emit('message-updated', {
          messageId: message._id.toString(),
          content: message.content,
          isEdited: true
        });
      } catch (err) {
        console.error('Failed to edit room message:', err);
      }
    });

    // ── Delete Message ─────────────────────────────────────
    socket.on('delete-message', async ({ roomId, messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (message.sender.toString() !== socket.userId) return;

        await message.deleteOne();

        io.to(roomId).emit('message-deleted', {
          messageId: message._id.toString()
        });
      } catch (err) {
        console.error('Failed to delete room message:', err);
      }
    });

    // ── Activity Change ────────────────────────────────────
    socket.on('set-activity', ({ roomId, activity }) => {
      io.to(roomId).emit('activity-changed', { activity });
    });

    // ── Plan Scheduled ────────────────────────────────────
    socket.on('plan-scheduled', ({ roomId }) => {
      io.to(roomId).emit('outing-plan-scheduled');
    });

    // ── Kick User ──────────────────────────────────────────
    socket.on('kick-user', ({ roomId, userId }) => {
      io.to(roomId).emit('user-kicked', { userId });
    });


    // ── Leave Room ─────────────────────────────────────────
    socket.on('leave-room', async ({ roomId }) => {
      await handleLeave(socket, roomId, io);
    });

    // ── Disconnect ─────────────────────────────────────────
    socket.on('disconnect', async () => {
      const roomId = socket.currentRoomId;
      if (roomId) await handleLeave(socket, roomId, io);
      console.log(`❌ Socket disconnected: ${socket.username} (${socket.id})`);
    });
  });
};

const handleLeave = async (socket, roomId, io) => {
  socket.leave(roomId);
  removeUserFromRoom(roomId, socket.id);

  const sysMsg = await Message.create({
    room: roomId,
    senderName: 'System',
    content: `${socket.username} left the room`,
    type: 'system',
  });

  io.to(roomId).emit('new-message', sysMsg);
  io.to(roomId).emit('room-users-update', getRoomUsers(roomId));
};

module.exports = setupSocket;

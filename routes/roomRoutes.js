const express = require('express');
const {
  createRoom, joinRoom, getRoom,
  setActivity, getMessages, leaveRoom, deleteRoom, getMyRooms,
  getActiveRooms, requestJoinRoom, respondJoinRequest, removeMember
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create', protect, createRoom);
router.post('/join', protect, joinRoom);
router.get('/my-rooms', protect, getMyRooms);
router.get('/active', protect, getActiveRooms);
router.get('/:id', protect, getRoom);
router.patch('/:id/activity', protect, setActivity);
router.get('/:id/messages', protect, getMessages);
router.post('/:id/leave', protect, leaveRoom);
router.delete('/:id', protect, deleteRoom);
router.post('/:id/request-join', protect, requestJoinRoom);
router.post('/:id/respond-request', protect, respondJoinRequest);
router.post('/:id/remove-member', protect, removeMember);

module.exports = router;

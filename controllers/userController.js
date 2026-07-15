const SavedPlace = require('../models/SavedPlace');
const User = require('../models/User');

// @desc    Save a place to user's profile
// @route   POST /api/user/places/save
// @access  Private
const savePlace = async (req, res, next) => {
  try {
    const { name, category, lat, lng, osmId, address } = req.body;

    if (!name || !lat || !lng) {
      return res.status(400).json({ message: 'Name and coordinates are required' });
    }

    // Check if already saved
    const existing = await SavedPlace.findOne({ user: req.user.id, osmId });
    if (existing) {
      return res.status(400).json({ message: 'Place already saved!' });
    }

    const place = await SavedPlace.create({
      user: req.user.id,
      name,
      category,
      lat,
      lng,
      osmId,
      address,
    });

    res.status(201).json(place);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all saved places for user
// @route   GET /api/user/places
// @access  Private
const getSavedPlaces = async (req, res, next) => {
  try {
    const places = await SavedPlace.find({ user: req.user.id }).sort({ savedAt: -1 });
    res.json(places);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a saved place
// @route   DELETE /api/user/places/:id
// @access  Private
const deleteSavedPlace = async (req, res, next) => {
  try {
    const place = await SavedPlace.findById(req.params.id);

    if (!place) {
      return res.status(404).json({ message: 'Place not found' });
    }

    if (place.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this place' });
    }

    await place.deleteOne();
    res.json({ message: 'Place removed', id: req.params.id });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account and all related data
// @route   DELETE /api/user
// @access  Private
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Deactivate rooms where the user is the host
    const Room = require('../models/Room');
    await Room.updateMany({ host: userId }, { isActive: false });

    // 2. Remove user from all room members
    await Room.updateMany({ members: userId }, { $pull: { members: userId } });

    // 3. Delete user's saved places
    await SavedPlace.deleteMany({ user: userId });

    // 4. Delete user's notifications
    const Notification = require('../models/Notification');
    await Notification.deleteMany({ user: userId });

    // 5. Update/delete outing plans
    const OutingPlan = require('../models/OutingPlan');
    await OutingPlan.deleteMany({ creator: userId });
    await OutingPlan.updateMany({ members: userId }, { $pull: { members: userId } });

    // 6. Delete user's messages
    const Message = require('../models/Message');
    await Message.deleteMany({ sender: userId });

    // 7. Delete the User document itself
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account successfully deleted' });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('username name bio avatar createdAt');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const savedPlacesCount = await SavedPlace.countDocuments({ user: user._id });
    res.json({
      _id: user._id,
      username: user.username,
      name: user.name || '',
      bio: user.bio || '',
      avatar: user.avatar,
      createdAt: user.createdAt,
      savedPlacesCount
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { savePlace, getSavedPlaces, deleteSavedPlace, deleteAccount, getUserProfile };


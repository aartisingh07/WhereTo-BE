const axios = require('axios');

// Haversine formula — distance in km between two coordinates
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Map mood → Geoapify category codes
// Full list: https://apidocs.geoapify.com/docs/places/#categories
const moodToCategories = {
  chill:     'catering.cafe,leisure.park,beach,tourism.attraction.viewpoint,natural.water',
  foodie:    'catering.restaurant,catering.cafe,catering.fast_food,catering.food_court,commercial.food_and_drink.bakery',
  adventure: 'tourism.attraction,sport.sports_centre,natural.mountain.peak,beach,tourism.attraction.viewpoint',
  romantic:  'tourism.attraction.viewpoint,catering.restaurant,beach,leisure.park,natural.water',
  study:     'catering.cafe,education.library,education.university',
};

// Map Geoapify category → friendly label
const categoryToLabel = {
  'catering.cafe':                          'Cafe',
  'catering.restaurant':                    'Restaurant',
  'catering.fast_food':                     'Fast Food',
  'catering.food_court':                    'Food Court',
  'commercial.food_and_drink.bakery':       'Bakery',
  'leisure.park':                           'Park',
  'beach':                                  'Beach',
  'natural.water':                          'Lake / Water',
  'natural.mountain.peak':                  'Viewpoint',
  'tourism.attraction.viewpoint':           'Viewpoint',
  'tourism.attraction':                     'Attraction',
  'sport.sports_centre':                    'Sports',
  'education.library':                      'Library',
  'education.university':                   'Study Space',
};

// Derive a friendly label from Geoapify's categories array
const getLabel = (categories = []) => {
  for (const cat of categories) {
    // Exact match first
    if (categoryToLabel[cat]) return categoryToLabel[cat];
    // Prefix match (e.g. "catering.cafe.coffee_shop" → "Cafe")
    const match = Object.keys(categoryToLabel).find((k) => cat.startsWith(k));
    if (match) return categoryToLabel[match];
  }
  return 'Place';
};

// @desc    Fetch nearby places via Geoapify Places API
// @route   POST /api/places/nearby
// @access  Public
const getNearbyPlaces = async (req, res, next) => {
  try {
    const { lat, lng, mood = 'chill', distance = 5000 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Location (lat, lng) is required' });
    }

    const categories = moodToCategories[mood] || moodToCategories['chill'];
    const radiusMeters = Number(distance);
    const apiKey = process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ message: 'Places API key not configured on server.' });
    }

    const response = await axios.get('https://api.geoapify.com/v2/places', {
      params: {
        categories,
        filter: `circle:${lng},${lat},${radiusMeters}`,
        bias: `proximity:${lng},${lat}`,
        limit: 40,
        apiKey,
      },
      timeout: 15000,
    });

    const features = response.data?.features || [];

    const places = features
      .map((feature) => {
        const props = feature.properties;
        const name = props.name;
        if (!name) return null; // Skip unnamed places

        const placeLat = props.lat;
        const placeLng = props.lon;
        const dist = getDistance(lat, lng, placeLat, placeLng);

        return {
          osmId: props.place_id || `${placeLat}-${placeLng}`,
          name,
          category: getLabel(props.categories || []),
          lat: placeLat,
          lng: placeLng,
          distance: Math.round(dist * 10) / 10,
          address: props.formatted || [
            props.address_line1,
            props.address_line2,
          ].filter(Boolean).join(', '),
          phone: props.contact?.phone || null,
          website: props.website || null,
          openingHours: null,
        };
      })
      .filter(Boolean)
      // Remove duplicates by name
      .filter((place, index, self) =>
        index === self.findIndex((p) => p.name === place.name)
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    res.json({ places, count: places.length, mood, radius: radiusMeters });
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ message: 'Location service timed out. Try again.' });
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({ message: 'Places API key is invalid. Contact support.' });
    }
    next(error);
  }
};

module.exports = { getNearbyPlaces };

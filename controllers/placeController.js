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

// Map mood → OSM tags to query
const moodToTags = {
  chill: [
    'amenity=cafe',
    'leisure=park',
    'natural=beach',
    'tourism=viewpoint',
    'natural=water',
  ],
  foodie: [
    'amenity=restaurant',
    'amenity=cafe',
    'amenity=fast_food',
    'amenity=food_court',
    'shop=bakery',
  ],
  adventure: [
    'tourism=attraction',
    'leisure=sports_centre',
    'natural=peak',
    'natural=beach',
    'tourism=viewpoint',
  ],
  romantic: [
    'tourism=viewpoint',
    'amenity=restaurant',
    'natural=beach',
    'leisure=park',
    'natural=water',
  ],
  study: [
    'amenity=cafe',
    'amenity=library',
    'amenity=university',
  ],
};

// Map mood → human readable category label
const tagToCategory = {
  'amenity=cafe': 'Cafe',
  'amenity=restaurant': 'Restaurant',
  'amenity=fast_food': 'Fast Food',
  'amenity=food_court': 'Food Court',
  'amenity=library': 'Library',
  'amenity=university': 'Study Space',
  'leisure=park': 'Park',
  'natural=beach': 'Beach',
  'natural=peak': 'Viewpoint',
  'natural=water': 'Lake / Water',
  'tourism=viewpoint': 'Viewpoint',
  'tourism=attraction': 'Attraction',
  'leisure=sports_centre': 'Sports',
  'shop=bakery': 'Bakery',
};

// @desc    Fetch nearby places from Overpass API
// @route   POST /api/places/nearby
// @access  Public
const getNearbyPlaces = async (req, res, next) => {
  try {
    const { lat, lng, mood = 'chill', distance = 5000 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Location (lat, lng) is required' });
    }

    const tags = moodToTags[mood] || moodToTags['chill'];
    const radiusMeters = Number(distance);

    // Build Overpass QL query — union of all mood-relevant tags
    const tagQueries = tags
      .map((tag) => {
        const [key, value] = tag.split('=');
        return `node["${key}"="${value}"](around:${radiusMeters},${lat},${lng});
way["${key}"="${value}"](around:${radiusMeters},${lat},${lng});`;
      })
      .join('\n');

    const query = `
      [out:json][timeout:15];
      (
        ${tagQueries}
      );
      out center 40;
    `;

    // Use GET request — avoids 406 issues with POST body encoding
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await axios.get(
      `https://overpass-api.de/api/interpreter?data=${encodedQuery}`,
      { timeout: 20000 }
    );

    const elements = response.data.elements || [];

    // Parse and clean results
    const places = elements
      .map((el) => {
        const placeLat = el.lat || el.center?.lat;
        const placeLng = el.lon || el.center?.lon;
        if (!placeLat || !placeLng) return null;

        const name = el.tags?.name || el.tags?.['name:en'] || null;
        if (!name) return null; // Skip unnamed places

        // Find which tag matched for category label
        let category = 'Place';
        for (const tag of tags) {
          const [key, value] = tag.split('=');
          if (el.tags?.[key] === value) {
            category = tagToCategory[tag] || 'Place';
            break;
          }
        }

        const dist = getDistance(lat, lng, placeLat, placeLng);

        return {
          osmId: `${el.type}/${el.id}`,
          name,
          category,
          lat: placeLat,
          lng: placeLng,
          distance: Math.round(dist * 10) / 10, // km, 1 decimal
          address: [
            el.tags?.['addr:housenumber'],
            el.tags?.['addr:street'],
            el.tags?.['addr:suburb'] || el.tags?.['addr:city'],
          ]
            .filter(Boolean)
            .join(', '),
          phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
          website: el.tags?.website || el.tags?.['contact:website'] || null,
          openingHours: el.tags?.opening_hours || null,
        };
      })
      .filter(Boolean)
      // Remove duplicates by name
      .filter(
        (place, index, self) =>
          index === self.findIndex((p) => p.name === place.name)
      )
      // Sort by distance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20); // Max 20 results

    res.json({ places, count: places.length, mood, radius: radiusMeters });
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ message: 'Location service timed out. Try again.' });
    }
    next(error);
  }
};

module.exports = { getNearbyPlaces };

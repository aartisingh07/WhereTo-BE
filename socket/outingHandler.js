const axios = require('axios');

// Map: roomId → Map(userId → { lat, lng, mood, distance, username })
const roomPreferences = new Map();

// Helper to calculate distance in km
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

const moodToCategories = {
  chill:     'leisure.park,natural.water,leisure.park.garden',
  foodie:    'catering.restaurant,catering.cafe,catering.fast_food,catering.food_court,commercial.food_and_drink.bakery',
  adventure: 'sport.sports_centre,natural.mountain.peak,tourism.attraction',
  romantic:  'tourism.attraction.viewpoint,leisure.park.garden',
  study:     'education.library,education.university',
};

const categoryToLabel = {
  'catering.fast_food.street_food':         'Food Cart',
  'catering.fast_food.food_truck':          'Food Truck',
  'catering.cafe':                          'Cafe',
  'catering.restaurant':                    'Restaurant',
  'catering.fast_food':                     'Fast Food',
  'catering.food_court':                    'Food Court',
  'commercial.food_and_drink.bakery':       'Bakery',
  'leisure.park':                           'Park',
  'beach':                                  'Beach',
  'natural.water':                          'Lake / Water',
  'natural.mountain.peak':                  'Mountain Peak',
  'tourism.attraction.viewpoint':           'Scenic Viewpoint',
  'tourism.attraction':                     'Adventure Spot',
  'sport.sports_centre':                    'Sports Centre',
  'education.library':                      'Library',
  'education.university':                   'Study Space',
};

const getLabel = (categories = []) => {
  for (const cat of categories) {
    if (categoryToLabel[cat]) return categoryToLabel[cat];
    const match = Object.keys(categoryToLabel).find((k) => cat.startsWith(k));
    if (match) return categoryToLabel[match];
  }
  return 'Place';
};

const setupOutingHandler = (socket, io) => {
  const getSubmissionsList = (roomId) => {
    const prefs = roomPreferences.get(roomId);
    if (!prefs) return [];
    return Array.from(prefs.entries()).map(([userId, val]) => ({
      userId,
      username: val.username,
      hasSubmitted: true,
      mood: val.mood,
    }));
  };

  // Sync state on join
  socket.on('get-outing-state', ({ roomId }) => {
    if (!roomId) return;
    socket.emit('outing-state-update', {
      submissions: getSubmissionsList(roomId),
    });
  });

  // Submit preferences
  socket.on('submit-outing-pref', ({ roomId, pref }) => {
    if (!roomId || !pref) return;

    if (!roomPreferences.has(roomId)) {
      roomPreferences.set(roomId, new Map());
    }

    roomPreferences.get(roomId).set(socket.userId, {
      lat: Number(pref.lat),
      lng: Number(pref.lng),
      mood: pref.mood || 'chill',
      distance: Number(pref.distance) || 5000,
      subFilters: pref.subFilters || {},
      username: socket.username,
    });

    io.to(roomId).emit('outing-state-update', {
      submissions: getSubmissionsList(roomId),
    });

    console.log(`📍 Preference submitted by ${socket.username} in room ${roomId}`);
  });

  // Find places based on midpoint aggregation (host only)
  socket.on('find-outing-places', async ({ roomId }) => {
    if (!roomId) return;
    const prefs = roomPreferences.get(roomId);

    if (!prefs || prefs.size === 0) {
      return socket.emit('outing-error', { message: 'No locations submitted yet!' });
    }

    // Calculate midpoint centroid
    let latSum = 0;
    let lngSum = 0;
    let distSum = 0;
    const moods = [];
    const foodTypes = [];
    const diets = [];
    const adventureTypes = [];
    const budgets = [];

    for (const userPref of prefs.values()) {
      latSum += userPref.lat;
      lngSum += userPref.lng;
      distSum += userPref.distance;
      moods.push(userPref.mood);
      if (userPref.subFilters) {
        if (userPref.subFilters.foodType) foodTypes.push(userPref.subFilters.foodType);
        if (userPref.subFilters.diet) diets.push(userPref.subFilters.diet);
        if (userPref.subFilters.adventureType) adventureTypes.push(userPref.subFilters.adventureType);
        if (userPref.subFilters.budget) budgets.push(userPref.subFilters.budget);
      }
    }

    const count = prefs.size;
    const midLat = latSum / count;
    const midLng = lngSum / count;
    const avgDist = distSum / count;

    // Get mode (most frequent) helper
    const getMode = (arr, defaultValue) => {
      if (!arr || arr.length === 0) return defaultValue;
      const counts = {};
      let mode = defaultValue;
      let max = 0;
      arr.forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
        if (counts[item] > max) {
          max = counts[item];
          mode = item;
        }
      });
      return mode;
    };

    const modeMood = getMode(moods, 'chill');
    const modeFoodType = getMode(foodTypes, 'any');
    const modeDiet = getMode(diets, 'any');
    const modeAdventureType = getMode(adventureTypes, 'any');
    const modeBudget = getMode(budgets, 'any');

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return io.to(roomId).emit('outing-error', { message: 'Geoapify API key not configured on server.' });
    }

    try {
      let categories = moodToCategories[modeMood] || moodToCategories['chill'];

      if (modeMood === 'foodie') {
        const cats = [];
        if (modeFoodType === 'junk_food') {
          cats.push('catering.fast_food');
        } else if (modeFoodType === 'cuisine') {
          cats.push('catering.restaurant');
        } else if (modeFoodType === 'food_cart') {
          cats.push('catering.fast_food.street_food', 'catering.fast_food.food_truck');
        } else {
          cats.push('catering.restaurant', 'catering.cafe', 'catering.fast_food', 'commercial.food_and_drink.bakery');
        }

        if (modeDiet === 'veg') {
          cats.push('catering.restaurant.vegetarian', 'catering.restaurant.vegan');
        }
        categories = cats.join(',');
      } else if (modeMood === 'adventure') {
        if (modeAdventureType === 'nature') {
          categories = 'leisure.park,natural.forest';
        } else if (modeAdventureType === 'beach') {
          categories = 'beach,natural.water';
        } else if (modeAdventureType === 'mountains') {
          categories = 'natural.mountain.peak';
        } else if (modeAdventureType === 'sports') {
          categories = 'sport.sports_centre';
        } else {
          categories = 'sport.sports_centre,natural.mountain.peak,tourism.attraction';
        }
      }

      // Set disjoint distance bands to return distinct lists
      let minDistanceKm = 0;
      let maxDistanceKm = avgDist / 1000;
      if (avgDist <= 3000) {
        minDistanceKm = 0;
        maxDistanceKm = avgDist / 1000;
      } else if (avgDist > 3000 && avgDist <= 8000) {
        minDistanceKm = 1.5;
        maxDistanceKm = avgDist / 1000;
      } else {
        minDistanceKm = 4.0;
        maxDistanceKm = Math.max(avgDist / 1000, 15.0);
      }

      const response = await axios.get('https://api.geoapify.com/v2/places', {
        params: {
          categories,
          filter: `circle:${midLng},${midLat},${Math.round(maxDistanceKm * 1000)}`,
          bias: `proximity:${midLng},${midLat}`,
          limit: 100, // Fetch more places to get diverse choices beyond closest proximity
          apiKey,
        },
        timeout: 15000,
      });

      const features = response.data?.features || [];

      const places = features
        .map((feature) => {
          const props = feature.properties;
          const name = props.name;
          if (!name) return null;

          const placeLat = props.lat;
          const placeLng = props.lon;
          const dist = getDistance(midLat, midLng, placeLat, placeLng);
          const estimatedRouteDistance = dist * 1.3;

          // Calculate travel times in minutes
          const walkTime = Math.max(1, Math.round((estimatedRouteDistance / 4.5) * 60));
          const bikeTime = Math.max(1, Math.round((estimatedRouteDistance / 15) * 60));
          const driveTime = Math.max(1, Math.round((estimatedRouteDistance / 35) * 60));

          // Recommend least time vehicle
          let recommendedVehicle = 'driving';
          let recommendedTime = driveTime;
          if (walkTime <= 15) {
            recommendedVehicle = 'walking';
            recommendedTime = walkTime;
          } else if (bikeTime <= 15) {
            recommendedVehicle = 'bicycling';
            recommendedTime = bikeTime;
          }

          const label = getLabel(props.categories || []);

          // Strict disjoint vibe filter
          if (modeMood === 'chill' && !['Park', 'Lake / Water', 'Beach'].includes(label)) {
            return null;
          }
          if (modeMood === 'romantic' && !['Scenic Viewpoint', 'Beach'].includes(label)) {
            return null;
          }
          if (modeMood === 'adventure' && !['Mountain Peak', 'Adventure Spot', 'Sports Centre', 'Beach'].includes(label)) {
            return null;
          }
          if (modeMood === 'study' && !['Library', 'Study Space', 'Cafe'].includes(label)) {
            return null;
          }
          if (modeMood === 'foodie' && !['Restaurant', 'Cafe', 'Fast Food', 'Food Court', 'Bakery', 'Food Cart', 'Food Truck'].includes(label)) {
            return null;
          }

          const categoryLower = label.toLowerCase();

          // High-fidelity illustrative photos
          let photo = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80'; // fallback
          if (categoryLower.includes('cafe') || categoryLower.includes('bakery')) {
            photo = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'; // Cafe
          } else if (categoryLower.includes('restaurant') || categoryLower.includes('dining')) {
            photo = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'; // Restaurant
          } else if (categoryLower.includes('fast food') || categoryLower.includes('cart') || categoryLower.includes('truck')) {
            photo = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80'; // Street food / cart
          } else if (categoryLower.includes('park') || categoryLower.includes('garden')) {
            photo = 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=600&q=80'; // Park
          } else if (categoryLower.includes('beach')) {
            photo = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'; // Beach
          } else if (categoryLower.includes('lake') || categoryLower.includes('water')) {
            photo = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80'; // Lake
          } else if (categoryLower.includes('mountain') || categoryLower.includes('peak') || categoryLower.includes('viewpoint')) {
            photo = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80'; // Mountain
          } else if (categoryLower.includes('sports') || categoryLower.includes('centre')) {
            photo = 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80'; // Sports
          } else if (categoryLower.includes('library') || categoryLower.includes('study') || categoryLower.includes('university')) {
            photo = 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80'; // Library
          }

          // Illustrative descriptions
          let description = 'A great place to visit and explore nearby.';
          if (categoryLower.includes('cafe')) description = 'A cozy spot for fresh brew, aromatic coffee, and quick bites.';
          else if (categoryLower.includes('bakery')) description = 'Delicious freshly baked goods, sweet pastries, and bread.';
          else if (categoryLower.includes('restaurant')) description = 'An excellent dining option offering delicious meals and good service.';
          else if (categoryLower.includes('fast food')) description = 'Perfect for a quick meal or grab-and-go junk food cravings.';
          else if (categoryLower.includes('cart') || categoryLower.includes('truck')) description = 'Street-style food vendor serving fresh, local on-the-go treats.';
          else if (categoryLower.includes('park')) description = 'Beautiful green space ideal for walks, relaxation, and nature vibes.';
          else if (categoryLower.includes('beach')) description = 'Sandy shoreline with beautiful waves, perfect for sunbathing and swimming.';
          else if (categoryLower.includes('lake') || categoryLower.includes('water')) description = 'Scenic water body offering quiet views and relaxing surroundings.';
          else if (categoryLower.includes('mountain') || categoryLower.includes('viewpoint')) description = 'Breathtaking panoramic viewpoints offering stunning skyline landscapes.';
          else if (categoryLower.includes('library')) description = 'Quiet library spaces packed with books, perfect for reading and studying.';
          else if (categoryLower.includes('study') || categoryLower.includes('university')) description = 'Inspiring educational space designed for focus and productivity.';
          else if (categoryLower.includes('sports')) description = 'Recreational centre with sports facilities to keep you active and energised.';

          let budget = null;
          if (modeMood === 'foodie') {
            if (categoryLower.includes('cart') || categoryLower.includes('truck') || categoryLower.includes('street')) {
              budget = 'cheap';
            } else if (categoryLower.includes('restaurant') || categoryLower.includes('dining') || categoryLower.includes('court')) {
              budget = 'expensive';
            } else {
              budget = 'moderate';
            }
          }

          return {
            osmId: props.place_id || `${placeLat}-${placeLng}`,
            name,
            category: label,
            lat: placeLat,
            lng: placeLng,
            distance: Math.round(dist * 10) / 10, // distance from midpoint
            address: props.formatted || [
              props.address_line1,
              props.address_line2,
            ].filter(Boolean).join(', '),
            phone: props.contact?.phone || null,
            website: props.website || null,
            photo,
            description,
            budget,
            travelTimes: {
              walking: walkTime,
              bicycling: bikeTime,
              driving: driveTime,
              recommended: recommendedVehicle,
              recommendedTime: recommendedTime,
            },
          };
        })
        .filter(Boolean)
        .filter((place) => {
          // Enforce disjoint distance bands
          return place.distance >= minDistanceKm && place.distance <= maxDistanceKm;
        })
        .filter((place) => {
          if (modeMood === 'foodie' && modeBudget && modeBudget !== 'any') {
            return place.budget === modeBudget;
          }
          return true;
        })
        .filter((place, index, self) =>
          index === self.findIndex((p) => p.name === place.name)
        )
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 12);

      io.to(roomId).emit('outing-places-found', {
        places,
        midpoint: { lat: midLat, lng: midLng },
        mood: modeMood,
        radius: Math.round(avgDist),
      });

      console.log(`📍 Centroid Midpoint: (${midLat}, ${midLng}), found ${places.length} places for room ${roomId}`);
    } catch (error) {
      console.error('❌ Outing places lookup failed:', error.message);
      io.to(roomId).emit('outing-error', { message: 'Failed to search places. Try again.' });
    }
  });

  // Clear preferences (host resets activity)
  socket.on('clear-outing-state', ({ roomId }) => {
    if (!roomId) return;
    roomPreferences.delete(roomId);
    io.to(roomId).emit('outing-state-update', { submissions: [] });
  });
};

module.exports = setupOutingHandler;

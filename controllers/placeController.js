const axios = require('axios');
const crypto = require('crypto');

// Resolve Wikimedia Commons file name to direct image URL
const getWikimediaUrl = (fileString) => {
  if (!fileString || !fileString.startsWith('File:')) return null;
  const cleanName = fileString.substring(5).replace(/ /g, '_');
  const hash = crypto.createHash('md5').update(cleanName).digest('hex');
  const f1 = hash[0];
  const f2 = hash.substring(0, 2);
  return `https://upload.wikimedia.org/wikipedia/commons/${f1}/${f2}/${encodeURIComponent(cleanName)}`;
};

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

// Map vibe → Geoapify category codes
// Full list: https://apidocs.geoapify.com/docs/places/#categories
const vibeCategoryMap = {
  // Solo Vibes
  solo_cafes:    'catering.cafe,commercial.food_and_drink.bakery',
  bookstores:    'commercial.books,education.library',
  nature_trails: 'leisure.park,leisure.park.garden,natural.forest,natural.water',
  art_museums:   'entertainment.museum,entertainment.culture.gallery,entertainment.culture,building.museum',
  solo_cinema:   'entertainment.cinema',
  scenic_drives: 'tourism.attraction.viewpoint,leisure.park.garden,natural.water',

  // Couples Vibes
  beaches:          'beach,natural.water,tourism.attraction.viewpoint',
  cafes:            'catering.cafe,commercial.food_and_drink.bakery',
  romantic_dining:  'catering.restaurant',
  scenic_spots:     'tourism.attraction.viewpoint,leisure.park.garden',
  nature:           'natural.water,leisure.park,beach,natural.forest',

  // Family Vibes
  parks:            'leisure.park,leisure.park.garden,entertainment.theme_park',
  malls:            'commercial.shopping_mall,commercial.marketplace',
  zoos:             'entertainment.zoo,entertainment.aquarium',
  museums:          'entertainment.museum,entertainment.culture.gallery,building.museum',
  picnic:           'leisure.park,leisure.park.garden,natural.water',

  // Friends Vibes
  concerts:         'entertainment.culture,catering.bar,catering.pub',
  trekking:         'sport.sports_centre,natural.mountain.peak,natural.forest',
  sports:           'sport.sports_centre,sport',
  food_crawl:       'catering.restaurant,catering.cafe,catering.fast_food,catering.food_court',
  camping:          'leisure.park,natural.water,natural.forest',
};

// Map Geoapify category → friendly label
const categoryToLabel = {
  'catering.fast_food.street_food':         'Food Cart',
  'catering.fast_food.food_truck':          'Food Truck',
  'catering.cafe':                          'Cafe',
  'catering.restaurant':                    'Restaurant',
  'catering.fast_food':                     'Fast Food',
  'catering.food_court':                    'Food Court',
  'commercial.food_and_drink.bakery':       'Bakery',
  'commercial.shopping_mall':               'Shopping Mall',
  'commercial.marketplace':                 'Marketplace',
  'commercial.books':                       'Bookstore',
  'education.library':                      'Library',
  'education.university':                   'Study Space',
  'leisure.park.garden':                    'Garden',
  'leisure.park':                           'Park',
  'beach':                                  'Beach',
  'natural.water':                          'Lake / Water',
  'natural.mountain.peak':                  'Mountain Peak',
  'natural.forest':                         'Forest Trail',
  'tourism.attraction.viewpoint':           'Scenic Viewpoint',
  'tourism.attraction':                     'Attraction',
  'sport.sports_centre':                    'Sports Centre',
  'sport':                                  'Sports & Turf',
  'entertainment.zoo':                      'Zoo & Wildlife',
  'entertainment.aquarium':                 'Aquarium',
  'entertainment.museum':                   'Museum',
  'entertainment.culture.gallery':         'Art Gallery',
  'entertainment.culture':                  'Cultural Center',
  'entertainment.cinema':                   'Cinema & Movies',
  'entertainment.theme_park':               'Amusement & Theme Park',
  'catering.bar':                           'Bar & Lounge',
  'catering.pub':                           'Pub & Club',
};

// Derive a friendly label from Geoapify's categories array
const getLabel = (categories = []) => {
  for (const cat of categories) {
    if (categoryToLabel[cat]) return categoryToLabel[cat];
    const match = Object.keys(categoryToLabel).find((k) => cat.startsWith(k));
    if (match) return categoryToLabel[match];
  }
  return 'Place';
};

// Helper for strict vibe filtering constraint
const validatePlaceForVibe = (name, label, rawCategories = [], vibeId) => {
  if (!vibeId || vibeId === 'all') return true;

  const nameLower = (name || '').toLowerCase();
  const labelLower = (label || '').toLowerCase();
  const rawCatsStr = rawCategories.join(',').toLowerCase();

  const isHospitality = (
    nameLower.includes('hotel') ||
    nameLower.includes('resort') ||
    nameLower.includes('lodge') ||
    nameLower.includes('guest house') ||
    nameLower.includes('restaurant') ||
    nameLower.includes('sweets') ||
    nameLower.includes('dhaba') ||
    rawCatsStr.includes('catering.restaurant') ||
    rawCatsStr.includes('catering.fast_food')
  );

  if (vibeId === 'art_museums' || vibeId === 'museums') {
    const isMuseum = (
      labelLower.includes('museum') ||
      labelLower.includes('gallery') ||
      labelLower.includes('cultural') ||
      nameLower.includes('museum') ||
      nameLower.includes('gallery') ||
      nameLower.includes('art') ||
      nameLower.includes('kala') ||
      nameLower.includes('academy') ||
      rawCatsStr.includes('entertainment.museum') ||
      rawCatsStr.includes('entertainment.culture')
    );
    if (!isMuseum) return false;
    if (isHospitality && !nameLower.includes('museum') && !nameLower.includes('gallery')) {
      return false;
    }
    return true;
  }

  if (vibeId === 'parks' || vibeId === 'nature_trails' || vibeId === 'nature') {
    const isPark = (
      labelLower.includes('park') ||
      labelLower.includes('garden') ||
      labelLower.includes('forest') ||
      labelLower.includes('trail') ||
      labelLower.includes('viewpoint') ||
      nameLower.includes('park') ||
      nameLower.includes('garden') ||
      nameLower.includes('forest') ||
      nameLower.includes('hill') ||
      rawCatsStr.includes('leisure.park') ||
      rawCatsStr.includes('natural.forest')
    );
    if (!isPark) return false;
    if (isHospitality && !nameLower.includes('park') && !nameLower.includes('garden')) {
      return false;
    }
    return true;
  }

  if (vibeId === 'bookstores') {
    const isBook = (
      labelLower.includes('bookstore') ||
      labelLower.includes('library') ||
      nameLower.includes('book') ||
      nameLower.includes('library') ||
      nameLower.includes('reader') ||
      rawCatsStr.includes('commercial.books') ||
      rawCatsStr.includes('education.library')
    );
    if (!isBook) return false;
    return true;
  }

  if (vibeId === 'solo_cinema') {
    const isCinema = (
      labelLower.includes('cinema') ||
      nameLower.includes('cinema') ||
      nameLower.includes('pvr') ||
      nameLower.includes('inox') ||
      nameLower.includes('cinepolis') ||
      nameLower.includes('theater') ||
      nameLower.includes('theatre') ||
      rawCatsStr.includes('entertainment.cinema')
    );
    if (!isCinema) return false;
    return true;
  }

  if (vibeId === 'beaches') {
    const isBeach = (
      labelLower.includes('beach') ||
      nameLower.includes('beach') ||
      nameLower.includes('coast') ||
      nameLower.includes('sea') ||
      rawCatsStr.includes('beach')
    );
    if (!isBeach) return false;
    if (isHospitality && !nameLower.includes('beach')) return false;
    return true;
  }

  if (vibeId === 'zoos') {
    const isZoo = (
      labelLower.includes('zoo') ||
      labelLower.includes('aquarium') ||
      nameLower.includes('zoo') ||
      nameLower.includes('sanctuary') ||
      rawCatsStr.includes('entertainment.zoo')
    );
    if (!isZoo) return false;
    return true;
  }

  if (vibeId === 'solo_cafes' || vibeId === 'cafes') {
    const isCafe = (
      labelLower.includes('cafe') ||
      labelLower.includes('bakery') ||
      nameLower.includes('cafe') ||
      nameLower.includes('coffee') ||
      nameLower.includes('bakery') ||
      rawCatsStr.includes('catering.cafe') ||
      rawCatsStr.includes('commercial.food_and_drink.bakery')
    );
    if (!isCafe) return false;
    return true;
  }

  return true;
};

// @desc    Fetch nearby places via Geoapify Places API
// @route   POST /api/places/nearby
// @access  Public
const getNearbyPlaces = async (req, res, next) => {
  try {
    const { lat, lng, locationQuery, groupCategory = 'friends', vibe = 'malls', distance = 5000, mood, subFilters = {} } = req.body;
    const isCustomSearch = !!(locationQuery && locationQuery.trim());
    const apiKey = process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ message: 'Places API key not configured on server.' });
    }

    let resolvedLat = lat;
    let resolvedLng = lng;
    let resolvedAddress = '';
    let prependedPlace = null;

    if (locationQuery && locationQuery.trim()) {
      const userLat = lat ? Number(lat) : null;
      const userLng = lng ? Number(lng) : null;
      const hasUserCoords = userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng);

      const baseGeocodeParams = {
        text: locationQuery.trim(),
        apiKey,
        ...(hasUserCoords ? { bias: `proximity:${userLng},${userLat}` } : {}),
      };

      // Prioritize places in India first (countrycode:in) with proximity bias
      let geocodeResponse = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
        params: {
          ...baseGeocodeParams,
          filter: 'countrycode:in',
        },
        timeout: 10000,
      });

      let features = geocodeResponse.data?.features || [];

      // Fallback to global search if no India place matched
      if (features.length === 0) {
        geocodeResponse = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
          params: baseGeocodeParams,
          timeout: 10000,
        });
        features = geocodeResponse.data?.features || [];
      }

      if (features.length === 0) {
        return res.status(404).json({ message: `Could not resolve location: "${locationQuery}"` });
      }

      // Sort candidate features by proximity to user coordinates if available
      if (hasUserCoords) {
        features.sort((a, b) => {
          const distA = getDistance(userLat, userLng, a.properties.lat, a.properties.lon);
          const distB = getDistance(userLat, userLng, b.properties.lat, b.properties.lon);
          return distA - distB;
        });
      }

      let firstResult = features[0];

      resolvedLat = firstResult.properties.lat;
      resolvedLng = firstResult.properties.lon;
      resolvedAddress = firstResult.properties.formatted;

      if (firstResult && (firstResult.properties.name || firstResult.properties.formatted)) {
        const placeName = firstResult.properties.name || firstResult.properties.formatted.split(',')[0];
        const catStr = firstResult.properties.category || firstResult.properties.result_type || '';
        let label = getLabel([catStr].filter(Boolean));
        if (label === 'Place') label = 'Scenic Viewpoint';

        const categoryLower = label.toLowerCase();
        let description = `Iconic landmark and destination in ${firstResult.properties.city || firstResult.properties.state || 'the area'}.`;
        if (categoryLower.includes('mall') || categoryLower.includes('shopping')) description = 'Popular shopping destination with stores, food courts, and entertainment.';
        else if (categoryLower.includes('zoo')) description = 'Exciting zoo and wildlife sanctuary perfect for family outings and kids.';
        else if (categoryLower.includes('museum') || categoryLower.includes('gallery')) description = 'Rich historical & cultural exhibition featuring art, science, and heritage.';
        else if (categoryLower.includes('concert') || categoryLower.includes('culture') || categoryLower.includes('bar') || categoryLower.includes('pub')) description = 'Vibrant nightlife venue featuring live performances, music, and great drinks.';
        else if (categoryLower.includes('forest') || categoryLower.includes('trail')) description = 'Lush nature trail surrounded by trees and fresh outdoor air.';
        else if (categoryLower.includes('cafe')) description = 'A cozy spot for fresh brew, aromatic coffee, and quick bites.';
        else if (categoryLower.includes('bakery')) description = 'Delicious freshly baked goods, sweet pastries, and bread.';
        else if (categoryLower.includes('restaurant')) description = 'An excellent dining option offering delicious meals and good service.';
        else if (categoryLower.includes('fast food')) description = 'Perfect for a quick meal or grab-and-go cravings.';
        else if (categoryLower.includes('park')) description = 'Beautiful green space ideal for walks, picnics, and relaxation.';
        else if (categoryLower.includes('beach')) description = 'Sandy shoreline with scenic water views, perfect for sunset walks and fun.';
        else if (categoryLower.includes('viewpoint')) description = 'Breathtaking panoramic viewpoints offering stunning skyline landscapes.';
        else if (categoryLower.includes('sports')) description = 'Recreational sports facility to keep you active and energised.';

        prependedPlace = {
          osmId: firstResult.properties.place_id || `${resolvedLat}-${resolvedLng}`,
          name: placeName,
          category: label,
          lat: resolvedLat,
          lng: resolvedLng,
          distance: 0,
          address: resolvedAddress,
          phone: firstResult.properties.contact?.phone || null,
          website: firstResult.properties.website || null,
          photo: null,
          description,
          budget: null,
          travelTimes: {
            walking: 0,
            bicycling: 0,
            driving: 0,
            recommended: 'walking',
            recommendedTime: 0,
          },
        };
      }
    if (!resolvedLat || !resolvedLng) {
      // Default fallback coordinates (Mumbai, India) if GPS is denied or unavailable
      resolvedLat = 19.0760;
      resolvedLng = 72.8777;
      resolvedAddress = 'Mumbai, Maharashtra, India';
    }

    let categories = vibeCategoryMap[vibe] || vibeCategoryMap[mood];
    if (!categories || vibe === 'all') {
      categories = 'commercial.shopping_mall,catering.restaurant,catering.cafe,tourism.attraction,leisure.park,beach,natural.water,tourism.attraction.viewpoint,entertainment.zoo,entertainment.museum,sport.sports_centre,catering.bar,catering.fast_food,commercial.marketplace';
    }

    // Apply sub-filters dynamically
    if (mood === 'foodie' && vibe !== 'all' && !isCustomSearch) {
      const { diet, foodType } = subFilters;
      const cats = [];
      if (foodType === 'junk_food') {
        cats.push('catering.fast_food');
      } else if (foodType === 'cuisine') {
        cats.push('catering.restaurant');
      } else if (foodType === 'food_cart') {
        cats.push('catering.fast_food.street_food', 'catering.fast_food.food_truck');
      } else {
        cats.push('catering.restaurant', 'catering.cafe', 'catering.fast_food', 'commercial.food_and_drink.bakery');
      }

      if (diet === 'veg') {
        cats.push('catering.restaurant.vegetarian', 'catering.restaurant.vegan');
      }
      categories = cats.join(',');
    } else if (mood === 'adventure' && vibe !== 'all' && !isCustomSearch) {
      const { adventureType } = subFilters;
      if (adventureType === 'nature') {
        categories = 'leisure.park,natural.forest';
      } else if (adventureType === 'beach') {
        categories = 'beach,natural.water';
      } else if (adventureType === 'mountains') {
        categories = 'natural.mountain.peak';
      } else if (adventureType === 'sports') {
        categories = 'sport.sports_centre';
      } else {
        categories = 'sport.sports_centre,natural.mountain.peak,tourism.attraction';
      }
    }

    const radiusMeters = Number(distance);

    // Set disjoint distance bands to return distinct lists
    let minDistanceKm = 0;
    let maxDistanceKm = radiusMeters / 1000;

    if (isCustomSearch) {
      minDistanceKm = 0;
      maxDistanceKm = 50.0; // 50km wide radius for custom text search to let them search anything
    } else {
      if (radiusMeters === 5000) {
        minDistanceKm = 1.5; // Mid-range is 1.5km to 5km
      } else if (radiusMeters === 10000) {
        minDistanceKm = 4.0; // Anywhere/distant is 4.0km to 15.0km
        maxDistanceKm = 15.0; // Expand search area for far places
      }
    }

    const response = await axios.get('https://api.geoapify.com/v2/places', {
      params: {
        categories,
        filter: `circle:${resolvedLng},${resolvedLat},${Math.round(maxDistanceKm * 1000)}`,
        bias: `proximity:${resolvedLng},${resolvedLat}`,
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
        if (!name) return null; // Skip unnamed places

        const placeLat = props.lat;
        const placeLng = props.lon;
        const dist = getDistance(resolvedLat, resolvedLng, placeLat, placeLng);
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

        // Strict vibe validation filter — rejects hotels, restaurants, or wrong place types
        if (!validatePlaceForVibe(name, label, props.categories || [], vibe)) {
          return null;
        }

        const categoryLower = label.toLowerCase();

        let photo = null;

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
        if (mood === 'foodie') {
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
          distance: Math.round(dist * 10) / 10,
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
        // Enforce the disjoint distance band filter
        return place.distance >= minDistanceKm && place.distance <= maxDistanceKm;
      })
      .filter((place) => {
        if (mood === 'foodie' && subFilters && subFilters.budget && subFilters.budget !== 'any') {
          return place.budget === subFilters.budget;
        }
        return true;
      })
      .filter((place, index, self) =>
        index === self.findIndex((p) => p.name === place.name)
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    let finalPlaces = places;
    if (prependedPlace && validatePlaceForVibe(prependedPlace.name, prependedPlace.category, [], vibe)) {
      finalPlaces = [
        prependedPlace,
        ...places.filter((p) => p.name.toLowerCase() !== prependedPlace.name.toLowerCase())
      ].slice(0, 20);
    }

    // Fetch details for each place in parallel to get wiki_and_media (real photo)
    const detailedPlaces = await Promise.all(
      finalPlaces.map(async (place) => {
        try {
          const detailRes = await axios.get('https://api.geoapify.com/v2/place-details', {
            params: {
              id: place.osmId,
              features: 'wiki_and_media',
              apiKey,
            },
            timeout: 2000, // 2-second timeout
          });
          const wikiImage = detailRes.data?.features?.[0]?.properties?.wiki_and_media?.image;
          
          let resolvedPhoto = null;
          if (wikiImage) {
            if (wikiImage.startsWith('http://') || wikiImage.startsWith('https://')) {
              resolvedPhoto = wikiImage;
            } else if (wikiImage.startsWith('File:')) {
              resolvedPhoto = getWikimediaUrl(wikiImage);
            }
          }
          
          return {
            ...place,
            photo: resolvedPhoto,
          };
        } catch (err) {
          return {
            ...place,
            photo: null,
          };
        }
      })
    );

    res.json({
      places: detailedPlaces,
      count: detailedPlaces.length,
      mood,
      radius: radiusMeters,
      resolvedLocation: {
        lat: resolvedLat,
        lng: resolvedLng,
        address: resolvedAddress || 'Current Location'
      }
    });
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

// @desc    Get autocomplete suggestions for location search
// @route   GET /api/places/autocomplete
// @access  Public
const getAutocompleteSuggestions = async (req, res, next) => {
  try {
    const { text, lat, lng } = req.query;
    if (!text || !text.trim()) {
      return res.json({ suggestions: [] });
    }

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Places API key not configured on server.' });
    }

    const userLat = lat ? Number(lat) : null;
    const userLng = lng ? Number(lng) : null;
    const hasUserCoords = userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng);
    const qLower = text.trim().toLowerCase();

    const baseParams = {
      text: text.trim(),
      apiKey,
      ...(hasUserCoords ? { bias: `proximity:${userLng},${userLat}` } : {}),
    };

    // 1. Primary India-biased search (countrycode:in) with location proximity bias
    let indiaResponse = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
      params: {
        ...baseParams,
        filter: 'countrycode:in',
        limit: 10,
      },
      timeout: 5000,
    });

    let indiaFeatures = indiaResponse.data?.features || [];

    // 2. Global fallback search for international results
    let globalFeatures = [];
    if (indiaFeatures.length < 5) {
      const globalResponse = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
        params: {
          ...baseParams,
          limit: 10,
        },
        timeout: 5000,
      });
      globalFeatures = globalResponse.data?.features || [];
    }

    // Process and sort features by Location Proximity & City Constraint Tiers + Name Match Rank:
    // Tier 1: Local / User's city area (within 100km of user coords or in India)
    // Tier 2: Rest of India outside local region (> 100km)
    // Tier 3: International / Far away places
    const combinedMap = new Map();
    [...indiaFeatures, ...globalFeatures].forEach((feature) => {
      const props = feature.properties;
      if (props.place_id && !combinedMap.has(props.place_id)) {
        const placeLat = props.lat;
        const placeLon = props.lon;

        let dist = 99999;
        if (hasUserCoords && placeLat && placeLon) {
          dist = getDistance(userLat, userLng, placeLat, placeLon);
        }

        const isIndia = (props.country_code || '').toLowerCase() === 'in' || (props.country || '').toLowerCase() === 'india';

        let tier = 3; // International
        if (isIndia) {
          if (hasUserCoords) {
            tier = dist <= 100 ? 1 : 2;
          } else {
            tier = 1;
          }
        }

        // Match Rank calculation:
        // Rank 0: Exact or prefix match on place name (e.g. Name is "Marine Drive")
        // Rank 1: Name contains query
        // Rank 2: Query found in address line / street (e.g. "InterContinental Hotel, Marine Drive")
        const nameLower = (props.name || '').toLowerCase();
        const formattedLower = (props.formatted || '').toLowerCase();
        let matchRank = 2;
        if (nameLower === qLower || nameLower.startsWith(qLower)) {
          matchRank = 0;
        } else if (nameLower.includes(qLower)) {
          matchRank = 1;
        } else if (formattedLower.startsWith(qLower)) {
          matchRank = 1.5;
        }

        combinedMap.set(props.place_id, {
          placeId: props.place_id,
          formatted: props.formatted,
          name: props.name || null,
          city: props.city || props.suburb || props.county || props.district || null,
          state: props.state || null,
          country: props.country || null,
          lat: props.lat,
          lon: props.lon,
          resultType: props.result_type || null,
          tier,
          matchRank,
          distance: dist,
        });
      }
    });

    const suggestions = Array.from(combinedMap.values());

    // Sort Tier ascending -> Match Rank ascending -> Distance ascending
    suggestions.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
      return a.distance - b.distance;
    });

    res.json({ suggestions: suggestions.slice(0, 7) });
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ message: 'Autocomplete request timed out.' });
    }
    next(error);
  }
};

module.exports = { getNearbyPlaces, getAutocompleteSuggestions };


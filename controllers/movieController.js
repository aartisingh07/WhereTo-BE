const axios = require('axios');

// Genre mapping (TMDB genre IDs)
const GENRES = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  science_fiction: 878,
  thriller: 53,
  western: 37,
};

// Fallback stub catalog (when TMDB API key is not configured or fails)
const fallbackMovies = [
  {
    id: 508883,
    title: 'Spider-Man: Into the Spider-Verse',
    poster: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=400&q=80',
    rating: 8.4,
    overview: 'Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions to stop a threat for all realities.',
    releaseYear: 2018,
    mediaType: 'movie',
    genres: ['action', 'animation', 'science_fiction'],
    moods: ['feel-good', 'mind-bending'],
    language: 'en',
  },
  {
    id: 1399,
    title: 'Game of Thrones',
    poster: 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=400&q=80',
    rating: 8.4,
    overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.',
    releaseYear: 2011,
    mediaType: 'tv',
    genres: ['action', 'drama'],
    moods: ['intense', 'classic'],
    language: 'en',
  },
  {
    id: 60735,
    title: 'The Flash',
    poster: 'https://images.unsplash.com/photo-1608889174637-3c44f6326f20?auto=format&fit=crop&w=400&q=80',
    rating: 7.8,
    overview: 'After a particle accelerator causes a devastating storm, Barry Allen is struck by lightning and enters a coma. Months later he awakens with the power of super speed.',
    releaseYear: 2014,
    mediaType: 'tv',
    genres: ['action', 'drama', 'science_fiction'],
    moods: ['intense'],
    language: 'en',
  },
  {
    id: 66732,
    title: 'Stranger Things',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
    rating: 8.6,
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    releaseYear: 2016,
    mediaType: 'tv',
    genres: ['drama', 'science_fiction', 'horror'],
    moods: ['intense', 'mind-bending'],
    language: 'en',
  },
  {
    id: 31011,
    title: 'Inception',
    poster: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=80',
    rating: 8.4,
    overview: 'Cobb, a skilled thief who steals valuable secrets from deep within the subconscious during the dream state, is given a chance at redemption: plant an idea into a targets mind.',
    releaseYear: 2010,
    mediaType: 'movie',
    genres: ['action', 'science_fiction'],
    moods: ['mind-bending', 'classic'],
    language: 'en',
  },
  {
    id: 278,
    title: 'The Shawshank Redemption',
    poster: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80',
    rating: 8.7,
    overview: 'Imprisoned in the 1940s for the double murder of his wife and her lover, Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden.',
    releaseYear: 1994,
    mediaType: 'movie',
    genres: ['drama'],
    moods: ['classic', 'intense'],
    language: 'en',
  },
  {
    id: 13,
    title: 'Forrest Gump',
    poster: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80',
    rating: 8.5,
    overview: 'A man with a low IQ has accomplished great things in his life and been present during significant historical events—each case far exceeding what anyone imagined he could do.',
    releaseYear: 1994,
    mediaType: 'movie',
    genres: ['comedy', 'romance', 'drama'],
    moods: ['feel-good', 'classic'],
    language: 'en',
  },
  {
    id: 259693,
    title: 'The Conjuring',
    poster: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=400&q=80',
    rating: 7.5,
    overview: 'Paranormal investigators Ed and Lorraine Warren work to help a family terrorized by a dark presence in their farmhouse.',
    releaseYear: 2013,
    mediaType: 'movie',
    genres: ['horror'],
    moods: ['intense'],
    language: 'en',
  },
  {
    id: 546554,
    title: 'Knives Out',
    poster: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
    rating: 7.8,
    overview: 'A detective investigates the death of a patriarch of an eccentric, combative family.',
    releaseYear: 2019,
    mediaType: 'movie',
    genres: ['comedy', 'drama'],
    moods: ['mind-bending', 'feel-good'],
    language: 'en',
  },
  {
    id: 157336,
    title: 'Interstellar',
    poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
    rating: 8.3,
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    releaseYear: 2014,
    mediaType: 'movie',
    genres: ['drama', 'science_fiction'],
    moods: ['mind-bending', 'classic'],
    language: 'en',
  },
  {
    id: 8363,
    title: 'Superbad',
    poster: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    rating: 7.2,
    overview: 'Two co-dependent high school seniors are forced to deal with separation anxiety after their plan to stage a booze-filled party goes awry.',
    releaseYear: 2007,
    mediaType: 'movie',
    genres: ['comedy'],
    moods: ['feel-good'],
    language: 'en',
  },
  {
    id: 20453,
    title: '3 Idiots',
    poster: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
    rating: 8.0,
    overview: 'Two friends search for their long lost companion. They revisit their college days and recall the memories of their friend who inspired them to think differently.',
    releaseYear: 2009,
    mediaType: 'movie',
    genres: ['comedy', 'drama'],
    moods: ['feel-good', 'classic'],
    language: 'hi',
  },
  {
    id: 360814,
    title: 'Dangal',
    poster: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&q=80',
    rating: 8.0,
    overview: 'Former wrestler Mahavir Singh Phogat and his two wrestler daughters struggle towards glory at the Commonwealth Games in the face of societal oppression.',
    releaseYear: 2016,
    mediaType: 'movie',
    genres: ['drama'],
    moods: ['classic', 'feel-good'],
    language: 'hi',
  },
  {
    id: 79148,
    title: 'Sacred Games',
    poster: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=400&q=80',
    rating: 7.6,
    overview: 'A link in their pasts leads an honest cop to a fugitive gang boss, whose cryptic warning spurs the officer on a quest to save Mumbai from cataclysm.',
    releaseYear: 2018,
    mediaType: 'tv',
    genres: ['action', 'drama'],
    moods: ['intense'],
    language: 'hi',
  },
  {
    id: 538803,
    title: 'Tumbbad',
    poster: 'https://images.unsplash.com/photo-1519074069444-1ba4e6663104?auto=format&fit=crop&w=400&q=80',
    rating: 8.2,
    overview: 'A mythological story about a goddess who created the entire universe. The plot revolves around the consequences when humans build a temple for her first-born, Hastar.',
    releaseYear: 2018,
    mediaType: 'movie',
    genres: ['horror', 'drama'],
    moods: ['intense', 'mind-bending', 'classic'],
    language: 'hi',
  },
  {
    id: 181283,
    title: 'Yeh Jawaani Hai Deewani',
    poster: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=400&q=80',
    rating: 7.2,
    overview: 'Kabir and Naina meet during a trekking trip where she falls in love with him but refrains from expressing it. They soon drift apart but end up meeting again at a friend\'s wedding.',
    releaseYear: 2013,
    mediaType: 'movie',
    genres: ['romance', 'comedy'],
    moods: ['feel-good'],
    language: 'hi',
  },
  {
    id: 115161,
    title: 'Gangs of Wasseypur',
    poster: 'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?auto=format&fit=crop&w=400&q=80',
    rating: 8.2,
    overview: 'A clash between Sultan and Shahid Khan leads to the expulsion of Khan from Wasseypur, and ignites a deadly three-generation feud.',
    releaseYear: 2012,
    mediaType: 'movie',
    genres: ['action', 'drama'],
    moods: ['intense', 'classic'],
    language: 'hi',
  },
  {
    id: 29016,
    title: 'Sholay',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
    rating: 8.1,
    overview: 'After his family is murdered by a notorious bandit, a retired police officer enlists the help of two petty thieves to capture the outlaw.',
    releaseYear: 1975,
    mediaType: 'movie',
    genres: ['action', 'drama'],
    moods: ['classic'],
    language: 'hi',
  },
  {
    id: 496243,
    title: 'Parasite',
    poster: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
    rating: 8.5,
    overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.',
    releaseYear: 2019,
    mediaType: 'movie',
    genres: ['drama', 'comedy'],
    moods: ['mind-bending', 'intense', 'classic'],
    language: 'ko',
  },
  {
    id: 115441,
    title: 'Squid Game',
    poster: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80',
    rating: 8.4,
    overview: 'Hundreds of cash-strapped players accept a strange invitation to compete in children\'s games. Inside, a tempting prize awaits with deadly high stakes.',
    releaseYear: 2021,
    mediaType: 'tv',
    genres: ['action', 'drama'],
    moods: ['intense', 'mind-bending'],
    language: 'ko',
  },
  {
    id: 94796,
    title: 'Crash Landing on You',
    poster: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    rating: 8.7,
    overview: 'A South Korean heiress paraglides into North Korea after an accident and is hidden by a North Korean military officer who falls in love with her.',
    releaseYear: 2019,
    mediaType: 'tv',
    genres: ['romance', 'comedy', 'drama'],
    moods: ['feel-good'],
    language: 'ko',
  },
  {
    id: 396535,
    title: 'Train to Busan',
    poster: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=400&q=80',
    rating: 7.8,
    overview: 'While a zombie virus breaks out in South Korea, passengers struggle to survive on the train from Seoul to Busan.',
    releaseYear: 2016,
    mediaType: 'movie',
    genres: ['horror', 'action'],
    moods: ['intense'],
    language: 'ko',
  },
  {
    id: 670,
    title: 'Oldboy',
    poster: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    rating: 8.2,
    overview: 'After being kidnapped and imprisoned for fifteen years, Oh Dae-su is released, only to find that he must find his captor in five days.',
    releaseYear: 2003,
    mediaType: 'movie',
    genres: ['action', 'drama'],
    moods: ['intense', 'mind-bending', 'classic'],
    language: 'ko',
  },
  {
    id: 71446,
    title: 'Money Heist',
    poster: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&w=400&q=80',
    rating: 8.3,
    overview: 'To carry out the biggest heist in history, a mysterious man called The Professor recruits a band of eight robbers who have nothing to lose.',
    releaseYear: 2017,
    mediaType: 'tv',
    genres: ['action', 'drama'],
    moods: ['intense', 'mind-bending'],
    language: 'es',
  },
  {
    id: 1417,
    title: 'Pan\'s Labyrinth',
    poster: 'https://images.unsplash.com/photo-1518818419601-72c8673f5852?auto=format&fit=crop&w=400&q=80',
    rating: 8.0,
    overview: 'In the Falangist Spain of 1944, the young stepdaughter of a sadistic army officer escapes into a eerie but captivating fantasy world.',
    releaseYear: 2006,
    mediaType: 'movie',
    genres: ['drama', 'horror'],
    moods: ['mind-bending', 'classic'],
    language: 'es',
  },
  {
    id: 76669,
    title: 'Elite',
    poster: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80',
    rating: 7.4,
    overview: 'When three working-class teens enroll in an exclusive private school in Spain, the clash between them and the wealthy students leads to murder.',
    releaseYear: 2018,
    mediaType: 'tv',
    genres: ['drama', 'romance'],
    moods: ['intense'],
    language: 'es',
  },
  {
    id: 426426,
    title: 'Roma',
    poster: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=400&q=80',
    rating: 7.7,
    overview: 'A year in the life of a middle-class family\'s maid in Mexico City in the early 1970s.',
    releaseYear: 2018,
    mediaType: 'movie',
    genres: ['drama'],
    moods: ['classic'],
    language: 'es',
  },
  {
    id: 412444,
    title: 'The Invisible Guest',
    poster: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    rating: 7.9,
    overview: 'A successful entrepreneur accused of murder and a witness preparation expert have less than three hours to come up with an impregnable defense.',
    releaseYear: 2016,
    mediaType: 'movie',
    genres: ['drama', 'horror'],
    moods: ['mind-bending', 'intense'],
    language: 'es',
  }
];

// @desc    Discover movies based on genres, mood, language
// @route   POST /api/movies/discover
// @access  Private
const discoverMovies = async (req, res, next) => {
  try {
    const { genres = [], mood = 'feel-good', language = 'en' } = req.body;
    const apiKey = process.env.TMDB_API_KEY;

    // Check if API Key is configured
    if (!apiKey || apiKey === 'your_tmdb_api_key_here' || apiKey === 'your_tmdb_key_here') {
      console.log('⚠️ TMDB API Key not configured. Using fallback catalog.');
      return filterFallbackCatalog(res, genres, mood, language);
    }

    // Map genres labels to IDs
    const genreIds = genres.map((g) => GENRES[g]).filter(Boolean).join(',');

    // Map mood to TMDB discover parameters
    let sort_by = 'popularity.desc';
    let vote_average_gte = 0;

    if (mood === 'classic') {
      sort_by = 'vote_average.desc';
      vote_average_gte = 7.5;
    } else if (mood === 'intense') {
      vote_average_gte = 6.5;
    } else if (mood === 'mind-bending') {
      vote_average_gte = 7.0;
    }

    // Call TMDB Discover API
    try {
      const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
        params: {
          api_key: apiKey,
          with_genres: genreIds || undefined,
          sort_by,
          'vote_average.gte': vote_average_gte || undefined,
          with_original_language: language === 'all' ? undefined : language,
          page: 1,
        },
        timeout: 10000,
      });

      const results = response.data?.results || [];

      const movies = results.map((movie) => ({
        id: movie.id,
        title: movie.title || movie.name,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750/1a1a2e/ffffff?text=No+Poster',
        rating: Math.round((movie.vote_average || 0) * 10) / 10,
        overview: movie.overview || 'No overview available.',
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown',
        mediaType: 'movie',
      })).slice(0, 15);

      return res.json({ movies, source: 'tmdb' });
    } catch (apiError) {
      console.error('❌ TMDB API request failed:', apiError.message);
      console.log('Falling back to local catalog.');
      return filterFallbackCatalog(res, genres, mood, language);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get watch providers for a movie/show
// @route   GET /api/movies/providers/:id
// @access  Private
const getWatchProviders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey || apiKey === 'your_tmdb_api_key_here' || apiKey === 'your_tmdb_key_here') {
      // Mock providers for fallback
      return res.json({
        providers: [
          { provider_name: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg' },
          { provider_name: 'Prime Video', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png' },
          { provider_name: 'Disney+', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
        ],
      });
    }

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, {
        params: { api_key: apiKey },
      });

      const results = response.data?.results || {};
      // Get providers in US (default) or IN or first available country
      const countryCode = 'IN'; // India, or fallback
      const countryProviders = results[countryCode] || results['US'] || Object.values(results)[0] || {};
      const flatrate = countryProviders.flatrate || [];
      const buy = countryProviders.buy || [];
      const rent = countryProviders.rent || [];

      // Combine and filter unique provider objects
      const providersMap = {};
      [...flatrate, ...buy, ...rent].forEach((prov) => {
        providersMap[prov.provider_id] = {
          provider_name: prov.provider_name,
          logo: prov.logo_path ? `https://image.tmdb.org/t/p/original${prov.logo_path}` : null,
        };
      });

      return res.json({
        providers: Object.values(providersMap),
      });
    } catch (apiError) {
      console.error('❌ TMDB Providers API failed:', apiError.message);
      return res.json({
        providers: [
          { provider_name: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg' },
          { provider_name: 'Prime Video', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png' },
          { provider_name: 'Disney+', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
        ],
      });
    }
  } catch (error) {
    next(error);
  }
};

// Helper function to filter the local fallback movie database
const filterFallbackCatalog = (res, genres = [], mood = 'feel-good', language = 'en') => {
  let list = [...fallbackMovies];

  // 1. Filter by language (if not 'all')
  if (language && language !== 'all') {
    list = list.filter((m) => m.language === language);
  }

  // 2. Filter by mood
  if (mood) {
    list = list.filter((m) => m.moods && m.moods.includes(mood));
  }

  // 3. Filter by genres if specified
  if (genres && genres.length > 0) {
    list = list.filter((m) =>
      m.genres.some((g) => genres.includes(g))
    );
  }

  // Fallback if no match, return at least language-matched items or all
  if (list.length === 0) {
    list = fallbackMovies.filter((m) => language === 'all' || m.language === language);
    if (list.length === 0) {
      list = [...fallbackMovies];
    }
  }

  // Return formatted
  return res.json({
    movies: list.map(({ id, title, poster, rating, overview, releaseYear, mediaType }) => ({
      id,
      title,
      poster,
      rating,
      overview,
      releaseYear,
      mediaType,
    })),
    source: 'fallback',
  });
};

module.exports = { discoverMovies, getWatchProviders };

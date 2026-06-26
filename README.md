# 🗺️ Where To? — Backend

> REST API & real-time WebSocket server for the **Where To?** platform — a collaborative room-based social app where groups can chat, vote on multiplayer games, discover movies with streaming availability, run synced Pomodoro sessions, and plan outings based on location midpoints.

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure user register, login, and profile tracking using bcryptjs and auto-generated DiceBear avatars.
- 📡 **Real-Time WebSockets (Socket.io)** — Secure token verification on handshake and modular event handlers for room activities.
- 🎮 **Generic Proposal & Voting Engine** — Real-time Yes/No/Maybe voting tally systems with 30s auto-expiry.
- 🎬 **TMDB Discover & Providers** — Advanced movie discover aggregation mapping moods and query parameters, falling back to a local catalog, and fetching watch provider platforms.
- 📍 **Midpoint Centroid Calculations** — Group coordinates midpoint aggregation to fetch fair nearby destinations using Geoapify Places API.
- ⏱️ **Synchronized Timers** — Centralized tick emitter managing room-wide Pomodoro timers.
- 🗺️ **Location Autocomplete & Real Photos** — Debounced autocomplete suggestions dropdown on search input typing, prepending specific geocoded POIs, and parallel place detail queries with MD5 resolution for Wikimedia Commons media.
- 💬 **Private Direct Messaging (DM)** — Search users, send connection invitations, manage pending requests, and exchange secure real-time messages with unread notification counts, socket updates, and read synchronization.
- 📸 **Memories & Media Storage API** — Stream and parse multipart image uploads using Multer, resize/compress and upload assets to Cloudinary cloud media storage, and fetch user-centric or public community feeds.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JS runtime environment |
| Express.js | Backend REST API framework |
| MongoDB Atlas | Cloud database persistence |
| Mongoose | Object Data Modeling (ODM) |
| Socket.io | Bidirectional real-time messaging |
| JWT | Session authentication tokens |
| bcryptjs | Password hashing and verification |
| Multer | Multipart/form-data middleware for image handling |
| Cloudinary SDK | Cloud storage service integration for photo uploads |
| Axios | External API requests (Geoapify, TMDB) |

---

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js                  # MongoDB database connection
├── controllers/               # Route handler logic
│   ├── authController.js      # Register, login, session details
│   ├── placeController.js     # Geoapify place finder
│   ├── roomController.js      # Room creation, joining, and deactivation
│   ├── movieController.js     # TMDB movie discovery and watch providers
│   └── memoryController.js    # Cloudinary image upload and feed controller
├── middleware/
│   ├── authMiddleware.js      # JWT token guard and user payload mapping
│   └── errorHandler.js        # Global error interceptor
├── models/                    # Mongoose schemas (User, Room, Message, Memory, SavedPlace)
├── routes/                    # API route definitions
│   ├── authRoutes.js
│   ├── placeRoutes.js
│   ├── roomRoutes.js
│   ├── movieRoutes.js
│   └── memoryRoutes.js        # Memories feed & upload routes
├── socket/                    # Real-time event handlers
│   ├── socketHandler.js       # Core socket connection & chat listener
│   ├── votingHandler.js       # Game, movie, and outing group voting
│   ├── timerHandler.js        # Synchronized room Pomodoro timer
│   └── outingHandler.js       # Location aggregation & midpoint search
├── utils/                     # Helper functions (code generator)
├── server.js                  # App entry point
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB database (local instance or MongoDB Atlas cluster URI)
- External API keys (Geoapify API, TMDB API)

### Installation

```bash
# Clone the repository
git clone https://github.com/aartisingh07/where-to-BE.git
cd where-to-BE

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GEOAPIFY_API_KEY=your_geoapify_key_here
TMDB_API_KEY=your_tmdb_key_here
```

### Run Locally

```bash
# Development mode (nodemon)
npm run dev

# Production mode
npm start
```

The server will spin up at `http://localhost:5000`.

---

## 📡 API Endpoints

### 🔑 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Login and retrieve JWT token
- `GET /api/auth/me` — Retrieve current user session details (Auth required)

### 🏠 Rooms (`/api/rooms`)
- `POST /api/rooms/create` — Generate room code and initialize room (Auth required)
- `POST /api/rooms/join` — Enter room by 6-character code (Auth required)
- `GET /api/rooms/:id` — Retrieve room info & member lists (Auth required)
- `GET /api/rooms/:id/messages` — Retrieve room's chat history (Auth required)
- `PATCH /api/rooms/:id/activity` — Modify room's current activity (Host only)
- `POST /api/rooms/:id/leave` — Leave the room lobby (Auth required)

### 📍 Places (`/api/places` & `/api/user`)
- `POST /api/places/nearby` — Get nearby places by mood/radius (Solo Explore)
- `GET /api/places/autocomplete` — Get location autocomplete suggestions (Solo Explore)
- `POST /api/user/places/save` — Save place to user favorites profile (Auth required)
- `GET /api/user/places` — Retrieve all user's saved places (Auth required)
- `DELETE /api/user/places/:id` — Remove saved place (Auth required)

### 💬 Direct Messages & Chat Requests (`/api/chats`)
- `GET /api/chats/search` — Search user by username excluding oneself (Auth required)
- `POST /api/chats/request` — Send chat request to user (Auth required)
- `POST /api/chats/request/:requestId` — Accept/Reject a chat request (Auth required)
- `GET /api/chats/active` — Fetch all active conversations with last message snippets (Auth required)
- `GET /api/chats/requests` — Get incoming pending requests (Auth required)
- `GET /api/chats/messages/:otherUserId` — Retrieve direct message logs (Auth required)
- `POST /api/chats/messages/:otherUserId` — Send direct message and trigger socket notifications (Auth required)
- `GET /api/chats/unread-count` — Retrieve current user's unread private message count (Auth required)
- `POST /api/chats/mark-read/:senderId` — Mark messages from a specific sender as read (Auth required)

### 📸 Memories (`/api/memories`)
- `POST /api/memories` — Upload memory photo with caption and visibility (Auth required)
- `GET /api/memories/feed` — Get memories feed of public posts (Auth required)
- `GET /api/memories/user/:userId` — Get memories for a specific user based on relationship (Auth required)
- `DELETE /api/memories/:id` — Delete a memory entry and Cloudinary image (Auth required)

### 🎬 Movies (`/api/movies`)
- `POST /api/movies/discover` — Retrieve movie list matching genres/moods/languages (Auth required)
- `GET /api/movies/providers/:id` — Retrieve watch provider streaming sources (Auth required)

---

## 🔌 Socket.io Events Map

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join-room` | Client → Server | `{ roomId }` | Connect user to room room channel |
| `leave-room` | Client → Server | `{ roomId }` | Leave room channel |
| `new-message` | Server → Client | Message Object | Broadcast chat message or system notification |
| `send-message` | Client → Server | `{ roomId, content }` | Send a text message to lobby |
| `set-activity` | Client → Server | `{ roomId, activity }` | Host toggles the selected activity |
| `activity-changed` | Server → Client | `{ activity }` | Broadcast activity change |
| `start-vote` | Client → Server | `{ roomId, item }` | Propose a game, movie, or outing place |
| `vote-started` | Server → Client | `{ item, endTime, votes, tallies }` | Broadcast voting start countdown |
| `cast-vote` | Client → Server | `{ roomId, vote }` | Submit Yes / No / Maybe |
| `vote-update` | Server → Client | `{ votes, tallies }` | Update client progress counts |
| `end-vote` | Client → Server | `{ roomId }` | Close voting early (Host only) |
| `vote-result` | Server → Client | `{ item, votes, tallies, result }` | Publish final voting outcome |
| `get-timer-state` | Client → Server | `{ roomId }` | Synchronize study timer state |
| `start-timer` | Client → Server | `{ roomId }` | Launch Pomodoro cycle ticks |
| `pause-timer` | Client → Server | `{ roomId }` | Pause Pomodoro cycle ticks |
| `reset-timer` | Client → Server | `{ roomId }` | Reset Pomodoro cycle to 25:00 |
| `timer-update` | Server → Client | `{ timeLeft, duration, isRunning, mode }` | Tick emitter sync payload |
| `submit-outing-pref` | Client → Server | `{ roomId, pref }` | Send location/distance/mood preference |
| `outing-state-update` | Server → Client | `{ submissions }` | Update list of users who submitted locations |
| `find-outing-places` | Client → Server | `{ roomId }` | Host triggers midpoint aggregation |
| `outing-places-found` | Server → Client | `{ places, midpoint, mood, radius }` | Broadcast calculated places |
| `direct-message-${receiverId}` | Server → Client | Message Object | Direct message sent to receiver |
| `unread-count-updated-${receiverId}` | Server → Client | `{ unreadCount }` | Notify receiver of their updated unread DM count |

---

## 🔗 Related

- 🎨 **Frontend Client**: [where-to-FE](https://github.com/aartisingh07/where-to-FE)

---

## 👩‍💻 Author

**Aarti Singh** — [@aartisingh07](https://github.com/aartisingh07)

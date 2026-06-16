# 🗺️ Where To? — Backend

> REST API & real-time WebSocket server for the **Where To?** platform — a collaborative room-based app where users can create, join, and explore rooms in real time.

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure register/login with hashed passwords
- 🧠 **MongoDB Atlas** — Cloud-hosted NoSQL database
- 📡 **Socket.io** — Real-time bidirectional communication
- 🛡️ **Middleware** — Auth guards, error handling
- 🌐 **CORS-ready** — Configured for frontend integration
- 🔁 **RESTful API** — Clean, structured API routes

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB Atlas | Cloud database |
| Mongoose | MongoDB ODM |
| Socket.io | Real-time events |
| JWT | Authentication tokens |
| bcryptjs | Password hashing |
| dotenv | Environment config |
| nodemon | Dev auto-restart |

---

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/               # Route handler logic
├── middleware/
│   └── errorHandler.js        # Global error handler
├── models/                    # Mongoose schemas
├── routes/
│   └── authRoutes.js          # Auth endpoints
├── socket/
│   └── socketHandler.js       # Socket.io event logic
├── utils/                     # Utility/helper functions
├── server.js                  # App entry point
├── package.json
└── .env                       # Environment variables (not pushed)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account & cluster

### Installation

```bash
# Clone the repo
git clone https://github.com/aartisingh07/where-to-BE.git
cd where-to-BE

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Run Locally

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Server will start at `http://localhost:5000`

---

## 📡 API Endpoints

### Auth Routes — `/api/auth`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | ❌ |
| POST | `/api/auth/login` | Login & get JWT token | ❌ |

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server status |

---

## 🔗 Related

- 🎨 **Frontend Repo**: [where-to-FE](https://github.com/aartisingh07/where-to-FE)

---

## 👩‍💻 Author

**Aarti Singh** — [@aartisingh07](https://github.com/aartisingh07)

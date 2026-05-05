# StageHand · Server

Backend for **StageHand**, a remote OBS scene controller. Runs the REST API, the
Socket.io broker, and persists scenes/users in MongoDB.

Companion frontend: [`obs-stagehand-client`](https://github.com/darkeng/obs-stagehand-client).

## Stack

- **Express 5** — HTTP routes
- **Socket.io 4** — per-scene rooms for real-time element sync
- **Mongoose 9** — MongoDB ODM
- **JWT (`jsonwebtoken`) + `bcryptjs`** — user / guest auth
- **Multer** — file upload scaffold (currently unmounted)

## Quick start

```bash
cp .env.example .env          # edit JWT_SECRET
npm install
npm start                     # node server.js
```

Server listens on `PORT` (default `3000`). MongoDB must be reachable at
`MONGODB_URI`.

### Docker

```bash
docker build -t stagehand-server .
docker run -p 3000:3000 --env-file .env stagehand-server
```

## Environment variables

| Variable      | Description                                       |
| ------------- | ------------------------------------------------- |
| `PORT`        | HTTP port (default `3000`)                        |
| `MONGODB_URI` | Mongo connection string                           |
| `JWT_SECRET`  | Long random string used to sign / verify tokens   |

## API surface

### REST (`/api/*`)

| Method | Path                         | Description                                   |
| ------ | ---------------------------- | --------------------------------------------- |
| POST   | `/auth/guest`                | Mint a guest token                            |
| POST   | `/auth/signup`               | Create a user, optionally migrating guest scenes |
| POST   | `/auth/login`                | Issue a user token                            |
| GET    | `/auth/me`                   | Resolve the current principal                 |
| GET    | `/scenes`                    | List scenes owned by the principal            |
| POST   | `/scenes`                    | Create a scene under the principal            |
| GET    | `/scenes/:id`                | Read scene by `_id` (owner-restricted)        |
| PATCH  | `/scenes/:id`                | Rename a scene                                |
| DELETE | `/scenes/:id`                | Delete a scene                                |
| GET    | `/scenes/by-token/:token`    | Public read by `shareToken` (used by OBS)     |

### Socket.io

Two roles: **editor** (JWT) for mutations, **viewer** (`shareToken`) for the OBS
Browser Source.

| Event             | Direction        | Notes                                       |
| ----------------- | ---------------- | ------------------------------------------- |
| `join-scene`      | C → S            | Join the room for a given `sceneId`         |
| `add-element`     | C → S → room     | Editor only; persists `$push`               |
| `update-element`  | C → S → room     | Editor only; persists `$set` positional     |
| `remove-element`  | C → S → room     | Editor only; persists `$pull`               |
| `obs-status`      | viewer → editors | OBS streaming/recording state, cached per scene |

The server caches the last `obs-status` per scene (TTL 15s) and replays it on
`join-scene` so a controller opened mid-stream sees `LIVE` immediately.

## Layout

```
backend/
├── server.js              ← bootstrap (HTTP + Socket.io + Mongoose)
├── app.js                 ← Express composition
├── config.js              ← env validation + named constants
├── lib/                   ← jwt + share-token helpers
├── middleware/auth.js     ← requireAuth, optionalAuth, ownerFilter
├── models/                ← Scene + User
├── routes/                ← auth, scenes, upload (stub)
├── services/              ← authService, obsStatusCache
└── sockets/               ← composition + auth + handlers
```

## Data model

Scenes carry exactly one of `owner` (User) **or** `guestId` (UUID embedded in
the guest JWT). Validation enforced via a `pre('validate')` hook. Elements are
embedded subdocuments, identified by client-generated short ids.

## Production

Deployed at **api.stagehand.darkeng.dev** behind a reverse proxy. Mongo is
expected to be a managed instance or a sibling container.

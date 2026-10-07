# Athenaeum · Library OS

A library management system rebuilt as a full **MERN** application — **M**ongoDB, **E**xpress, **R**eact, **N**ode — replacing the earlier server-rendered EJS + SQLite version.

![stack](https://img.shields.io/badge/MongoDB-1E6E5A?style=flat-square&logo=mongodb&logoColor=white) ![stack](https://img.shields.io/badge/Express-000000?style=flat-square) ![stack](https://img.shields.io/badge/React-149ECA?style=flat-square&logo=react&logoColor=black) ![stack](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)

## Quick start

```bash
npm install
npm run install:client   # first time only — installs the React client deps
npm run build            # builds the React client into client/dist
npm start                # serves the API + built client on http://localhost:5000
```

Development (hot reload on both sides):

```bash
npm run dev              # Express on :5000 + Vite dev server on :5173
```

Open **http://localhost:5000** (production build) or **http://localhost:5173** (dev).

### Demo accounts

| Librarian   | Email               | Password |
|-------------|---------------------|----------|
| Raghunath   | ragunath@nmamit.in  | abc@123  |
| Puneeth     | puneeth@nmamit.in   | abc@456  |
| Darshan     | darshan@nmamit.in   | abc@789  |

### Database

- **With `MONGODB_URI` set** (Atlas or a local mongod) the app connects there and persists everything.
- **Without it**, the server boots an embedded in-memory MongoDB (`mongodb-memory-server`), seeds demo data on first run and reseeds on restart — zero configuration for local evaluation.

```bash
MONGODB_URI="mongodb+srv://…" npm start   # persistent
npm run seed                              # re-seed a remote DB (add -- --reset to wipe first)
```

## What makes it different

- **⌘K command palette** — fuzzy search across books, members and actions from any screen.
- **Library Pulse** — live floor occupancy with one-tap check-in/check-out and a weekday × hour footfall heatmap.
- **Overdue intelligence** — computed due windows, overdue badges and a dashboard queue with one-click "Received".
- **Analytics studio** — hand-rolled SVG charts: 14-day circulation trend, most-borrowed titles, branch donut, genre mix.
- **Deterministic cover art** — every catalogue entry gets its own generated jacket (no external image services).
- **Dark & light themes** — persisted across sessions, parchment-and-brass design system.
- **CSV export** for catalogue, members and loans; instant client-side search/filter/sort everywhere.

## Architecture

```
app.js               Express entry: sessions, /api router, serves client/dist
server/
  db.js              Mongo connection (MONGODB_URI or in-memory fallback)
  models.js          Mongoose schemas: Librarian, Book, Student, Borrow, Visit
  routes.js          REST API: auth, books, students, borrows, visits, stats, analytics
  seed.js            Deterministic demo data + auto-seed on empty DB
  util.js            scrypt password hashing + date helpers
client/              React 19 + Vite SPA
  src/pages/         Dashboard, Catalogue, Members, Loans, Visits, Analytics, Login
  src/components/    Layout, CommandPalette, Modal, charts, covers…
  src/styles.css     design system (light/dark tokens)
```

### API overview

| Method & path | Purpose |
|---|---|
| `POST /api/auth/login` · `logout` · `GET /api/auth/me` | session auth |
| `GET/POST /api/books` · `PUT/DELETE /api/books/:id` | catalogue CRUD (deletion blocked by active loans) |
| `GET/POST /api/students` · `PUT/DELETE /api/students/:id` | member registry |
| `GET/POST /api/borrows` · `POST /api/borrows/:id/return` | issue/return with stock bookkeeping |
| `GET /api/visits` · `POST /api/visits/checkin` · `checkout/:id` | front-desk occupancy |
| `GET /api/stats` · `GET /api/analytics` | KPIs, trends, heatmap, distributions |

## Deploying to Vercel

The app is pre-configured for Vercel (`vercel.json`, `api/index.js` serverless entry,
stateless signed-cookie sessions — server-memory sessions would not survive serverless):

1. **Database** — create a free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster,
   a database user, and network access `0.0.0.0/0`; copy the `mongodb+srv://…` connection string.
2. **CLI** — `npm i -g vercel`, then `vercel login` (or set a personal access token as `VERCEL_TOKEN`).
3. **Link & env** — `vercel link`, then:
   - `vercel env add MONGODB_URI production` and paste the Atlas URI,
   - `vercel env add SESSION_SECRET production` with any long random string
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) —
     the API refuses to boot on Vercel without it, because signed session
     cookies must not use a guessable secret.
4. **Deploy** — `vercel --prod`. The `vercel-build` script installs the client deps and builds
   `client/dist`; the Express API ships as `api/index.js`.
5. On first boot against an empty database the server auto-seeds the demo data.

Without `MONGODB_URI` on Vercel the API refuses to start (the embedded in-memory MongoDB is
a local-development convenience only). Locally, `npm start` / `npm run dev` need no configuration.

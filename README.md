# DailyBloom Backend

Backend API for a daily-essentials app: dairy subscriptions plus one-time orders
for flowers, bouquets, and handmade claypots from local vendors.

## Stack
- Node.js + Express
- PostgreSQL (via `pg`, raw SQL — no ORM, so the queries are easy to read and modify)
- JWT auth with phone + OTP login

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Set up PostgreSQL**
   - Create a database, e.g. `createdb dailybloom`
   - Copy `.env.example` to `.env` and fill in your `DATABASE_URL` and a `JWT_SECRET`

3. **Run migrations** (creates all tables)
   ```
   npm run migrate
   ```
   This runs every `.sql` file in `/migrations` in order — including `002_seed_data.sql`,
   which adds sample vendors and products so you have something to test against.
   Delete that file first if you'd rather start empty.

4. **Start the server**
   ```
   npm run dev
   ```
   API runs at `http://localhost:4000`. Check `http://localhost:4000/health` to confirm it's up.

## API overview

### Auth (no login required)
- `POST /api/auth/request-otp` — `{ phone }` → sends OTP (logged to console in dev, wire up a real SMS provider before production)
- `POST /api/auth/verify-otp` — `{ phone, otp, name? }` → returns `{ token, user }`

Use the returned `token` as `Authorization: Bearer <token>` on all routes below marked "requires auth".

### Browsing (no login required)
- `GET /api/vendors?zone_id=...` — list vendors in a delivery zone
- `GET /api/vendors/:id/products` — a vendor's product catalog
- `GET /api/products?zone_id=...&category=dairy` — browse products, optionally filtered by category
- `GET /api/products/:id` — single product detail

### Addresses (requires auth)
- `POST /api/addresses` — `{ zone_id, label, line1, line2, city, pincode, is_default }`
- `GET /api/addresses` — list saved addresses

### Orders — one-time purchases (requires auth)
- `POST /api/orders` — `{ address_id, delivery_date, delivery_slot, items: [{ product_id, quantity }] }`
- `GET /api/orders` — order history
- `GET /api/orders/:id` — single order with line items

### Subscriptions — recurring dairy orders (requires auth)
- `POST /api/subscriptions` — `{ product_id, address_id, frequency, quantity }`
- `GET /api/subscriptions` — list active/paused subscriptions
- `PATCH /api/subscriptions/:id` — `{ status, quantity, paused_until }` — pause, resume, cancel, or adjust

## What's deliberately NOT here yet (see roadmap)

- A daily job that turns active subscriptions into actual `orders` rows each morning
  (needs a scheduler like `node-cron` or a serverless cron job — add once you're ready to automate fulfillment)
- Payment integration (Razorpay/Stripe) — orders are created but not charged yet
- Vendor-side dashboard/API (accepting/fulfilling orders)
- Push notifications
- Real OTP delivery via SMS (currently just logs to console)

## Folder structure

```
src/
  config/       database connection + migration runner
  controllers/  business logic per resource
  middleware/   JWT auth guard
  routes/       Express route definitions
  app.js        Express app setup
migrations/     SQL schema + seed data
server.js       entry point
```

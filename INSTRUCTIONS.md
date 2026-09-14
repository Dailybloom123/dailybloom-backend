# DailyBloom — Feedback & Complaint System: Drop-in Files

Three files to copy into your project, then two commands to run. That's it.

---

## Step 1 — Copy the files

| File in this folder | Copy to |
|---|---|
| `DailyBloomApp.jsx` | `C:\Users\bharg\Downloads\DailyBloom\The Backbone\dailybloom-app-frontend\src\DailyBloomApp.jsx` |
| `feedbackController.js` | `C:\Users\bharg\Downloads\DailyBloom\The Backbone\dailybloom-backend\dailybloom-backend\src\controllers\feedbackController.js` |
| `migrations\008_add_delivered_at_to_orders.sql` | `C:\Users\bharg\Downloads\DailyBloom\The Backbone\dailybloom-backend\dailybloom-backend\migrations\008_add_delivered_at_to_orders.sql` |

**Replace** the existing files (make a backup first if you want).

---

## Step 2 — Run the migration

Open a terminal in your **backend** folder:

```
cd "C:\Users\bharg\Downloads\DailyBloom\The Backbone\dailybloom-backend\dailybloom-backend"
```

Then run:

```
node src/config/run-single-migration.js 008_add_delivered_at_to_orders.sql
```

You should see:
```
Running migration: 008_add_delivered_at_to_orders.sql
  ✓ 008_add_delivered_at_to_orders.sql applied successfully
```

---

## Step 3 — Also run migration 007 if it wasn't applied yet

If Devin's run of migration 007 was cut off and never finished, run it now:

```
node src/config/run-single-migration.js 007_add_feedback_complaints.sql
```

If it says "relation already exists" — it already ran, move on.

---

## Step 4 — Restart your servers

Backend terminal:
```
npm run dev
```

Frontend terminal (in the frontend folder):
```
npm run dev
```

---

## What's new / what changed

### Frontend (DailyBloomApp.jsx)

**Orders tab — each delivered order now shows:**

- **"Raise a Complaint"** button — visible for 60 minutes after delivery, with a live countdown showing minutes remaining
- **"Leave Feedback"** button — appears after the 60-minute complaint window closes
- **"Complaint submitted"** confirmation — shown if customer already filed one
- **Feedback stars** — shown after feedback is submitted (e.g. ★★★★☆)
- **"Feedback unlocks in X min"** — live countdown shown while waiting

**Complaint modal (bottom sheet):**

Step 1 — Customer picks one of two options:
- **Write to Us** → Subject + message form → submitted to backend
- **Call Us** → Shows DailyBloom number (+91 99102 17309) with a tap-to-call button + "Log this call" option that records the contact in the backend

**Feedback modal (bottom sheet):**
- Interactive 5-star rating (animated, touch-friendly)
- Optional comment field
- Submit button (disabled until a star is selected)
- Labels: Poor / Fair / Good / Very Good / Excellent!

**Live countdown:**
- Ticks every 30 seconds without re-fetching from the server
- Re-checks actual status from API every 60 seconds while on the Orders tab

### Backend (feedbackController.js)

**Bug fixes from Devin's version:**
1. **`minutesLeft` calculation was wrong** in `submitFeedback` — it was calculating a negative number. Fixed.
2. **`delivered_at` support** — new controller uses the dedicated `delivered_at` column (added by migration 008) for precise delivery time, falling back to `updated_at` for older orders.
3. **Duplicate complaint prevention** — added check to reject a second complaint on the same order (was missing in Devin's version).
4. **"call" type subject** — auto-generates subject "Customer requested a call" so the backend validation doesn't reject it.
5. **Rating parsing** — added `parseInt()` guard to prevent string-vs-number mismatch.

### Migration 008

Adds `delivered_at TIMESTAMP` column to the `orders` table.
- Your backend should set `delivered_at = NOW()` when it marks an order as `delivered`.
- Backfills existing delivered orders with `updated_at` as best approximation.

---

## One more thing — set delivered_at when marking orders delivered

In your backend order update route (wherever you set `status = 'delivered'`), add:

```js
// When marking an order as delivered:
await query(
  'UPDATE orders SET status = $1, delivered_at = NOW(), updated_at = NOW() WHERE id = $2',
  ['delivered', orderId]
);
```

This gives you a precise, permanent delivery timestamp that never changes if you update the order later for other reasons.

---

## Troubleshooting

**"Cannot find module '../controllers/feedbackController'"**
→ Check the path. Make sure `feedbackController.js` is in `src/controllers/` not `src/` directly.

**Complaint/feedback buttons not showing on orders**
→ Make sure `npm run dev` on the backend is running and the order status is exactly `'delivered'` (lowercase, no spaces).

**"relation feedback does not exist"**
→ Migration 007 didn't run. Run it now: `node src/config/run-single-migration.js 007_add_feedback_complaints.sql`

**"column delivered_at does not exist"**
→ Migration 008 didn't run. Run: `node src/config/run-single-migration.js 008_add_delivered_at_to_orders.sql`

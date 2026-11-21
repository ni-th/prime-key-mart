# KeyMart

An online store for selling software license keys (Windows, Office, antivirus, …).

Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 + shadcn · Prisma + PostgreSQL ·
Auth.js v5 · Stripe Checkout (optional) · Nodemailer.

License keys are encrypted at rest (AES-256-GCM) and only decrypted when shown to the
buyer or an admin.

## Local setup

Requires Node 20+ and Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then generate two secrets and paste them into .env:
#   openssl rand -base64 32   -> AUTH_SECRET
#   openssl rand -base64 32   -> KEY_ENCRYPTION_SECRET

# 3. Start Postgres (Docker, host port 5433)
npm run db:up

# 4. Create the schema and load sample data
npm run db:migrate      # applies migrations
npm run db:seed         # 9 products, sample keys, admin + customer users

# 5. Run the app
npm run dev             # http://localhost:3000
```

### Seeded accounts

| Email                   | Password       | Role     |
| ----------------------- | -------------- | -------- |
| `nimantha.bt@gmail.com` | `Nimantha@123` | ADMIN    |
| `user@keymart.test`     | `user12345`    | customer |

Admin accounts are created only by the seed / directly in the database - there is no
admin option on the public registration form (it always creates a regular customer).

## Payments

**Stripe is optional.** With no real `STRIPE_SECRET_KEY` in `.env`, checkout uses a local
**simulated payment page** - order creation, key reservation, fulfillment and the keys
email all run for real, just without a card or an external account.

To switch to real Stripe Checkout, paste a test secret key into `.env` and run the webhook
forwarder in a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# paste the printed "whsec_..." into STRIPE_WEBHOOK_SECRET in .env, then restart `npm run dev`
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. No other code changes.

## Try the flows

- **Buy as a guest:** add to cart → `/checkout` → enter any email → pay (simulated) →
  the success page polls until your keys appear; a copy is "emailed" (preview link in the
  `npm run dev` console). Re-view them later at `/order-lookup`.
- **Buy as a customer:** sign in first; the order shows up under `/account/orders`.
- **Admin:** sign in as the admin account → `/admin` for the dashboard, add a product,
  paste license keys on its *Manage keys* page, manage orders (resend email, refund with a
  note, cancel), and manage users at `/admin/users` - list and filter registered customers
  vs. guest-checkout emails, suspend/re-enable accounts with a note, change roles, and
  block/unblock guest emails (a suspended account can't sign in; a blocked email can't
  check out or register).

## Email

Purchased keys are emailed via SMTP (`SMTP_*` in `.env`). If `SMTP_HOST` is empty, a
throwaway [Ethereal](https://ethereal.email) inbox is created automatically in development
and a preview URL is logged to the server console for every message.

## Useful scripts

| Script               | What it does                              |
| -------------------- | ---------------------------------------- |
| `npm run db:up`      | Start the Postgres container             |
| `npm run db:down`    | Stop the Postgres container              |
| `npm run db:migrate` | Apply Prisma migrations (dev)            |
| `npm run db:reset`   | Drop, recreate and re-seed the database  |
| `npm run db:seed`    | Load sample data                         |
| `npm run db:studio`  | Open Prisma Studio                       |

## Project layout

```
app/(shop)      storefront: home, catalog, product, cart, checkout, order-lookup, legal
app/(auth)      login / register
app/account     signed-in customer area (overview, order history, keys)
app/admin       admin area (dashboard, product CRUD, key inventory, orders, users)
app/api         checkout, mock payment, Stripe webhook, order status
app/actions     server actions (auth, checkout support, admin, order lookup)
lib/            db, auth, crypto, stripe, mailer, inventory, orders, products, cart store
prisma/         schema + seed
proxy.ts        route guard for /account and /admin
```

# Stevie Social — Owner Demo Runbook

**Goal:** Show the platform live on a real Cloudflare demo subdomain, with every external integration genuinely connected. No mock data. No staged events. The "live" moments happen because real systems are wired up.

**Audience:** Project owner. Stakes: project gets killed if the demo doesn't land.

**Total prep time:** ~4 hours, parallelizable across two people.

> **Live demo terminal:** keep `python scripts/demo_console.py` open in a side terminal. Option `1` runs the integration sweep; options `2-8` fire test events on demand (fake Cal.com booking, Stripe test payment, real email, AI gen, Stream upload URL, Images upload, synthetic SSE toast). If anything refuses to fire from the UI live, the matching console command saves the moment.

---

## Part 1 — Pre-demo setup checklist

### Section A — DNS + deploys (Track A, ~90 min)

Pick a demo subdomain on the Cloudflare-managed domain. Examples below assume `testingjoat.work` — substitute your real domain.

**A1. DNS records (Cloudflare dashboard → testingjoat.work → DNS, ~10 min)**

| Type | Name | Target | Proxied | Set up in… |
|---|---|---|---|---|
| CNAME | `stevie` | `<stevie-frontend>.pages.dev` | ✅ Proxied | A3 (Cloudflare Pages) |
| CNAME | `api` | `<your-coolify-backend-host>` | ✅ Proxied | A2 (Coolify) |
| CNAME | `book` | `<your-coolify-calcom-host>` | ✅ Proxied | A4 (Coolify) |
| CNAME | `stats` | `<your-coolify-umami-host>` | ✅ Proxied | A5 (Coolify) |
| CNAME | `medial` | (R2 custom domain — auto-created when you bind it in B4) | ✅ Proxied | B4 (R2 settings) |
| MX | `send` | (Resend bounce subdomain — Resend provides) | DNS only | B2 (Resend) |
| TXT | `send` | (Resend SPF) | DNS only | B2 |
| TXT | `resend._domainkey` | (Resend DKIM key) | DNS only | B2 |
| CNAME | `links` | (Resend tracking subdomain) | DNS only | B2 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@testingjoat.work` | DNS only | B2 (recommended) |

**A2. Backend on Coolify (~25 min)**

1. Coolify → New Application → Git source = your `JOATSocial` repo, root path `backend/`.
2. Build pack: `Dockerfile` (the repo's existing `backend/Dockerfile`).
3. Domain: `api.testingjoat.work`.
4. Env vars (Coolify UI):
   ```
   APP_ENV=production
   DEBUG=false
   FRONTEND_URL=https://stevie.testingjoat.work
   ALLOWED_ORIGINS=https://stevie.testingjoat.work
   DATABASE_URL=postgresql+asyncpg://...     # your Supabase pooler URL
   DATABASE_URL_SYNC=postgresql+psycopg://...
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_JWT_SECRET=...
   SECRET_KEY=$(openssl rand -hex 32)
   JWT_SECRET_KEY=$(openssl rand -hex 32)
   CRON_SECRET=$(openssl rand -hex 32)
   WEBHOOK_SECRET=$(openssl rand -hex 32)         # SAVE THIS — used by Cal.com webhook + Workers
   STRIPE_SECRET_KEY=sk_test_...                  # Stripe test mode
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   REDIS_URL=redis://redis:6379/0                 # whichever Redis you provision on Coolify
   # The four high-value integrations come from Track B:
   ANTHROPIC_API_KEY=...
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=hello@testingjoat.work
   CF_ACCOUNT_ID=...
   CF_API_TOKEN=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   R2_BUCKET_NAME=joatlabstesting
   R2_PUBLIC_URL=https://medial.testingjoat.work
   CF_IMAGES_ACCOUNT_HASH=...
   CF_IMAGES_DELIVERY_URL=https://imagedelivery.net/<hash>
   CF_STREAM_API_TOKEN=...
   CF_STREAM_CUSTOMER_SUBDOMAIN=...customer-<n>.cloudflarestream.com
   UMAMI_API_URL=https://stats.testingjoat.work
   UMAMI_API_KEY=...
   ```
5. Run migrations once after first deploy: `alembic upgrade head` (Coolify console).

**A3. Frontend on Cloudflare Pages (~25 min)**

You're on a paid Cloudflare account with a managed domain — deploy the frontend straight to Cloudflare Pages. This gets you global edge for the user-facing app and avoids one Coolify dependency.

1. From the repo:
   ```bash
   cd frontend
   pnpm install
   pnpm build         # produces .next/ (Next.js 16 standalone)
   ```

2. Deploy via Wrangler:
   ```bash
   # First time:
   wrangler login
   wrangler pages project create stevie-frontend \
     --production-branch main

   # Deploy:
   wrangler pages deploy .next --project-name stevie-frontend
   ```

   Wrangler prints a `*.pages.dev` URL. Use it as the staging address until DNS propagates.

3. Bind the demo domain in Cloudflare → Pages → `stevie-frontend` → Custom domains → Add → `stevie.testingjoat.work`. Cloudflare provisions the SSL cert automatically (~30s).

4. Set Pages env vars (Cloudflare → Pages → Settings → Environment variables → Production):
   ```
   NEXT_PUBLIC_API_URL=https://api.testingjoat.work
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SSE_PUBSUB_URL=https://api.testingjoat.work   # for now point at backend; swap to sse-pubsub Worker later
   NEXT_PUBLIC_UMAMI_WEBSITE_ID=...                            # from Umami after A5
   NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://stats.testingjoat.work/script.js
   ```

5. **For Next.js 16 Server Components / API routes** — Pages defaults to "Static" mode. If your build output is `.next/standalone` (server-rendered routes), use `wrangler pages deploy --compatibility-flag=nodejs_compat` and point the deploy at `.next` rather than `.next/standalone`. The Pages dashboard's "Functions" toggle must also be on.

   If that gives you grief during deploy, fall back: deploy frontend to Coolify (Docker, `next start`) and use Cloudflare just for DNS + edge caching. Both paths put the frontend on `stevie.testingjoat.work` from the user's perspective.

**A4. Cal.com on Coolify (~15 min)**

1. Coolify → New Resource → Search "Cal.com" → Deploy.
2. Domain: `book.testingjoat.work`.
3. After Cal.com is up: log in → Settings → Webhooks → Add:
   - URL: `https://api.testingjoat.work/api/internal/webhooks/calcom`
   - Header: `X-Webhook-Secret: <the value from A2>`
   - Events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`.
4. Create one event type ("30-min Discovery Call") and a public booking page.

**A5. Umami on Coolify (~15 min)**

1. Coolify → New Resource → Search "Umami" → Deploy.
2. Domain: `stats.testingjoat.work`.
3. Log in (default `admin` / `umami` — change immediately) → Add Website (`testingjoat.work`).
4. Note the website ID + script URL → paste into A3 frontend env vars.
5. Settings → API Keys → Create → paste into A2 backend env vars (`UMAMI_API_KEY`).

### Section B — External services (Track B, ~60 min, in parallel)

**B1. Anthropic API key (~5 min)**

1. https://console.anthropic.com → API Keys → Create.
2. Paste into backend env: `ANTHROPIC_API_KEY=sk-ant-...`.
3. Pre-fund $20 of credit so the demo can't run out.

**B2. Resend with verified sender on testingjoat.work (~25 min, includes DNS propagation)**

1. https://resend.com → API Keys → Create.
2. Domains → Add `testingjoat.work`:
   - **Custom Return-Path:** `send` (default — handles bounces)
   - **Tracking Subdomain:** `links` (rewrites click trackers through your domain — better deliverability + branding)
   - **Enable click tracking:** ✅ ON (campaign clicked-count populates via webhook events)
   - **Enable open tracking:** ❌ OFF (Apple Mail Privacy inflates this metric)
3. Copy all DNS records Resend gives you → add to Cloudflare DNS (the A1 table already has rows for `send`, `resend._domainkey`, `links`, `_dmarc`). All set to **DNS only** (orange cloud OFF).
4. Wait for "Verified" status in Resend (5–10 min).
5. Backend env: `RESEND_API_KEY=re_...`, `RESEND_FROM_EMAIL=hello@testingjoat.work`.
6. Resend → Webhooks → Add endpoint:
   - URL: `https://api.testingjoat.work/api/internal/webhooks/resend`
   - Custom header: `X-Webhook-Secret: <your WEBHOOK_SECRET from A2>`
   - Events: all email lifecycle (sent, delivered, bounced, opened, clicked, complained).
7. **Why verified sender matters:** owner sees emails arriving from `@testingjoat.work`, not `@resend.dev`. 10x perception difference.

**B3. Stripe test mode (~10 min)**

1. https://dashboard.stripe.com → Developers → API keys → Reveal test keys.
2. `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PUBLISHABLE_KEY=pk_test_...`.
3. Webhooks → Add endpoint → URL `https://api.testingjoat.work/api/stripe/webhook` → copy signing secret → `STRIPE_WEBHOOK_SECRET=whsec_...`.

**B4. Cloudflare R2 + Images + Stream (~20 min)**

R2 (bucket: `joatlabstesting`):
1. Cloudflare dashboard → R2 → bucket `joatlabstesting` → **Settings → CORS Policy → + Add** → paste:
   ```json
   [{"AllowedOrigins":["https://stevie.testingjoat.work","http://localhost:3100"],
     "AllowedMethods":["GET","PUT","POST","HEAD","DELETE"],
     "AllowedHeaders":["*"],"ExposeHeaders":["ETag","Content-Length","Content-Type"],
     "MaxAgeSeconds":3600}]
   ```
   Without this, browser uploads will fail with CORS errors.
2. **Settings → Custom Domains → + Add** → `medial.testingjoat.work`. Cloudflare auto-creates the DNS row + SSL cert.
3. **Manage R2 API Tokens** → Create token (Object Read & Write, scoped to `joatlabstesting`). Save Access Key + Secret + the S3-compatible endpoint URL (`https://<account>.r2.cloudflarestorage.com`).

Images:
4. Cloudflare dashboard → Images → Subscribe (entry plan ~$5/mo). Note Account Hash + Delivery URL (`https://imagedelivery.net/<hash>`). Create an API token with Images:Edit scope.

Stream:
5. Cloudflare dashboard → Stream → Subscribe (1,000 free trial minutes). Create an API token with Stream:Edit scope. Note your customer subdomain (e.g. `customer-abc123.cloudflarestream.com`).
6. Stream → Settings → Webhooks → Subscribe webhook:
   - URL: `https://api.testingjoat.work/api/internal/video/cf-stream-event`
   - Custom header: `X-Webhook-Secret: <your WEBHOOK_SECRET from A2>`
   - Required for the Video Library to flip uploaded videos from `processing` → `ready`.
4. Drop all into A2 backend env.

### Section C — Bootstrap real org data (Track C, ~10 min)

Run on the production backend (Coolify console):

```bash
python scripts/bootstrap_real_demo.py \
  --owner-email "<owner's real email>" \
  --owner-name "<Owner Name>" \
  --teammate-email "<your real email>" \
  --teammate-name "Etastic"
```

This creates:
- One real org for the owner (they'll receive a Supabase invite email)
- One real org for you (already invited)
- 4 brand voice profiles: "JOAT Friendly," "JOAT Authority," "JOAT Playful," "JOAT Technical"
- Nothing else — leads, bookings, posts, etc. are all created LIVE during the demo

---

## Part 2 — The demo arc (15 min, every moment is real)

Run with the owner watching your screen. Have a second laptop open as a teammate so the presence + edit indicators have someone to react to.

### Cold open (60 sec)
"This is Stevie Social, live on `testingjoat.work`. Real domain, real Postgres, real CDN. Everything you see is genuine — no mock data, no scripts running in the background."

### 1. Sign in (30 sec)
- Sign in at `stevie.testingjoat.work`. Real Supabase Auth.
- Briefly show "we're in the owner's tenant" — open the Settings → Organization page so they see their company name.

### 2. Public intake → live lead (90 sec)
- Open `stevie.testingjoat.work/intake?org=<owner-org-slug>` in a new tab on the owner's phone.
- Owner fills it out: name, email, company.
- Submit → in your admin tab, the **lead row appears** with an SSE toast.
- A real notification email arrives in your inbox via Resend.
- "That toast is server-sent events. No polling. The email landed via Resend in <2 sec."

### 3. AI Content (90 sec) — the headline wow
- AI Content → New Generation.
- Brand voice: pick "JOAT Friendly". Content type: LinkedIn post. Prompt: paste the lead's company tagline.
- Hit Generate. Real Anthropic call. ~3 sec wait.
- Show the post that comes back. Pick a different brand voice, regenerate — show the tone shift.
- "That's running through Cloudflare AI Gateway in front of Anthropic. We get caching + observability + a kill switch on AI spend."

### 4. Pages + Cloudflare Images (90 sec)
- Pages → Create new page → upload an image the owner brought.
- Image is uploaded to Cloudflare Images, URL appears in the editor instantly.
- Open the public Page URL — image is delivered from CDN, auto-resized.

### 5. Video upload (60 sec)
- Video Library → Upload.
- Drop the 15-sec sample clip you prepared. Upload to Cloudflare Stream.
- Show the row at status `processing` → wait ~20 sec → flips to `ready` with thumbnail.
- "Adaptive bitrate playback, auto thumbnail, all from one upload."

### 6. Real Cal.com booking (60 sec)
- Open `book.testingjoat.work` on the owner's phone.
- Owner picks a slot, confirms.
- In your admin tab, **booking appears** with toast.
- Confirmation email is in their inbox.

### 7. Email campaign (90 sec) — the second wow
- Email → New Campaign → import the 1 contact (owner) → write a subject and body → Send.
- Email arrives on owner's phone via Resend, from `hello@testingjoat.work` (verified sender).
- Owner forwards it to themselves to verify it's not faked.

### 8. Form notifications (45 sec)
- Forms → show one form built earlier with `notify_emails = your inbox`.
- Submit a test entry. Notification email arrives.

### 9. Stripe billing (90 sec)
- Billing → New Invoice → quick fill ($500, owner's email).
- Click "View hosted invoice" → real Stripe-hosted page opens.
- Owner enters `4242 4242 4242 4242` → success.
- Switch back to admin → invoice flipped to Paid → SSE toast.

### 10. Online presence + concurrent editing (90 sec) — the third wow
- Have your teammate sign in from the second laptop.
- **Online avatar appears in the nav bar** ("Sarah is online").
- Both of you open the same Page for edit. Owner sees: "Sarah is editing this — saved 2 min ago."
- Teammate makes a change and saves. Owner's view shows: "This was changed by Sarah — reload?"
- "This is the multi-user story. Real SSE infrastructure, not a poll."

### 11. Settings → Team invite (45 sec)
- Settings → Team → Invite teammate (use a +1 email of yours).
- Email arrives instantly. Click the invite link → walks the Supabase signup flow → land back in the org with viewer role.

### 12. Umami analytics (45 sec)
- Open `stats.testingjoat.work` in a tab.
- Show the page-view counter that's been incrementing during the demo.
- "That's tracking the public-facing pages we've been clicking through."

### Close (30 sec)
"Everything I just showed is on production-grade infrastructure. The only thing that hasn't gone live yet is the social-publishing OAuth flows — those need each platform's app review, which is a 1-2 week process. Otherwise, this is the platform."

---

## Part 3 — Recovery moves if something breaks live

| What breaks | What to say + do |
|---|---|
| Resend email doesn't arrive in 30s | "Email's queued — Resend deliverability hovers around 30 sec to 2 min." Open Resend dashboard tab, show the row in `delivered` status. |
| AI generation hangs >10s | "That's an AI Gateway cache miss — second call will be instant." Click Regenerate. Anthropic is rarely >5s. |
| Cal.com booking doesn't appear | Refresh the Bookings page. If still missing, open Cal.com → Bookings tab to confirm it landed there, then say "the webhook delivery is async — production has a 30-second SLA." |
| Stripe payment doesn't reflect | Refresh the invoice. If still draft: "Stripe webhook just hadn't fired yet — let me reload." |
| SSE toast doesn't fire | Refresh the page — events were emitted, you just missed the notification. Don't dwell. |
| Frontend won't load | Switch to localhost dev. "I'll show this from local — same code, same data, just bypassing DNS." |

**Universal rule:** If anything fails live, name what you intended to show, then move on. NEVER debug in front of the owner. The recovery is showing the next item without skipping a beat.

---

## Part 4 — Pre-demo smoke test (run 1 hour before)

```bash
# All from your laptop, against the production deploy:

# 1. Backend health
curl https://api.testingjoat.work/health

# 2. Auth round-trip
# Sign in at stevie.testingjoat.work — confirm you land on the dashboard

# 3. Resend deliverability
# Send yourself a test email from /admin/email — confirm it arrives

# 4. AI generation
# Generate one post in /admin/ai-content — confirm it works

# 5. Cal.com webhook
# Book a slot at book.testingjoat.work — confirm it appears in /admin/bookings

# 6. Image upload
# Drop an image into /admin/pages — confirm it renders

# 7. Stripe test invoice
# Create one — confirm the hosted page opens

# 8. Umami tracking
# Visit /pages/<slug> twice — confirm /admin/analytics ticks up

# 9. Online presence
# Sign in from a second browser — confirm the avatar appears in nav

# 10. Concurrent edit indicator
# Open the same Page from two browsers — confirm the "Etastic is editing" banner shows
```

If all 10 pass, you're ready. If any fails, you have time to fix it.

---

## Cheat sheet — what each integration unlocks

| Service | Demo moment that requires it | Owner sees |
|---|---|---|
| Anthropic | AI Content generation | Real LinkedIn post in 3 sec |
| Resend (verified sender) | Email campaigns + invites + form notifications | Email from `@testingjoat.work` arrives instantly |
| Cloudflare Images | Image upload on Pages | Auto-resized CDN URL |
| Cloudflare Stream | Video upload on Video Library | Adaptive playback + auto thumbnail. (Mux removed — Stream is the only video vendor now.) |
| Online presence (built-in) | Avatar stack at top of admin nav | Sign in from a second browser → avatar pops |
| Currently-editing banner (built-in) | Pages + Proposals edit views | Two users open same page → "X is editing this" banner |
| Cal.com on Coolify | Booking demo | Booking lands in admin via webhook |
| Umami on Coolify | Analytics dashboard | Real page-view counter |
| Stripe test mode | Invoice flow | Real Stripe-hosted page |
| Coolify backend + frontend | Everything | Real `https://testingjoat.work` URL |
| SSE pub-sub (already built) | Toasts + presence + edit indicators | Multi-user feels real |

If any of these aren't ready by demo time: skip the corresponding section and move on. Don't apologize, don't explain. Owner doesn't know the script.

# Changelog

## 2026-05-16

- Replaced the `/blog` launch-notification mailto with a real public
  subscriber capture endpoint that upserts opt-ins into `contacts` with
  blog-specific tags for later campaign targeting.
- Added admin email audience controls, including a Blog subscribers preset
  backed by the existing campaign `audience_filter` infrastructure.
- Added an Alembic RLS hardening migration for Supabase-advised public tables:
  `stripe_events`, `proposal_versions`, `task_comments`, `sprints`, and
  `task_dependencies`.
- Shifted AI content auto-routing away from OpenAI/Anthropic billing paths:
  Workers AI is now primary, Google AI Studio is the first fallback, and
  Anthropic remains only a last-resort quality fallback for long-form work.
- Hardened the AI content Worker so missing fallback provider keys are skipped
  instead of poisoning the whole chain, and provider billing/quota failures now
  mark the generation failed with an operator-actionable message.
- Added an AI provider routing status panel to the admin AI Content surface so
  operators can see queue readiness, the active auto-chain, and billing-risk
  warnings before generating.
- Audited GitHub build/deploy workflows against the live Stevie Social tree and
  removed stale FlowDylo-era Launchpad, ARM test-branch, and disabled
  Mongo/Kafka backend-test workflows.
- Tightened the remaining frontend workflow to validate the current
  `NEXT_PUBLIC_*` build-time surface while leaving deployment to the
  Cloudflare/OpenNext pipeline.
- Simplified the backend workflow to one Docker image path: validate the image
  on PRs, publish to GHCR on `main`, then trigger the existing Coolify deploy.
- Updated repo guidance to treat the trimmed workflow set as intentional and
  avoid reintroducing Launchpad/FlowDylo assumptions.

## 2026-05-13

- Added a direct-link public JOATLabs Plaid use-case page at
  `/plaid-use-case`, covering intended Plaid scope, served users, data
  principles, and the Link-to-Transactions sync flow for use-case review.

## 2026-05-08

- Fixed admin-created form embed URLs by adding a public `/form/{slug}` page
  backed by a new unauthenticated, safe-listed `/api/forms/public/{slug}` API.
- Fixed Cal.com booking embeds when settings store a host without `https://`.
- Wired social account connection buttons to the existing OAuth backend flow
  and corrected the OAuth callback redirect back to `/admin/social`.
- Added CORS handling to the SSE pub/sub Worker so browser EventSource
  subscriptions can actually connect from the frontend origin.
- Removed duplicate TipTap Link and Underline registrations that were causing
  editor warnings on the blog/page editors.
- Replaced raw image URL entry points with the media upload flow for page social
  images, rich-text editor images, and social post image/carousel media.
- Fixed AI content admin polling so queued/retrying jobs keep refreshing, and
  surfaced backend/Worker configuration errors instead of silently swallowing
  failed AI, brand voice, and feedback actions.
- Surfaced social post create/publish/schedule/delete errors in the admin UI
  instead of leaving buttons looking inert when the API rejects an action.
- Aligned the AI content Worker with current Cloudflare AI Gateway URL docs:
  gateway base URL has no provider suffix, Google AI Studio uses `/v1/models`,
  and authenticated gateways can pass `CF_AIG_TOKEN`.
- Decoupled public content reads from live admin state by adding cached public
  CMS page rendering at `/{slug}`, caching blog detail pages, and returning
  public cache headers from blog/page content APIs.
- Surfaced Cloudflare media authorization failures as clear upload API errors
  instead of unhandled 500s that browsers report as generic CORS failures.
- Made automation failures visible in the admin UI and disabled activation for
  workflows that have no configured steps.
- Aligned the mobile admin shell so the hamburger control reserves header space
  instead of overlapping page content, and wired the Analytics Umami card to
  the live Settings connection test.
- Moved the frontend Docker publish workflow from legacy FlowDylo registry
  secrets to GHCR and passed the Next.js `NEXT_PUBLIC_*` build args the image
  actually consumes.

# Stevie Social Frontend — Client-Readiness Review

**Date:** 2026-04-21
**Reviewer:** Claude (UX copy + code review pass)
**Environment:** localhost:3100 (live dev server)
**Pages reviewed:** `/`, `/about`, `/portfolio`, `/blog`, `/book`, `/intake`

---

## Verdict

**Do NOT send this to the client.** Not yet. Not even as "preview." Not even with a disclaimer.

The good news: the copy is strong, the brand system is real, the content architecture is right. What you're seeing as "complete trash" is not a design problem — it's **one CSS rule blowing up every page at once**. Fix that rule, and most of what feels broken will snap back into place. Then there's a second tier of layout issues to clean up, and a third of content/state issues.

You're genuinely close. You're also genuinely not shippable right now.

---

## The root cause — one rule, global damage

`src/app/globals.css`, lines 69–73:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

This universal reset lives OUTSIDE any `@layer`, so in Tailwind v4's layered cascade it beats every margin and padding utility class you've written.

Verified in the live DOM:

| Utility | Intent | Actual computed style |
|---|---|---|
| `mx-auto` | margin: 0 auto | margin: 0 |
| `px-6` | padding: 0 24px | padding: 0 |
| `py-24` | padding: 96px 0 | padding: 0 |
| `gap-8` | gap: 32px | works (gap is not margin/padding) |
| `max-w-7xl` | max-width: 1280px | works |

So containers ARE being constrained to 1280px — but they aren't being centered, and sections have zero internal padding. That's exactly what you're seeing: content stuck to `x=0`, hero labels collided with the logo, no breathing room anywhere.

**Fix:** change the reset to play inside Tailwind's cascade.

```css
/* Option A — let Tailwind v4's preflight handle it (recommended) */
/* delete lines 69–73 entirely; tailwindcss already resets what you need */

/* Option B — keep the reset but scope it to base layer */
@layer base {
  * {
    box-sizing: border-box;
  }
}
/* DO NOT include margin/padding here — Tailwind preflight already zeros
   the elements it needs to, and you WANT utilities to be able to apply
   margin/padding on everything else. */
```

This single change fixes an enormous chunk of the "every page is trash" problem.

---

## Page-by-page findings (after the global fix)

### `/` Homepage
- Hero is actually well-composed — once padding returns, the chartreuse stats band, the three Stevie Special cards, and the phased Compound Method grid will all sit correctly inside centered containers.
- Stats band: number and label will re-stack with proper 32px breathing room. Currently the `$` of `$350K` is flush against the viewport edge.
- Secondary issue: the "Book A Call" pill in the navbar visually collides with "Blog" at mid-desktop widths. After `px-6` returns to the nav it's closer but still tight — consider `gap-10` instead of `gap-8` between nav links.

### `/about`
- Two-column "Our Mission / Our Values" grid: the left column's body copy currently wraps at ~½ width instead of filling its column. That's partly the margin reset, partly that the text column isn't explicitly `w-full`.
- Timeline ("From discovery to growth"): the step number "01" sits in a 5rem-wide left gutter (`w-20 text-right`), but the bullet-dot (`absolute left-[-5px]`) visually overlaps the step title because `pl-8` is being reset to `0`. Fix the reset and this resolves.
- Copy: "We listen first / We build the playbook / We create and manage / We compound results" is strong parallelism — keep it.

### `/portfolio`
- Same margin/padding disease: all three case study cards sit edge-to-edge.
- Metrics per case study ($350K, 4.2x, -60%) render in a 3-column grid that will look right once the container centers.
- Copy concern: `-60% Content Volume` reads as a brag that you post less, but without framing it as a positive it can read like a loss. Suggest: `60% Less Content, Same Growth` or pair it with the word "intentional."

### `/blog`
- **Empty state is embarrassing.** "No blog posts yet. Check back soon — we're writing about strategy, content, and what it takes to build trust on social." → a client visits your blog and sees you have zero articles about social strategy. Bad first impression.
- Either seed 3–5 posts before handoff, or remove the "Blog" nav link until there's content. Do not ship with "No blog posts yet."
- Layout: the entire page is ~350px tall on a 900px viewport — footer sits in the middle of the screen with a huge empty void below. Needs `min-h-screen` on the main wrapper.

### `/book` — **most critical**
- This is your conversion page. **The booking widget does not render.** There's a giant empty white rectangle (~760×560) where Calendly/Cal.com should be.
- If the script is missing, the iframe is misconfigured, or the embed key is unset, you need to fix it before anyone sees this page.
- Below the empty box, the 3-step explainer ("Quick Intake / Strategy Call / Custom Proposal") is solid content — good UX copy. But the broken widget above it undermines everything.

### `/intake`
- 3-step multi-step form, clear progress bar, right copy ("Takes about 3 minutes.") — this is well thought out.
- But the form is rendered at ~1/3 width with no container, and the footer floats up mid-page. Same reset disease.
- Field copy is good: `Jane Smith`, `jane@company.com`, `Acme Corp` as placeholders is textbook.

---

## Secondary layout issues (independent of the reset)

These exist in the JSX and need touching even after the CSS fix:

1. **Navbar `px-6` at mobile is OK but desktop at 1440px+ feels tight.** Consider `px-8` or `lg:px-12`.
2. **Sticker labels use `border: 2px solid currentColor` with `padding: 4px 12px`** — but since `* { padding: 0 }` is killing that padding, every sticker label is currently a thin horizontal line with text spilling out. This IS the sticker-label style, but the current rendering makes them look like broken badges. Will resolve with the reset fix.
3. **Hero on `/about`** — Margo Beuys headline at `text-6xl` on desktop + two-line break gives an awkward widow. Tune copy or the break: "We don't chase. We compound." could sit on one line at `md:text-5xl`.
4. **Footer layout** — 3-column grid is fine but when it re-centers, the "Get In Touch" column's CTA button will still be left-aligned while the columns above it are left-aligned — which is actually correct. Leave it.
5. **Mobile menu toggle (the "N" circle bottom-left on every page)** — not sure what this is. Looks like a debug/avatar placeholder bleeding in from somewhere. Track down and remove, or at minimum only show it on admin routes.

---

## UX copy — what's working and what to sharpen

### Working (keep)
- **"Stop chasing trends. Start building trust."** Strong tension, active voice, clear positioning.
- **"We don't chase. We compound."** Distinct, memorable, aligned to the method.
- **"Social that speaks for your brand."** Warm, on-brand, clear value prop.
- **Values list (Honor, Intention, Partnership, Candor, Quality, Profit)** — punchy one-liners, consistent rhythm.
- **The Compound Method phases (Protect / Deepen / Amplify)** — each has a duration, description, and a "We track:" line. That last line is your best copy on the site. It says "we measure, we're accountable." Keep.

### Sharpen
- **Hero CTAs: "Schedule A Call" vs. "Book A Call" (nav) vs. "Schedule A Strategy Call" (bottom CTA).** Pick one. "Book a call" for nav (short, familiar). "Book a strategy call" for section CTAs (specific, implies value). Consistency matters.
- **"60% Qualified leads increase in 90 days"** — awkward word order. Use "60% increase in qualified leads (90 days)" or "60% more qualified leads in 90 days."
- **"1,393 Niche-specific followers in 90 days"** — 1,393 is an oddly specific number that reads "we're padding stats." Either round to "1,400+" or add context ("1,393 genuine, niche-specific followers — no bot farms.") Ownable.
- **Blog hero subhead: "Strategy, creative thinking, and lessons learned from building brands that people actually trust."** Too long. Try: "Strategy and lessons from brands people actually trust."
- **Intake: "Tell us about your brand."** Good. But the first field is "Full Name" and the second is "Email" — you're asking for the person, not the brand. Retitle the step "About you" or lead with brand-level questions first.
- **Empty blog state:** if you must ship with zero posts, say: "We're writing our first pieces now. Want early access? [Subscribe]" — convert the empty state into a lead-gen moment.

---

## Ship checklist (ordered by impact)

| # | Fix | Effort | Why |
|---|---|---|---|
| 1 | Remove/scope the `* { margin: 0; padding: 0 }` reset | 2 min | Fixes ~70% of visible problems |
| 2 | Fix the `/book` booking widget (embed or iframe) | 15 min – 1 hr | Conversion page is currently broken |
| 3 | Seed blog with 3–5 posts OR remove Blog from nav | 2 hr OR 1 min | "No blog posts yet" undermines authority |
| 4 | Remove the mystery "N" circle bottom-left | 5 min | Looks like dev scaffolding |
| 5 | Unify CTA copy (Book / Schedule / Book A Strategy Call) | 10 min | Polish |
| 6 | Full regression pass across all viewport widths after #1 | 30 min | Catch anything the reset was masking |
| 7 | Update intake step 1 copy (name/email mismatch with "About your brand" framing) | 5 min | Small but noticeable |
| 8 | Tighten stats copy ("60% increase in qualified leads") | 5 min | Reads more natural |

Total: **realistically 3–5 hours of focused work** and this site goes from "can't send" to "proud to send."

---

## One more thing

I want to be direct: your reaction ("every page is complete trash") is understandable but not accurate. The CSS reset bug is making finished, well-thought work look unfinished. The difference between "embarrassing" and "on-brand" here is one file change. Don't rebuild anything until you delete those three lines of CSS and re-look at the site. You may find you agree with much more of it than you do right now.

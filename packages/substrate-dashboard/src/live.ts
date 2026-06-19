/**
 * Live dashboard surface.
 *
 * Fetches GET /api/dashboard (the backend aggregator's two-domain snapshot)
 * and renders TWO clearly separated panels:
 *
 *   1. ArrowHedgeLab — agent/validation metrics (authority gate, stale blocks,
 *      state disagreements, per-ticker signal/decision/risk, per-tenant runs).
 *   2. Substrate — substrate internals (event-stream volume, event-type mix,
 *      hash-chain integrity, tenant inventory).
 *
 * When the backend reports live:false (substrate down), shows an offline banner;
 * the caller keeps the bundled fixture explorer available as a fallback view.
 */

export type Tone = "good" | "warn" | "bad" | "neutral";

export interface TickerRow {
  symbol: string;
  signal: string | null;
  confidence: number | null;
  decision: { action: string; quantity: number; accepted: boolean } | null;
  price: number | null;
  maxShares: number | null;
  authority: string | null;
  authorityGate: { passes: number; failures: number };
  staleBlocks: number;
  stateDisagreements: number;
  observedAt: string | null;
}

export interface FunnelStageIds {
  proposed: string[];
  accepted: string[];
  blocked: string[];
}

export interface TenantFunnel {
  proposed: number;
  accepted: number;
  blocked: number;
  held: number;
  reconciles: boolean;
  overlapExcess: number;
  eventIds: FunnelStageIds;
}

export interface TenantSnapshot {
  id: string;
  displayName: string;
  createdAt: string | null;
  legacy: boolean;
  archived: boolean;
  funnel: TenantFunnel;
  reachable: boolean;
  arrowhedge: {
    validEventCount: number;
    authorityGatePassRate: number | null;
    stateDisagreementRate: number | null;
    gatePasses: number;
    gateFailures: number;
    staleBlocks: number;
    stateDisagreements: number;
    tickers: TickerRow[];
  };
  substrate: {
    eventCount: number;
    eventTypeCounts: Record<string, number>;
    chainValid: boolean | null;
    chainChecked: number;
    brokenEventIds: string[];
  };
}

export interface LiveSnapshot {
  generatedAt: string;
  source: string;
  live: boolean;
  substrateBase: string;
  copProjection?: string;
  error?: string;
  tenants: TenantSnapshot[];
  funnel: {
    proposed: number;
    accepted: number;
    blocked: number;
    held: number;
    reconciles: boolean;
    activeTenantCount: number;
    legacyTenantCount: number;
    breaches: { id: string; legacy: boolean; archived: boolean; overlapExcess: number }[];
    acceptRate: number | null;
    blockRate: number | null;
    reconcileTone: Tone;
  };
  arrowhedge: {
    tenantCount: number;
    validEventCount: number;
    gatePasses: number;
    gateFailures: number;
    gatePassRate: number | null;
    staleBlocks: number;
    stateDisagreements: number;
    gatePassRateTone: Tone;
    staleBlockTone: Tone;
    disagreementTone: Tone;
  };
  substrate: {
    tenantCount: number;
    eventCount: number;
    chainChecked: number;
    chainValid: boolean | null;
    chainTone: Tone;
    eventTypeCounts: { key: string; count: number }[];
  };
}

export async function fetchSnapshot(): Promise<LiveSnapshot | null> {
  try {
    const res = await fetch("/api/dashboard", { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as LiveSnapshot;
  } catch {
    return null;
  }
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function fmtTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function metricCard(label: string, value: string, detail: string, tone: Tone): string {
  return `
    <div class="live-card tone-border-${tone}">
      <span class="live-card-label">${esc(label)}</span>
      <strong class="live-card-value tone-${tone}">${esc(value)}</strong>
      <span class="live-card-detail">${esc(detail)}</span>
    </div>`;
}

function bar(count: number, max: number, tone: Tone): string {
  const width = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return `<span class="live-bar tone-bg-${tone}" style="width:${width}%"></span>`;
}

export function renderLive(root: HTMLElement, snap: LiveSnapshot | null): void {
  if (!snap) {
    root.innerHTML = `
      <div class="live-shell">
        <div class="live-banner bad">Backend unreachable — could not load <code>/api/dashboard</code>. Falling back to bundled fixtures (use the rail to switch views).</div>
      </div>`;
    return;
  }

  const ah = snap.arrowhedge;
  const sub = snap.substrate;

  const banner = snap.live
    ? `<div class="live-banner good">LIVE — substrate <code>${esc(snap.substrateBase)}</code> · ${snap.tenants.length} tenant runs · generated ${esc(fmtTime(snap.generatedAt))}</div>`
    : `<div class="live-banner warn">OFFLINE — ${esc(snap.error ?? "substrate unreachable")}. Showing last known / empty. Fixture explorer remains available in the rail.</div>`;

  const typeMax = Math.max(1, ...sub.eventTypeCounts.map((t) => t.count));

  root.innerHTML = `
    <div class="live-shell">
      ${banner}

      <!-- ============ HEADLINE: connected decision funnel ============ -->
      ${renderFunnel(snap)}

      <!-- ============ DOMAIN 1: ArrowHedgeLab (agents / validation) ============ -->
      <section class="live-domain domain-arrowhedge">
        <header class="live-domain-head">
          <h1>ArrowHedgeLab — Agent &amp; Validation Metrics</h1>
          <span>Authority-gated decisions, stale-state protection, per-ticker COP across ${ah.tenantCount} run(s)</span>
        </header>
        <div class="live-card-grid">
          ${metricCard("Authority gate pass rate", pct(ah.gatePassRate), `${ah.gatePasses} passed / ${ah.gateFailures} failed`, ah.gatePassRateTone)}
          ${metricCard("Stale blocks", String(ah.staleBlocks), "stale-state actions blocked by substrate", ah.staleBlockTone)}
          ${metricCard("State disagreements", String(ah.stateDisagreements), "agent vs authoritative state conflicts", ah.disagreementTone)}
          ${metricCard("Valid events", String(ah.validEventCount), "finance-research events admitted", "neutral")}
          ${metricCard("Agent runs", String(ah.tenantCount), "isolated tenant experiments", "neutral")}
        </div>

        <div class="live-table-wrap">
          <h2>Per-Ticker Common Operating Picture</h2>
          <table class="live-table">
            <thead><tr>
              <th>Run</th><th>Ticker</th><th>Signal</th><th>Conf</th>
              <th>Decision</th><th>Qty</th><th>Price</th><th>Gate</th>
              <th>Stale</th><th>Disagree</th><th>Authority</th><th>Observed</th>
            </tr></thead>
            <tbody>
              ${snap.tenants
                .flatMap((t) =>
                  t.arrowhedge.tickers.map((tk) => {
                    const gateTone: Tone = tk.authorityGate.failures > 0 ? "bad" : "good";
                    const decTone: Tone = tk.decision?.accepted ? "good" : "warn";
                    return `<tr>
                      <td class="mono">${esc(shortTenant(t.id))}</td>
                      <td><strong>${esc(tk.symbol)}</strong></td>
                      <td><span class="pill tone-${signalTone(tk.signal)}">${esc(tk.signal ?? "—")}</span></td>
                      <td>${tk.confidence === null ? "—" : tk.confidence.toFixed(2)}</td>
                      <td><span class="pill tone-${decTone}">${esc(tk.decision?.action ?? "—")}</span></td>
                      <td>${tk.decision?.quantity ?? "—"}</td>
                      <td>${tk.price === null ? "—" : "$" + tk.price.toFixed(2)}</td>
                      <td class="tone-${gateTone}">${tk.authorityGate.passes}/${tk.authorityGate.passes + tk.authorityGate.failures}</td>
                      <td class="${tk.staleBlocks > 0 ? "tone-warn" : ""}">${tk.staleBlocks}</td>
                      <td class="${tk.stateDisagreements > 0 ? "tone-bad" : ""}">${tk.stateDisagreements}</td>
                      <td class="mono small">${esc(tk.authority ?? "—")}</td>
                      <td class="mono small">${esc(fmtTime(tk.observedAt))}</td>
                    </tr>`;
                  }),
                )
                .join("") || `<tr><td colspan="12" class="empty">No ticker COP data.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ DOMAIN 2: Substrate (internals) ============ -->
      <section class="live-domain domain-substrate">
        <header class="live-domain-head">
          <h1>Substrate — Internal Metrics</h1>
          <span>Event-sourced graph internals: stream volume, event-type mix, hash-chain integrity</span>
        </header>
        <div class="live-card-grid">
          ${metricCard("Hash-chain integrity", sub.chainValid === null ? "n/a" : sub.chainValid ? "VALID" : "BROKEN", `${sub.chainChecked} events verified`, sub.chainTone)}
          ${metricCard("Total events", String(sub.eventCount), `across ${sub.tenantCount} tenant(s)`, "neutral")}
          ${metricCard("Event types", String(sub.eventTypeCounts.length), "distinct typed event kinds", "neutral")}
          ${metricCard("Tenants", String(sub.tenantCount), "active substrate tenants", "neutral")}
        </div>

        <div class="live-split">
          <div class="live-table-wrap">
            <h2>Event-Type Distribution</h2>
            <div class="live-dist">
              ${sub.eventTypeCounts
                .map(
                  (t) => `
                <div class="live-dist-row">
                  <span class="live-dist-label mono">${esc(t.key)}</span>
                  <span class="live-dist-track">${bar(t.count, typeMax, distTone(t.key))}</span>
                  <span class="live-dist-count">${t.count}</span>
                </div>`,
                )
                .join("") || `<div class="empty">No events.</div>`}
            </div>
          </div>

          <div class="live-table-wrap">
            <h2>Tenant Inventory</h2>
            <table class="live-table">
              <thead><tr><th>Tenant</th><th>Events</th><th>Chain</th><th>Valid evts (AH)</th><th>Created</th></tr></thead>
              <tbody>
                ${snap.tenants
                  .map(
                    (t) => `<tr>
                      <td class="mono">${esc(shortTenant(t.id))}</td>
                      <td>${t.substrate.eventCount}</td>
                      <td class="tone-${t.substrate.chainValid === false ? "bad" : "good"}">${t.substrate.chainValid === null ? "—" : t.substrate.chainValid ? "ok" : "broken"}</td>
                      <td>${t.arrowhedge.validEventCount}</td>
                      <td class="mono small">${esc(fmtTime(t.createdAt))}</td>
                    </tr>`,
                  )
                  .join("") || `<tr><td colspan="5" class="empty">No tenants.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>`;
}

/**
 * Connected decision funnel: proposed splits into accepted + blocked + held.
 * Every number is backed by event IDs in the per-tenant snapshot, so the funnel
 * is query-traceable. Reconciliation (proposed === accepted+blocked+held) is
 * asserted visually; legacy/pre-fix tenants with accepted+blocked overlap are
 * segregated into their own band and excluded from the headline counts.
 */
function renderFunnel(snap: LiveSnapshot): string {
  const fn = snap.funnel;
  const max = Math.max(1, fn.proposed);
  const w = (n: number): number => Math.max(2, Math.round((n / max) * 100));
  const legacyRows = snap.tenants.filter((t) => t.legacy || t.archived);

  const reconcileBadge = fn.reconciles
    ? `<span class="pill tone-good">RECONCILES — ${fn.proposed} = ${fn.accepted} + ${fn.blocked} + ${fn.held}</span>`
    : `<span class="pill tone-bad">DOES NOT RECONCILE — ${fn.breaches.length} breach(es)</span>`;

  const legacyBand =
    legacyRows.length === 0
      ? ""
      : `
      <div class="funnel-legacy">
        <h3>Retired / pre-enforcement tenants (excluded from funnel)</h3>
        <p class="funnel-note">These tenants were seeded before the stale-state gate was enforced; their stored events carry an accepted+blocked overlap (the proposal was both accepted and blocked). Archived &amp; tagged <code>legacy</code> — kept for audit, excluded from headline numbers.</p>
        <table class="live-table">
          <thead><tr><th>Tenant</th><th>Proposed</th><th>Accepted</th><th>Blocked</th><th>Overlap excess</th><th>State</th></tr></thead>
          <tbody>
            ${legacyRows
              .map(
                (t) => `<tr>
                  <td class="mono">${esc(shortTenant(t.id))}</td>
                  <td>${t.funnel.proposed}</td>
                  <td>${t.funnel.accepted}</td>
                  <td>${t.funnel.blocked}</td>
                  <td class="tone-bad">+${t.funnel.overlapExcess}</td>
                  <td><span class="pill tone-warn">${t.archived ? "archived" : "legacy"}</span></td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

  return `
    <section class="live-domain domain-funnel">
      <header class="live-domain-head">
        <h1>Decision Funnel — Proposed → Accepted / Blocked / Held</h1>
        <span>Connected pipeline across ${fn.activeTenantCount} active run(s). ${reconcileBadge}</span>
      </header>
      <div class="funnel">
        <div class="funnel-stage">
          <div class="funnel-bar-row">
            <span class="funnel-label">Proposed</span>
            <span class="funnel-track"><span class="funnel-bar tone-bg-neutral" style="width:${w(fn.proposed)}%"></span></span>
            <span class="funnel-count">${fn.proposed}</span>
          </div>
        </div>
        <div class="funnel-split">
          <div class="funnel-bar-row">
            <span class="funnel-label">Accepted</span>
            <span class="funnel-track"><span class="funnel-bar tone-bg-good" style="width:${w(fn.accepted)}%"></span></span>
            <span class="funnel-count tone-good">${fn.accepted} <small>(${pct(fn.acceptRate)})</small></span>
          </div>
          <div class="funnel-bar-row">
            <span class="funnel-label">Blocked</span>
            <span class="funnel-track"><span class="funnel-bar tone-bg-bad" style="width:${w(fn.blocked)}%"></span></span>
            <span class="funnel-count tone-bad">${fn.blocked} <small>(${pct(fn.blockRate)})</small></span>
          </div>
          <div class="funnel-bar-row">
            <span class="funnel-label">Held</span>
            <span class="funnel-track"><span class="funnel-bar tone-bg-warn" style="width:${w(fn.held)}%"></span></span>
            <span class="funnel-count tone-warn">${fn.held}</span>
          </div>
        </div>
      </div>
      ${legacyBand}
    </section>`;
}

function shortTenant(id: string): string {
  return id.replace(/^tnt_/, "").replace(/_\d{9,}$/, (m) => "·" + m.slice(-4));
}
function signalTone(signal: string | null): Tone {
  if (signal === "buy") return "good";
  if (signal === "sell") return "bad";
  if (signal === "hold") return "neutral";
  return "neutral";
}
function distTone(type: string): Tone {
  if (type.includes("blocked") || type.includes("stale")) return "warn";
  if (type.includes("decision")) return "good";
  return "neutral";
}

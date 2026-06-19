/**
 * ArrowHedgeLab + Substrate live dashboard aggregator.
 *
 * Polls the running substrate HTTP server (default :4100) across all tenants and
 * builds a single typed snapshot with TWO clearly separated metric domains:
 *
 *   1. arrowhedge — agent/validation metrics (COP): authority gate, stale blocks,
 *      state disagreements, per-ticker signals/decisions/risk-state.
 *   2. substrate  — substrate internals: tenants, event-stream volume + type mix,
 *      hash-chain integrity, event taxonomy.
 *
 * Dependency-free (Node >= 18 global fetch). Designed to be imported by the
 * static server (server.mjs) which exposes GET /api/dashboard + /api/health.
 */

const SUBSTRATE_BASE =
  process.env.SUBSTRATE_BASE_URL ?? "http://127.0.0.1:4100";
const COP_PROJECTION = process.env.ARROWHEDGE_COP_PROJECTION ?? "arrowhedge_cop_live";
const FETCH_TIMEOUT_MS = Number(process.env.AGGREGATOR_TIMEOUT_MS ?? "8000");

async function jget(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUBSTRATE_BASE}${path}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    return { ok: true, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function tone(value, { good, warn }) {
  if (value >= good) return "good";
  if (value >= warn) return "warn";
  return "bad";
}

/**
 * Reduce one tenant's COP + events into normalized domain rows.
 */
async function buildTenant(tenant) {
  const id = tenant.id;
  const [copRes, eventsRes, chainRes] = await Promise.all([
    jget(`/tenants/${id}/arrowhedge/cop`),
    jget(`/tenants/${id}/events`),
    jget(`/tenants/${id}/events/verify-chain`),
  ]);

  const cop = copRes.ok ? copRes.body?.cop ?? null : null;
  const events = eventsRes.ok ? eventsRes.body?.events ?? [] : [];
  const chain = chainRes.ok ? chainRes.body?.report ?? null : null;

  // --- arrowhedge (validation) domain ---
  const tickers = cop?.tickers ?? {};
  const tickerRows = Object.values(tickers).map((t) => ({
    symbol: t.symbol,
    signal: t.latestSignal?.signal ?? null,
    confidence: t.latestSignal?.confidence ?? null,
    decision: t.latestDecision
      ? { action: t.latestDecision.action, quantity: t.latestDecision.quantity, accepted: t.latestDecision.accepted }
      : null,
    price: t.latestRiskState?.currentPrice ?? null,
    maxShares: t.latestRiskState?.maxShares ?? null,
    authority: t.latestDecision?.authority ?? t.latestSignal?.authority ?? null,
    authorityGate: t.authorityGate ?? { passes: 0, failures: 0 },
    staleBlocks: t.staleBlocks ?? 0,
    stateDisagreements: t.stateDisagreements ?? 0,
    observedAt: t.latestDecision?.observedAt ?? t.latestSignal?.observedAt ?? null,
  }));

  const gatePasses = tickerRows.reduce((s, t) => s + t.authorityGate.passes, 0);
  const gateFailures = tickerRows.reduce((s, t) => s + t.authorityGate.failures, 0);
  const staleBlocks = tickerRows.reduce((s, t) => s + t.staleBlocks, 0);
  const disagreements = tickerRows.reduce((s, t) => s + t.stateDisagreements, 0);

  // --- substrate domain ---
  const eventTypeCounts = {};
  for (const e of events) {
    eventTypeCounts[e.type] = (eventTypeCounts[e.type] ?? 0) + 1;
  }

  // --- decision funnel (connected, query-traceable) ---
  // Every stage count carries the exact event IDs that back it, so each number
  // on the dashboard funnel can be traced to source events. The funnel MUST
  // reconcile: held = proposed - accepted - blocked, and held >= 0. A negative
  // held value means a proposal was BOTH accepted and blocked (the pre-fix
  // advisory-gate overlap) and is surfaced as a reconciliation breach.
  const idsOfType = (type) => events.filter((e) => e.type === type).map((e) => e.id);
  const proposedIds = idsOfType("portfolio.decision.proposed");
  const acceptedIds = idsOfType("portfolio.decision.accepted");
  const blockedIds = idsOfType("workflow.blocked.stale_state");
  const proposed = proposedIds.length;
  const accepted = acceptedIds.length;
  const blocked = blockedIds.length;
  const held = proposed - accepted - blocked;
  const reconciles = held >= 0;
  const funnel = {
    proposed,
    accepted,
    blocked,
    held: Math.max(held, 0),
    reconciles,
    overlapExcess: reconciles ? 0 : -held,
    eventIds: {
      proposed: proposedIds,
      accepted: acceptedIds,
      blocked: blockedIds,
    },
  };
  const legacy = tenant.metadata?.legacy === true;

  return {
    id,
    displayName: tenant.displayName ?? id,
    createdAt: tenant.createdAt ?? null,
    legacy,
    archived: tenant.archivedAt != null,
    funnel,
    reachable: copRes.ok || eventsRes.ok,
    arrowhedge: {
      validEventCount: cop?.summary?.validEventCount ?? 0,
      authorityGatePassRate: cop?.summary?.authorityGatePassRate ?? null,
      stateDisagreementRate: cop?.summary?.stateDisagreementRate ?? null,
      gatePasses,
      gateFailures,
      staleBlocks,
      stateDisagreements: disagreements,
      tickers: tickerRows,
    },
    substrate: {
      eventCount: events.length,
      eventTypeCounts,
      chainValid: chain?.valid ?? null,
      chainChecked: chain?.checked ?? 0,
      brokenEventIds: chain?.brokenEventIds ?? [],
    },
  };
}

export async function buildSnapshot() {
  const generatedAt = new Date().toISOString();
  const health = await jget("/healthz");
  if (!health.ok) {
    return {
      generatedAt,
      source: "live",
      live: false,
      substrateBase: SUBSTRATE_BASE,
      error: `substrate unreachable: ${health.error ?? health.status}`,
      tenants: [],
      arrowhedge: emptyArrowhedge(),
      substrate: emptySubstrate(),
    };
  }

  // Include archived tenants so the dashboard can render retired/legacy ones
  // in a separate, visually-distinct band rather than dropping them silently.
  const tenantsRes = await jget("/tenants?includeArchived=true");
  const tenantList = tenantsRes.ok ? tenantsRes.body?.tenants ?? [] : [];
  const tenants = await Promise.all(tenantList.map(buildTenant));
  const activeTenants = tenants.filter((t) => !t.archived && !t.legacy);

  // --- domain rollups ---
  const ahValidEvents = activeTenants.reduce((s, t) => s + t.arrowhedge.validEventCount, 0);
  const gatePasses = activeTenants.reduce((s, t) => s + t.arrowhedge.gatePasses, 0);
  const gateFailures = activeTenants.reduce((s, t) => s + t.arrowhedge.gateFailures, 0);
  const staleBlocks = activeTenants.reduce((s, t) => s + t.arrowhedge.staleBlocks, 0);
  const disagreements = activeTenants.reduce((s, t) => s + t.arrowhedge.stateDisagreements, 0);
  const gateTotal = gatePasses + gateFailures;
  const gatePassRate = gateTotal > 0 ? gatePasses / gateTotal : null;

  // --- decision funnel rollup (ACTIVE tenants only; legacy/archived excluded
  // so the headline funnel reconciles). Each stage sums per-tenant stage counts;
  // the breach list names any tenant whose funnel does not reconcile. ---
  const funnelProposed = activeTenants.reduce((s, t) => s + t.funnel.proposed, 0);
  const funnelAccepted = activeTenants.reduce((s, t) => s + t.funnel.accepted, 0);
  const funnelBlocked = activeTenants.reduce((s, t) => s + t.funnel.blocked, 0);
  const funnelHeld = activeTenants.reduce((s, t) => s + t.funnel.held, 0);
  const funnelBreaches = tenants
    .filter((t) => !t.funnel.reconciles)
    .map((t) => ({ id: t.id, legacy: t.legacy, archived: t.archived, overlapExcess: t.funnel.overlapExcess }));
  const funnelReconciles =
    funnelProposed === funnelAccepted + funnelBlocked + funnelHeld;

  const subEvents = tenants.reduce((s, t) => s + t.substrate.eventCount, 0);
  const subChecked = tenants.reduce((s, t) => s + t.substrate.chainChecked, 0);
  const allChainValid = tenants.every(
    (t) => t.substrate.chainValid === true || t.substrate.eventCount === 0,
  );
  const globalTypeCounts = {};
  for (const t of tenants) {
    for (const [type, n] of Object.entries(t.substrate.eventTypeCounts)) {
      globalTypeCounts[type] = (globalTypeCounts[type] ?? 0) + n;
    }
  }

  return {
    generatedAt,
    source: "live",
    live: true,
    substrateBase: SUBSTRATE_BASE,
    copProjection: COP_PROJECTION,
    tenants,
    funnel: {
      // Connected pipeline: proposed splits into accepted + blocked + held.
      proposed: funnelProposed,
      accepted: funnelAccepted,
      blocked: funnelBlocked,
      held: funnelHeld,
      reconciles: funnelReconciles,
      activeTenantCount: activeTenants.length,
      legacyTenantCount: tenants.length - activeTenants.length,
      breaches: funnelBreaches,
      acceptRate: funnelProposed > 0 ? funnelAccepted / funnelProposed : null,
      blockRate: funnelProposed > 0 ? funnelBlocked / funnelProposed : null,
      reconcileTone: funnelReconciles ? "good" : "bad",
    },
    arrowhedge: {
      tenantCount: activeTenants.length,
      validEventCount: ahValidEvents,
      gatePasses,
      gateFailures,
      gatePassRate,
      staleBlocks,
      stateDisagreements: disagreements,
      gatePassRateTone:
        gatePassRate === null ? "neutral" : tone(gatePassRate, { good: 0.99, warn: 0.6 }),
      staleBlockTone: staleBlocks > 0 ? "warn" : "good",
      disagreementTone: disagreements > 0 ? "bad" : "good",
    },
    substrate: {
      tenantCount: tenants.length,
      eventCount: subEvents,
      chainChecked: subChecked,
      chainValid: allChainValid,
      chainTone: allChainValid ? "good" : "bad",
      eventTypeCounts: Object.entries(globalTypeCounts)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    },
  };
}

function emptyArrowhedge() {
  return {
    tenantCount: 0, validEventCount: 0, gatePasses: 0, gateFailures: 0,
    gatePassRate: null, staleBlocks: 0, stateDisagreements: 0,
    gatePassRateTone: "neutral", staleBlockTone: "neutral", disagreementTone: "neutral",
  };
}
function emptySubstrate() {
  return {
    tenantCount: 0, eventCount: 0, chainChecked: 0, chainValid: null,
    chainTone: "neutral", eventTypeCounts: [],
  };
}

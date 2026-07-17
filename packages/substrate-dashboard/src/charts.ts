/**
 * Minimal dependency-free SVG charts for the dashboard — real plotted marks
 * with a shared hover tooltip, not CSS-div bars. Each draw fn takes an
 * in-DOM <svg> and renders into it; call after the page HTML is mounted.
 * Colour is a two-status scheme (teal = substrate/clean, red = damage, slate
 * = neutral control) validated CVD-safe; every mark also carries a value
 * label, so identity is never colour-alone.
 */

const NS = "http://www.w3.org/2000/svg";
const cssVar = (n: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduce = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export type Tone = "neutral" | "good" | "bad" | "slate";
const toneColor = (t: Tone): string =>
  t === "good" ? cssVar("--teal") : t === "bad" ? cssVar("--red") : t === "slate" ? cssVar("--slate") : cssVar("--line-strong");

const svgEl = (name: string, attrs: Record<string, string | number>): SVGElement => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

// ---- shared tooltip ----
let tipEl: HTMLDivElement | null = null;
function tooltip(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "chart-tip";
    tipEl.setAttribute("role", "status");
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
function moveTip(html: string, x: number, y: number): void {
  const t = tooltip();
  t.innerHTML = html;
  t.classList.add("on");
  const r = t.getBoundingClientRect();
  let px = x + 14;
  let py = y + 14;
  if (px + r.width > window.innerWidth - 8) px = x - r.width - 14;
  if (py + r.height > window.innerHeight - 8) py = y - r.height - 14;
  t.style.left = `${px}px`;
  t.style.top = `${py}px`;
}
function hideTip(): void {
  tooltip().classList.remove("on");
}
export function bindTip(el: Element, html: string): void {
  el.addEventListener("mouseenter", (e) => moveTip(html, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
  el.addEventListener("mousemove", (e) => moveTip(html, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
  el.addEventListener("mouseleave", hideTip);
}

function gridLines(
  svg: SVGElement,
  padL: number,
  padT: number,
  plotH: number,
  plotW: number,
  max: number,
  ticks: number,
  fmt: (v: number) => string,
): void {
  const g = svgEl("g", { class: "chart-grid" });
  for (let i = 0; i <= ticks; i++) {
    const yv = (max / ticks) * i;
    const y = padT + plotH - (yv / max) * plotH;
    g.appendChild(svgEl("line", { x1: padL, y1: y, x2: padL + plotW, y2: y }));
    const t = svgEl("text", { x: padL - 6, y: y + 3, "text-anchor": "end", "font-size": 10 });
    t.textContent = fmt(yv);
    g.appendChild(t);
  }
  svg.appendChild(g);
}

export interface BarRow {
  readonly label: string;
  readonly v: number;
  readonly tone: Tone;
  readonly tip: string;
}

/** Vertical bars, one series. viewBox 420×200. */
export function drawVerticalBars(
  svg: SVGElement,
  rows: readonly BarRow[],
  opts: { max: number; ticks: number; fmt: (v: number) => string; emphasize?: string },
): void {
  svg.innerHTML = "";
  const W = 420;
  const H = 200;
  const padL = 34;
  const padT = 14;
  const padB = 34;
  const padR = 10;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;
  gridLines(svg, padL, padT, plotH, plotW, opts.max, opts.ticks, opts.fmt);
  const gap = plotW / rows.length;
  const bw = Math.min(64, gap * 0.5);
  rows.forEach((r) => {
    const i = rows.indexOf(r);
    const cx = padL + gap * i + gap / 2;
    const h = (r.v / opts.max) * plotH;
    const y = padT + plotH - h;
    const bar = svgEl("rect", {
      class: "chart-bar",
      x: cx - bw / 2,
      y: reduce() ? y : padT + plotH,
      width: bw,
      height: reduce() ? h : 0,
      rx: 4,
      fill: toneColor(r.tone),
    });
    svg.appendChild(bar);
    if (!reduce())
      requestAnimationFrame(() => {
        bar.setAttribute("y", String(y));
        bar.setAttribute("height", String(h));
      });
    bindTip(bar, r.tip);
    const vl = svgEl("text", { class: "chart-val", x: cx, y: y - 7, "text-anchor": "middle" });
    vl.textContent = opts.fmt(r.v);
    svg.appendChild(vl);
    const lab = svgEl("text", {
      class: "chart-axis",
      x: cx,
      y: H - 12,
      "text-anchor": "middle",
      "font-size": 11,
      ...(r.label === opts.emphasize ? { fill: cssVar("--teal") } : {}),
    });
    lab.textContent = r.label;
    svg.appendChild(lab);
  });
}

export interface GroupedRow {
  readonly label: string;
  readonly a: number;
  readonly b: number;
  readonly tipA: string;
  readonly tipB: string;
}

/** Two-series grouped vertical bars (a = slate, b = teal). viewBox 720×260. */
export function drawGroupedBars(
  svg: SVGElement,
  rows: readonly GroupedRow[],
  opts: { max: number; ticks: number },
): void {
  svg.innerHTML = "";
  const W = 720;
  const H = 260;
  const padL = 40;
  const padT = 14;
  const padB = 96;
  const padR = 12;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;
  gridLines(svg, padL, padT, plotH, plotW, opts.max, opts.ticks, (v) => String(Math.round(v)));
  const gap = plotW / rows.length;
  const bw = Math.min(22, gap * 0.3);
  rows.forEach((r, i) => {
    const cx = padL + gap * i + gap / 2;
    ([
      ["a", -1, cssVar("--slate"), r.a, r.tipA],
      ["b", 1, cssVar("--teal"), r.b, r.tipB],
    ] as const).forEach(([, side, fill, v, tip]) => {
      const h = (v / opts.max) * plotH;
      const y = padT + plotH - h;
      const x = cx + side * (bw / 2 + 1) - bw / 2;
      const bar = svgEl("rect", {
        class: "chart-bar",
        x,
        y: reduce() ? y : padT + plotH,
        width: bw,
        height: reduce() ? h : 0,
        rx: 3,
        fill,
      });
      svg.appendChild(bar);
      if (!reduce())
        requestAnimationFrame(() => {
          bar.setAttribute("y", String(y));
          bar.setAttribute("height", String(h));
        });
      bindTip(bar, tip);
    });
    const lab = svgEl("text", {
      class: "chart-axis",
      x: cx,
      y: H - padB + 16,
      "text-anchor": "end",
      "font-size": 10.5,
      transform: `rotate(-32 ${cx} ${H - padB + 16})`,
    });
    lab.textContent = r.label.replace(/-/g, " ");
    svg.appendChild(lab);
  });
}

/** Horizontal bars with a name + subtext per row. viewBox 640×(rows·46+pad). */
export function drawHorizontalBars(
  svg: SVGElement,
  rows: readonly { name: string; sub: string; v: number; tone: Tone; tip: string }[],
  opts: { max: number },
): void {
  svg.innerHTML = "";
  const W = 640;
  const padL = 150;
  const padR = 60;
  const padT = 14;
  const rowH = 46;
  const H = padT + rows.length * rowH + 6;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const plotW = W - padL - padR;
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const name = svgEl("text", { x: padL - 12, y: y + 26, "text-anchor": "end", "font-size": 13, fill: cssVar("--ink") });
    name.textContent = r.name;
    svg.appendChild(name);
    const sub = svgEl("text", { x: padL - 12, y: y + 41, "text-anchor": "end", "font-size": 10.5, fill: cssVar("--muted") });
    sub.textContent = r.sub;
    svg.appendChild(sub);
    svg.appendChild(svgEl("rect", { x: padL, y: y + 8, width: plotW, height: 26, rx: 6, fill: cssVar("--hair-2") }));
    const w = Math.max((r.v / opts.max) * plotW, r.v === 0 ? 0 : 4);
    const bar = svgEl("rect", { class: "chart-bar", x: padL, y: y + 8, width: reduce() ? w : 0, height: 26, rx: 6, fill: toneColor(r.tone) });
    svg.appendChild(bar);
    if (!reduce()) requestAnimationFrame(() => bar.setAttribute("width", String(w)));
    bindTip(r.v === 0 ? name : bar, r.tip);
    const vl = svgEl("text", { x: padL + w + 12, y: y + 28, "font-size": 20, fill: toneColor(r.tone), class: "chart-hval" });
    vl.textContent = String(r.v);
    svg.appendChild(vl);
  });
}

"""Render a ClientReport to PDF via Jinja2 + WeasyPrint.

Flow:
    context = build_report_context(report, org)
    pdf_bytes = render_report_pdf(context)

The context builder is split from the renderer so that a FastAPI
endpoint can return HTML preview (for in-app viewing) using the same
context dict that the PDF job uses — single source of truth for
presentation logic.

WeasyPrint is optional at import time. If it's not installed we raise a
clear error only when render_report_pdf is actually called — the rest
of the module still loads fine so the backend can boot without the
native PDF dependencies.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.report import PHASE_KPIS, ClientReport
from app.models.social_media import SocialPost

logger = logging.getLogger(__name__)

# Template directory resolves from backend/app/templates/reports
_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "reports"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


# ─── Formatters ────────────────────────────────────────────────

def _format_value(value: Any, unit: str) -> str:
    if value is None:
        return "—"
    match unit:
        case "percent":
            return f"{float(value):.1f}%"
        case "currency":
            # Value expected in cents
            return f"${(float(value) / 100):,.2f}"
        case "ratio":
            return f"{float(value):.2f}"
        case "multiplier":
            return f"{float(value):.2f}x"
        case "score":
            return f"{float(value):.1f}"
        case _:
            # count fallback — strip decimals
            try:
                return f"{int(value):,}"
            except (TypeError, ValueError):
                return str(value)


def _format_delta(
    current: float | int | None, previous: float | int | None, unit: str
) -> tuple[str | None, str]:
    """Return (delta_text, delta_class) where class is 'up' | 'down' | 'flat'."""
    if current is None or previous is None:
        return None, "flat"
    try:
        cur = float(current)
        prev = float(previous)
    except (TypeError, ValueError):
        return None, "flat"

    if prev == 0:
        # Can't compute % change — show absolute delta only
        diff = cur - prev
        if diff == 0:
            return "no change", "flat"
        arrow = "▲" if diff > 0 else "▼"
        return f"{arrow} {_format_value(abs(diff), unit)} from prior period", (
            "up" if diff > 0 else "down"
        )

    pct = (cur - prev) / prev * 100
    if abs(pct) < 0.1:
        return "no change", "flat"
    arrow = "▲" if pct > 0 else "▼"
    return f"{arrow} {abs(pct):.1f}% vs prior period", ("up" if pct > 0 else "down")


# ─── Context builder ───────────────────────────────────────────

def build_report_context(
    report: ClientReport,
    *,
    org_name: str = "Stevie Social",
    brand_color: str | None = None,
    top_posts: list[SocialPost] | None = None,
    previous_snapshot: dict | None = None,
) -> dict:
    """Convert a ClientReport row into the dict the Jinja template expects.

    If ``report.sections`` is non-empty we use it directly (trust the
    sections that were already composed). Otherwise we auto-build a
    KPI grid from the phase definition + ``metrics_snapshot``.
    """
    sections = list(report.sections or [])
    snapshot = report.metrics_snapshot or {}
    previous_snapshot = previous_snapshot or {}

    # Auto-build KPI grid if no sections present and we have a phase
    if not sections and report.compound_phase:
        phase_def = PHASE_KPIS.get(report.compound_phase)
        if phase_def:
            grid_metrics = []
            for metric in phase_def["metrics"]:
                key = metric["key"]
                unit = metric["unit"]
                current = snapshot.get(key)
                previous = previous_snapshot.get(key)
                delta_text, delta_class = _format_delta(current, previous, unit)
                grid_metrics.append({
                    "label": metric["label"],
                    "display_value": _format_value(current, unit),
                    "delta": delta_text,
                    "delta_text": delta_text or "",
                    "delta_class": delta_class,
                })
            sections.append({
                "type": "kpi_grid",
                "title": phase_def["title"],
                "description": phase_def["description"],
                "metrics": grid_metrics,
            })

    # Shape top posts for template
    top_post_rows = []
    for p in (top_posts or []):
        impressions = int(p.impressions or 0)
        eng_rate = p.engagement_rate or 0.0
        top_post_rows.append({
            "platform": p.platform,
            "caption_preview": (p.caption or "").strip().replace("\n", " ")[:110],
            "impressions": f"{impressions:,}",
            "engagement_rate_pct": f"{float(eng_rate):.2f}",
        })

    phase_label = "Client Report"
    if report.compound_phase:
        phase_label = f"{report.compound_phase.title()} Phase Report"

    return {
        "report": report,
        "org_name": org_name,
        "brand_color": brand_color,
        "phase_label": phase_label,
        "client_name": report.client_name or "",
        "period_start": report.period_start.isoformat() if report.period_start else "",
        "period_end": report.period_end.isoformat() if report.period_end else "",
        "sections": sections,
        "top_posts": top_post_rows,
        "generated_at": datetime.now(timezone.utc).strftime("%b %d, %Y"),
        "signature_line": None,
    }


# ─── PDF renderer ──────────────────────────────────────────────

def render_report_html(context: dict) -> str:
    """Render the HTML string — useful for in-app preview."""
    template = _env.get_template("client_report.html")
    return template.render(**context)


def render_report_pdf(context: dict) -> bytes:
    """Render the report to a PDF byte string.

    Raises RuntimeError if WeasyPrint isn't installed — this path is
    only exercised by the report-builder Worker call site, so we defer
    the import error until actual use.
    """
    try:
        from weasyprint import HTML  # noqa: WPS433
    except ImportError as e:
        raise RuntimeError(
            "WeasyPrint is not installed. Add 'weasyprint>=62.3' to "
            "requirements.txt and pip install it in the worker image."
        ) from e

    html = render_report_html(context)
    return HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf()

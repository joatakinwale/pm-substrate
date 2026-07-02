from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_agency_api_types_and_helpers_are_declared():
    source = (ROOT / "src/lib/api.ts").read_text()

    assert "export interface ClientEngagement" in source
    assert "export interface MarketingRun" in source
    assert "export interface AgencyArtifact" in source
    assert "export interface AgencyApprovalRequest" in source
    assert "export interface AgencyAccessRequest" in source
    assert "export interface IntegrationTask" in source
    assert "export async function listClientEngagements" in source
    assert "export async function createClientEngagement" in source
    assert "export async function createMarketingRun" in source
    assert "export async function createAgencyArtifact" in source
    assert "export async function createAgencyApproval" in source
    assert "export async function decideAgencyApproval" in source
    assert "export async function createAgencyAccessRequest" in source
    assert "export async function listIntegrationRunTasks" in source
    assert "/api/integration/v1/marketing-runs/" in source
    assert "/tasks" in source


def test_agency_command_center_route_exposes_operator_workflow():
    page = ROOT / "src/app/admin/agency/page.tsx"
    source = page.read_text()

    assert "Autonomous Agency" in source
    assert "New Client Engagement" in source
    assert "Strategy Run" in source
    assert "Evidence Artifacts" in source
    assert "Approvals" in source
    assert "Access Requests" in source
    assert "createClientEngagement" in source
    assert "createMarketingRun" in source
    assert "createAgencyArtifact" in source
    assert "createAgencyApproval" in source
    assert "decideAgencyApproval" in source
    assert "createAgencyAccessRequest" in source


def test_agency_command_center_route_exposes_autonomous_run_monitor():
    page = ROOT / "src/app/admin/agency/page.tsx"
    source = page.read_text()

    assert "Run Monitor" in source
    assert "Closed-loop Progress" in source
    assert "Governance Gates" in source
    assert "Agent Task Queue" in source
    assert "CLOSED_LOOP_STAGES" in source
    assert "next_action" in source
    assert "runTasks" in source
    assert "listIntegrationRunTasks" in source
    assert "approval_payload_hash" in source
    assert "latest_event_hash" in source
    assert "social_post_content_hashes" in source


def test_sidebar_links_to_agency_command_center():
    source = (ROOT / "src/components/admin/AdminSidebar.tsx").read_text()

    assert 'href: "/admin/agency"' in source
    assert 'label: "Agency"' in source


def test_admin_shell_auth_extras_are_guarded_for_local_operator_monitoring():
    client = (ROOT / "src/lib/supabase/client.ts").read_text()
    sidebar = (ROOT / "src/components/admin/AdminSidebar.tsx").read_text()
    presence = (ROOT / "src/lib/use-online-presence.ts").read_text()
    realtime = (ROOT / "src/lib/use-realtime.ts").read_text()
    api = (ROOT / "src/lib/api.ts").read_text()

    assert "export function hasSupabaseBrowserConfig" in client
    assert "hasSupabaseBrowserConfig()" in sidebar
    assert "hasSupabaseBrowserConfig()" in presence
    assert "hasSupabaseBrowserConfig()" in realtime
    assert "hasSupabaseBrowserConfig()" in api

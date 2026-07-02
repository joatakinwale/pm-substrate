from __future__ import annotations

import inspect


def test_agency_router_imports_with_expected_prefix():
    import app.api.agency as module

    assert module.router.prefix == "/agency"
    route_paths = {route.path for route in module.router.routes}
    assert "/agency/engagements" in route_paths
    assert "/agency/engagements/{engagement_id}" in route_paths
    assert "/agency/engagements/{engagement_id}/runs" in route_paths
    assert "/agency/engagements/{engagement_id}/artifacts" in route_paths
    assert "/agency/engagements/{engagement_id}/approvals" in route_paths
    assert "/agency/engagements/{engagement_id}/access-requests" in route_paths


def test_agency_router_uses_rls_and_current_user_dependencies():
    import app.api.agency as module

    src = inspect.getsource(module)

    assert "get_db_with_rls_dep" in src
    assert "get_current_user" in src
    assert 'uuid.UUID(current_user["org_id"])' in src


def test_main_registers_agency_router():
    import app.main as module

    src = inspect.getsource(module)

    assert "from app.api.agency import router as agency_router" in src
    assert 'app.include_router(agency_router, prefix="/api")' in src


def test_agency_router_exposes_approval_decision_endpoint():
    import app.api.agency as module

    src = inspect.getsource(module)

    assert '"/approvals/{approval_id}/decision"' in src
    assert "AgencyApprovalDecision" in src
    assert "decide_approval_request(" in src


def test_agency_router_exposes_nested_read_routes_for_monitoring():
    import app.api.agency as module

    route_methods = {
        (route.path, frozenset(route.methods or set()))
        for route in module.router.routes
    }

    assert ("/agency/engagements/{engagement_id}/runs", frozenset({"GET"})) in route_methods
    assert (
        "/agency/engagements/{engagement_id}/artifacts",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/agency/engagements/{engagement_id}/approvals",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/agency/engagements/{engagement_id}/access-requests",
        frozenset({"GET"}),
    ) in route_methods


def test_marketing_run_creation_kicks_off_autonomous_agency_work():
    import app.api.agency as module

    src = inspect.getsource(module.create_marketing_run)

    assert "start_marketing_run(" in src
    assert "kickoff_marketing_run(" in src
    assert src.index("start_marketing_run(") < src.index("kickoff_marketing_run(")

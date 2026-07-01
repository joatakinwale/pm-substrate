import inspect


def test_virtual_agency_router_imports_without_missing_get_org_id():
    import app.api.virtual_agency as module

    assert module.router.prefix == "/virtual-agency"


def test_virtual_agency_inbox_exposes_direct_orchestration_tasks():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.get_virtual_agency_inbox)

    assert "select(VirtualAgencyTask)" in src
    assert '\"type\": \"orchestration_task\"' in src
    assert "VirtualAgencyTask.approval_active == False" in src
    assert "VirtualAgencyTask.source_task_id.is_(None)" in src


def test_virtual_agency_approve_dispatches_direct_orchestration_tasks():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.approve_virtual_agency_item)

    assert 'if item_type == "orchestration_task":' in src
    assert "select(VirtualAgencyTask).where(" in src
    assert "VirtualAgencyTask.source_task_id.is_(None)" in src
    assert 'VirtualAgencyTask.status == "todo"' in src
    assert "approve_task(" in src
    assert "publish_agent_task(" in src
    assert "queue=\"stevie-virtual-agency\"" in src


def test_report_approval_creates_next_action_before_commit():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.approve_virtual_agency_item)
    report_branch = src[src.index('if item_type == "report":'):]

    generated_pos = report_branch.index('report.status = "generated"')
    next_action_pos = report_branch.index(
        "create_next_action_proposal_task_for_report_async("
    )
    commit_pos = report_branch.index("await db.commit()")

    assert generated_pos < next_action_pos < commit_pos


def test_internal_virtual_agency_dependency_waits_are_retryable():
    import app.api.internal.virtual_agency as module

    src = inspect.getsource(module.execute_task)

    assert "DependencyNotSatisfiedError" in src
    assert "status_code=425" in src
    assert src.index("except DependencyNotSatisfiedError") < src.index(
        "except VirtualAgencyInvariantError"
    )

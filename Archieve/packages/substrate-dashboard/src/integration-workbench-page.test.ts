import { describe, expect, it } from "vitest";
import {
  renderIntegrationWorkbenchHtml,
  type IntegrationWorkbenchState,
} from "./integration-workbench-page.js";

const baseState: IntegrationWorkbenchState = {
  appName: "orbit",
  approvedHash: null,
  pending: [],
  validation: null,
  draftText: "{}",
  preview: null,
};

describe("integration workbench renderer", () => {
  it("shows approved and pending mapping state", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      approvedHash: "abc123",
      pending: [
        {
          mappingHash: "def456",
          origin: "liquid_discovery",
          proposedBy: "liquid",
          proposedAt: "2026-07-08T00:00:00.000Z",
        },
      ],
      validation: { valid: true, issues: [] },
    });

    expect(html).toContain("Approved mapping");
    expect(html).toContain("abc123");
    expect(html).toContain("def456");
    expect(html).toContain("liquid_discovery");
    expect(html).toContain('data-action="approve"');
    expect(html).toContain('data-action="reject"');
  });

  it("renders validation issues for an invalid mapping", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      validation: {
        valid: false,
        issues: [{ path: "/entities", message: "expected at least one entity entry" }],
      },
    });

    expect(html).toContain("expected at least one entity entry");
    expect(html).toContain("/entities");
    expect(html).not.toContain("Mapping is valid.");
  });

  it("marks a valid mapping as valid", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      validation: { valid: true, issues: [] },
    });
    expect(html).toContain("Mapping is valid.");
  });

  it("shows the refusal verdict for a dry run against an unapproved mapping", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      preview: {
        dryRun: true,
        mappingApproved: false,
        created: 2,
        updated: 0,
        unchanged: 0,
        rejected: [],
      },
    });

    expect(html).toContain("REFUSED");
    expect(html).toContain("created 2");
  });

  it("shows the admitted verdict for a dry run against the approved mapping", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      approvedHash: "abc123",
      preview: {
        dryRun: true,
        mappingApproved: true,
        created: 0,
        updated: 1,
        unchanged: 3,
        rejected: [
          { sourceName: "Customer", externalId: "9", reason: "missing identity field" },
        ],
      },
    });

    expect(html).toContain("would be admitted");
    expect(html).toContain("rejected 1");
    expect(html).toContain("missing identity field");
  });

  it("escapes untrusted strings", () => {
    const html = renderIntegrationWorkbenchHtml({
      ...baseState,
      appName: `<script>alert("x")</script>`,
      pending: [
        {
          mappingHash: "<img src=x>",
          origin: "manual",
          proposedBy: "<b>",
          proposedAt: "2026-07-08T00:00:00.000Z",
        },
      ],
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
  });
});

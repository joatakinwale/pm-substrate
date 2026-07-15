import { describe, expect, it } from "vitest";

import { parseIntegrationEvidenceContext } from "./evidence-context.js";

const context = {
  appRevision: "orbit-crm@abc1234",
  substrateRevision: "pm-substrate@def5678",
  runManifestRef: "artifact:orbit-crm:run-manifest",
  boundaryConformanceRef: "artifact:orbit-crm:boundary-conformance",
} as const;

describe("integration evidence context", () => {
  it("accepts a complete, concrete run binding", () => {
    expect(parseIntegrationEvidenceContext(context)).toEqual(context);
  });

  it("rejects partial, placeholder, and non-object contexts", () => {
    expect(() =>
      parseIntegrationEvidenceContext({
        ...context,
        runManifestRef: "replace-with:run-manifest",
      }),
    ).toThrow(/runManifestRef/);
    expect(() =>
      parseIntegrationEvidenceContext({
        ...context,
        boundaryConformanceRef: "",
      }),
    ).toThrow(/boundaryConformanceRef/);
    expect(() =>
      parseIntegrationEvidenceContext({
        ...context,
        appRevision: " replace-with:app-revision",
      }),
    ).toThrow(/appRevision/);
    expect(() => parseIntegrationEvidenceContext(null)).toThrow(/object/);
  });
});

/**
 * Unit tests for the pure helpers ported from email_sender.py.
 *
 * These run without the Workers runtime — they're plain functions —
 * but vitest's worker pool config picks them up alongside index.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  addTrackingPixel,
  renderTemplate,
  rewriteLinks,
} from "./email_helpers.js";

describe("renderTemplate", () => {
  it("substitutes {{var}} and {{ var }} forms", () => {
    const out = renderTemplate(
      "<p>Hi {{first_name}}, welcome {{ full_name }}.</p>",
      { first_name: "Ada", full_name: "Ada Lovelace" }
    );
    expect(out).toBe("<p>Hi Ada, welcome Ada Lovelace.</p>");
  });

  it("leaves unknown variables in place", () => {
    const out = renderTemplate("<p>{{first_name}} {{missing}}</p>", {
      first_name: "Ada",
    });
    expect(out).toBe("<p>Ada {{missing}}</p>");
  });

  it("handles empty variable map", () => {
    const out = renderTemplate("<p>{{x}}</p>", {});
    expect(out).toBe("<p>{{x}}</p>");
  });
});

describe("addTrackingPixel", () => {
  const sendId = "11111111-2222-3333-4444-555555555555";
  const baseUrl = "https://app.example.com";

  it("inserts pixel immediately before </body>", () => {
    const html = "<html><body><p>hi</p></body></html>";
    const out = addTrackingPixel(html, sendId, baseUrl);
    expect(out).toContain(
      `<img src="https://app.example.com/api/tracking/open/${sendId}"`
    );
    // Pixel must be BEFORE </body>, not after.
    const pixelIdx = out.indexOf("/api/tracking/open/");
    const bodyCloseIdx = out.indexOf("</body>");
    expect(pixelIdx).toBeGreaterThan(-1);
    expect(pixelIdx).toBeLessThan(bodyCloseIdx);
  });

  it("appends pixel to end when no </body> present", () => {
    const html = "<p>fragment with no body tag</p>";
    const out = addTrackingPixel(html, sendId, baseUrl);
    expect(out.endsWith('alt="" />')).toBe(true);
  });

  it("matches </body> case-insensitively", () => {
    const html = "<HTML><BODY>x</BODY></HTML>";
    const out = addTrackingPixel(html, sendId, baseUrl);
    expect(out).toContain("/api/tracking/open/");
    expect(out.indexOf("/api/tracking/open/")).toBeLessThan(
      out.indexOf("</BODY>")
    );
  });
});

describe("rewriteLinks", () => {
  const sendId = "abc";
  const baseUrl = "https://app.example.com";

  it("rewrites a normal http link with proper urlencoding", () => {
    const html = '<a href="https://example.com/path?a=1&b=2">click</a>';
    const out = rewriteLinks(html, sendId, baseUrl);
    expect(out).toContain(
      'href="https://app.example.com/api/tracking/click/abc?url=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1%26b%3D2"'
    );
  });

  it("leaves mailto: links untouched", () => {
    const html = '<a href="mailto:foo@bar.com">mail</a>';
    const out = rewriteLinks(html, sendId, baseUrl);
    expect(out).toBe(html);
  });

  it("leaves tel: links untouched", () => {
    const html = '<a href="tel:+15551234567">call</a>';
    const out = rewriteLinks(html, sendId, baseUrl);
    expect(out).toBe(html);
  });

  it("leaves in-page anchors untouched", () => {
    const html = '<a href="#section">jump</a>';
    const out = rewriteLinks(html, sendId, baseUrl);
    expect(out).toBe(html);
  });

  it("rewrites multiple links in one pass", () => {
    const html =
      '<a href="https://a.com">a</a> and <a href="https://b.com">b</a>';
    const out = rewriteLinks(html, sendId, baseUrl);
    expect(out).toContain("url=https%3A%2F%2Fa.com");
    expect(out).toContain("url=https%3A%2F%2Fb.com");
  });
});

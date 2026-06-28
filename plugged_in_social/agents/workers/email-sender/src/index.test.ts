/**
 * Smoke tests for stevie-email-sender — message contract validation only.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit Resend or the backend; they only verify validateMessage
 * accepts/rejects the two body shapes this Worker consumes. Integration
 * coverage (real Resend Test Mode dispatch + FastAPI dispatch endpoint)
 * lives in /scripts/test-email-sender.sh — not in this file.
 */
import { describe, expect, it } from "vitest";
import {
  type EmailCampaignMessage,
  type EmailNotificationMessage,
  InvalidMessageError,
  validateMessage,
} from "@stevie/shared";

describe("validateMessage(email.notification)", () => {
  const valid: EmailNotificationMessage = {
    type: "email.notification",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "email-notif-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    to: "user@example.com",
    subject: "Welcome",
    html_body: "<p>Hi.</p>",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<EmailNotificationMessage>(valid, "email.notification")
    ).not.toThrow();
  });

  it("accepts optional text_body and reply_to", () => {
    expect(() =>
      validateMessage<EmailNotificationMessage>(
        { ...valid, text_body: "Hi.", reply_to: "support@example.com" },
        "email.notification"
      )
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<EmailNotificationMessage>(
        { ...valid, type: "email.campaign.send" },
        "email.notification"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<EmailNotificationMessage>(rest, "email.notification")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<EmailNotificationMessage>(
        { ...valid, idempotency_key: "" },
        "email.notification"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<EmailNotificationMessage>(null, "email.notification")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<EmailNotificationMessage>("string", "email.notification")
    ).toThrow(InvalidMessageError);
  });
});

describe("validateMessage(email.campaign.send)", () => {
  const valid: EmailCampaignMessage = {
    type: "email.campaign.send",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "campaign-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    campaign_id: "aa-bb-cc",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<EmailCampaignMessage>(valid, "email.campaign.send")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<EmailCampaignMessage>(
        { ...valid, type: "email.notification" },
        "email.campaign.send"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<EmailCampaignMessage>(rest, "email.campaign.send")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<EmailCampaignMessage>(
        { ...valid, idempotency_key: "" },
        "email.campaign.send"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing emitted_at", () => {
    const { emitted_at: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<EmailCampaignMessage>(rest, "email.campaign.send")
    ).toThrow(InvalidMessageError);
  });
});

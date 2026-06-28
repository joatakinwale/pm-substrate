// Live verification for the Svix signature-check helpers in
// src/webhooks.ts. We can't easily boot the Worker outside wrangler, so
// we extract-and-exercise the pure helpers by re-implementing the same
// algorithm against the Web Crypto API (identical code as in the Worker)
// and confirm a known Svix test vector round-trips.
//
// Run with:  node test-webhook-svix.mjs

import { webcrypto } from "node:crypto";
const crypto = webcrypto;

function base64ToBytes(b64) {
  const bin = Buffer.from(b64, "base64");
  return new Uint8Array(bin);
}
function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function computeSvixHmacBase64(whsecSecret, signedContent) {
  if (!whsecSecret) return null;
  const b64 = whsecSecret.startsWith("whsec_") ? whsecSecret.slice(6) : whsecSecret;
  const keyBytes = base64ToBytes(b64);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  return bytesToBase64(new Uint8Array(sig));
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

let pass = 0, total = 0;
function check(name, cond) {
  total++;
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else       console.log(`[FAIL] ${name}`);
}

// Fixture: matches Svix library's JS test vector
//   https://github.com/svix/svix-webhooks/blob/main/javascript/src/webhook.test.ts
const whsec   = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const svixId  = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const svixTs  = "1614265330";
const body    = '{"test": 2432232314}';
const expected = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
// (expected signature value known-good from Svix's own unit tests)

const signedContent = `${svixId}.${svixTs}.${body}`;
const computed = await computeSvixHmacBase64(whsec, signedContent);
const header = `v1,${computed}`;

check("HMAC produces known-good Svix signature", header === expected);

// Parse Svix header the same way the Worker does
const parsed = header
  .split(" ")
  .map((p) => p.split(","))
  .filter(([v]) => v === "v1")
  .map(([, s]) => s);
check("header contains one v1 entry",      parsed.length === 1);
check("parsed signature matches computed", parsed[0] === computed);

// Negative: wrong secret → different signature → mismatch
const wrongComputed = await computeSvixHmacBase64("whsec_AAAAAAAAAAAAAAAAAAAA", signedContent);
check("wrong secret → different signature", wrongComputed !== computed);
check("constantTimeEquals rejects mismatch", !constantTimeEquals(wrongComputed, computed));
check("constantTimeEquals accepts match",   constantTimeEquals(computed, computed));

// Length-mismatch short-circuit
check("length-mismatch fast-fails", !constantTimeEquals("abc", "abcd"));

// Tampered body → different signature
const tamperedBody = '{"test": 9999999999}';
const tamperedSignedContent = `${svixId}.${svixTs}.${tamperedBody}`;
const tamperedComputed = await computeSvixHmacBase64(whsec, tamperedSignedContent);
check("tampered body → different signature", tamperedComputed !== computed);

console.log(`\n=== ${pass}/${total} cases passed ===`);
process.exit(pass === total ? 0 : 1);

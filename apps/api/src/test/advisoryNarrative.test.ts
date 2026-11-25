import test from "node:test";
import assert from "node:assert/strict";
import { generateAdvisoryNarrative } from "../agents/advisoryNarrative.js";
import type { AdvisoryNarrativeInput } from "../agents/advisoryNarrative.js";

const review: AdvisoryNarrativeInput = {
  projectTitle: "Accessible science workshops",
  category: "education",
  projectDescription: "A project description for an accessible science workshop series.",
  requestedAmountQOR: 0.4,
  finalDecision: "APPROVED",
  reasons: ["All deterministic checks passed."],
  agentSummaries: {
    intake: true,
    documentVerification: true,
    eligibility: true,
    fraudCheck: true,
    financialPolicy: true,
  },
};

test("advisory narrative is explicitly skipped when Groq is not configured", async () => {
  let called = false;
  const result = await generateAdvisoryNarrative(review, {
    apiKey: "",
    fetcher: async () => {
      called = true;
      throw new Error("Fetch should not run");
    },
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.error, "GROQ_API_KEY is not configured.");
  assert.equal(result.text, null);
  assert.equal(called, false);
});

test("advisory request sends only review context and returns the model explanation", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const result = await generateAdvisoryNarrative(review, {
    apiKey: "test-key",
    model: "test-model",
    fetcher: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "The deterministic checks passed." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  assert.equal(result.status, "generated");
  assert.equal(result.text, "The deterministic checks passed.");
  assert.equal(result.model, "test-model");
  const serializedRequest = JSON.stringify(requestBody);
  assert.match(serializedRequest, /Accessible science workshops/);
  assert.doesNotMatch(serializedRequest, /applicantEmail|walletAddress|beneficiary/i);
});

test("provider failures are reported without producing a narrative", async () => {
  const result = await generateAdvisoryNarrative(review, {
    apiKey: "test-key",
    fetcher: async () => new Response(null, { status: 503 }),
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.text, null);
  assert.equal(result.error, "Groq request failed (HTTP 503).");
});

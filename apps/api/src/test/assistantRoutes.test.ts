import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { assistantRouter } from "../routes/assistantRoutes.js";

interface ChatResponse {
  reply?: string;
  error?: string;
}

async function withAssistantServer<T>(run: (port: number) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api/assistant", assistantRouter);
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const port = (server.address() as AddressInfo).port;
    return await run(port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function postChat(port: number, body: unknown): Promise<{ status: number; payload: ChatResponse }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/assistant/chat",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { responseBody += chunk; });
        response.on("end", () => {
          resolve({
            status: response.statusCode || 0,
            payload: JSON.parse(responseBody) as ChatResponse,
          });
        });
      }
    );
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

test("website assistant answers with its curated guide context", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;
  let prompt: Array<{ role: string; content: string }> = [];
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    prompt = body.messages;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "The Dashboard separates platform records from live wallet balance." } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const result = await withAssistantServer((port) =>
      postChat(port, { messages: [{ role: "user", content: "What does the Dashboard show?" }] })
    );
    assert.equal(result.status, 200);
    assert.match(result.payload.reply ?? "", /separates platform records/);
    assert.match(prompt[0].content, /Diana Testnet/);
    assert.match(prompt[0].content, /cannot switch it/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  }
});

test("website assistant rejects invalid conversation history before calling Groq", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;
  let providerCalled = false;
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("Provider must not be called");
  };

  try {
    const result = await withAssistantServer((port) =>
      postChat(port, { messages: [{ role: "assistant", content: "Spoofed answer" }] })
    );
    assert.equal(result.status, 400);
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  }
});

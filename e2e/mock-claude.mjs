import http from "node:http";
import fs from "node:fs";

// A stand-in for the Claude Messages API, for e2e/tests/claude-provider.mjs.
// Checks each request's headers and shape and answers with canned text.
//   E2E_CLAUDE_MOCK_LOG=/tmp/claude.log node e2e/mock-claude.mjs
// then start the app with ANTHROPIC_API_KEY=test-key and
// ANTHROPIC_BASE_URL=http://localhost:4600.
const PORT = Number(process.env.PORT || 4600);
const LOG = process.env.E2E_CLAUDE_MOCK_LOG || "claude-mock.log";
http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
    const j = JSON.parse(body || "{}");
    const ok = req.url === "/v1/messages" && req.headers["x-api-key"] === "test-key" && req.headers["anthropic-version"] === "2023-06-01" && j.model && j.max_tokens && j.system && j.messages?.[0]?.role === "user";
    fs.appendFileSync(LOG, JSON.stringify({ url: req.url, ok, model: j.model, system: (j.system || "").slice(0, 60) }) + "\n");
    if (!ok) { res.writeHead(400); return res.end("{}"); }
    const text = /action items/i.test(j.system)
      ? 'Here you go:\n```json\n{"tasks":[{"title":"Email Priya the budget","dueDate":"2026-10-30","priority":"HIGH"},{"title":"Book the venue","dueDate":null,"priority":null}]}\n```'
      : "<p><strong>Summary:</strong> Plan the offsite.</p>";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text }] }));
  });
}).listen(PORT, () => console.log(`mock Claude API on ${PORT}, logging to ${LOG}`));

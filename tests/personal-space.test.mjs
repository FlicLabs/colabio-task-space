import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createPersonalSpaceServer } from "../personal-space.mjs";
import { withSessionLock } from "../agent.mjs";

async function fixture(work) {
  const calls = [];
  const task = { id: 65, name: "Ship checkout", description: "Keep existing context", status: "NOT_STARTED" };
  const server = createPersonalSpaceServer({ org: 8, project: 24, execute: async (command, options) => {
    calls.push({ command, options });
    if (command === "list") return [task];
    if (command === "start") task.status = "IN_PROGRESS";
    return { changed: true, task };
  } });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(base)).text();
    const nonce = html.match(/name="task-space-connection" content="([a-f0-9]+)"/)[1];
    await work({ base, nonce, calls, html });
  } finally { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
}

test("serves a personal view and only its explicit public assets", () => fixture(async ({ base, html }) => {
  assert.match(html, /Your layout is local to this copy/);
  assert.match(html, /Organization 8 · Project 24/);
  const script = await fetch(`${base}/task-space.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal((await fetch(`${base}/agent.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
}));

test("rejects foreign origins and forged hostnames before reading tasks", () => fixture(async ({ base, calls }) => {
  assert.equal((await fetch(`${base}/api/tasks`, { headers: { Origin: "https://outside.invalid" } })).status, 403);
  const forged = await new Promise((done, reject) => {
    const request = httpRequest(`${base}/api/tasks`, { headers: { Host: "outside.invalid" } }, (response) => { response.resume(); done(response.statusCode); });
    request.on("error", reject); request.end();
  });
  assert.equal(forged, 403);
  assert.equal(calls.length, 0);
}));

test("requires the local page's nonce and origin for task changes", () => fixture(async ({ base, nonce, calls }) => {
  const body = JSON.stringify({ command: "start", task: 65 });
  for (const headers of [
    { "Content-Type": "application/json", Origin: base },
    { "Content-Type": "application/json", "X-Colabio-Task-Space": nonce },
    { "Content-Type": "application/json", Origin: "https://outside.invalid", "X-Colabio-Task-Space": nonce },
  ]) assert.equal((await fetch(`${base}/api/command`, { method: "POST", headers, body })).status, 403);
  assert.equal(calls.length, 0);
}));

test("writes the task and reads its updated state through the personal view", () => fixture(async ({ base, nonce, calls }) => {
  const response = await fetch(`${base}/api/command`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: base, "X-Colabio-Task-Space": nonce },
    body: JSON.stringify({ command: "start", task: 65 }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], { command: "start", options: { task: 65 } });
  const current = await (await fetch(`${base}/api/tasks`)).json();
  assert.equal(current.tasks[0].status, "IN_PROGRESS");
  assert.equal(current.tasks[0].description, "Keep existing context");
}));

test("rejects credential/scope overrides and unverified completion", () => fixture(async ({ base, nonce, calls }) => {
  for (const input of [
    { command: "start", task: 65, org: 9 },
    { command: "start", task: 65, api: "https://outside.invalid" },
    { command: "complete", task: 65, verified: "true" },
    { command: "delete", task: 65 },
  ]) {
    const response = await fetch(`${base}/api/command`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base, "X-Colabio-Task-Space": nonce }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
}));

test("serializes agent and personal-view commands without leaving a lock behind", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colabio-space-test-"));
  const path = join(directory, "connection.json");
  try {
    let release, entered;
    const ready = new Promise((done) => { entered = done; });
    const held = withSessionLock(path, async () => { entered(); await new Promise((done) => { release = done; }); });
    await ready;
    await assert.rejects(withSessionLock(path, async () => {}), /Another command/);
    release(); await held;
    await assert.rejects(stat(`${path}.lock`), { code: "ENOENT" });
    await withSessionLock(path, async () => {});
  } finally { await rm(directory, { recursive: true, force: true }); }
});

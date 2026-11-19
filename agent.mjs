#!/usr/bin/env node
import { mkdir, open, readFile, rename, chmod, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";

const API = "https://api.colabio.org/api/v1";
const HEADERS = { "Content-Type": "application/json", "X-Colabio-Client": "task-agent@1" };

export function positiveId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error("Use a positive numeric organization, project or task ID.");
  return Number(value);
}

export function apiBase(value = API) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && (url.protocol !== "https:" || url.hostname !== "api.colabio.org")) ||
      (local && !["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use the official Colabio API or an explicit localhost development API.");
  }
  return url.toString().replace(/\/$/, "");
}

/** No mutation is retried except after an authoritative 401, when nothing was authorized. */
export function applicationBase(value = "https://www.colabio.org") {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && !["https://www.colabio.org", "https://colabio.org"].includes(url.origin)) ||
      (local && !["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Use the Colabio app or an explicit local development app.");
  return `${url.origin}/api`;
}

/** @param {string | null} [application] */
export function createClient(session, saveSession, fetcher = fetch, application = null) {
  const base = apiBase(session.api);
  const destination = application === null ? base : applicationBase(application);
  async function send(path, method = "GET", body, token = session.accessToken, target = destination) {
    return fetcher(`${target}${path}`, {
      method, headers: { ...HEADERS, Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000), redirect: "error",
    });
  }
  return async function request(path, method = "GET", body) {
    let response = await send(path, method, body);
    if (response.status === 401) {
      const refreshed = await send("/tokens/refresh-token", "POST", undefined, session.refreshToken, base);
      if (!refreshed.ok) throw new Error(refreshed.status === 401 ? "Session ended. Connect the bridge again." : "Could not refresh the connection. Try later; your session was kept.");
      const pair = await refreshed.json();
      if (typeof pair.accessToken !== "string" || !pair.accessToken) throw new Error("The sign-in response was incomplete. Connect again.");
      session = { ...session, accessToken: pair.accessToken, refreshToken: pair.refreshToken || session.refreshToken };
      // Save the rotated pair before any further request, including a failed task write.
      await saveSession(session);
      response = await send(path, method, body);
    }
    if (!response.ok) throw new Error(`Colabio refused the request (${response.status}). No successful change was confirmed.`);
    return response.json();
  };
}

export async function runViewCommand(request, session, command, options = {}) {
  const path = `/organizations/${positiveId(session.org)}/me/task-space`;
  const current = await request(path);
  if (command === "view-show") return current;
  if (!["view-apply", "view-reset"].includes(command)) throw new Error("Unknown view command");
  if (!Number.isSafeInteger(current.revision) || current.revision < 0) throw new Error("Could not read your view's revision.");
  const view = command === "view-reset" ? null : {
    title: text(options.title || "My task space", 80, "View title"),
    html: text(options.html, 200_000, "View HTML"),
  };
  const result = await request(path, "PUT", { expectedRevision: current.revision, view });
  return { revision: result.revision, title: result.view?.title ?? "Colabio view", message: "Saved to your own account. Open or return to the Tasks page inside Colabio; no local app is needed." };
}

export async function runAgentRunCommand(request, session, command, options) {
  const id = options.run;
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Use the run ID from the Colabio prompt.");
  }
  const path = `/organizations/${positiveId(session.org)}/me/task-runs`;
  const current = await request(`${path}?run=${id}`);
  if (command === "run-show") return current;
  if (!Number.isSafeInteger(current.revision) || current.revision < 1 || current.id !== id) {
    throw new Error("Could not read the current Colabio run.");
  }
  const action = command.slice(4);
  if (!["start", "switch", "finish"].includes(action)) throw new Error("Unknown run command.");
  const update = { action, runId: id, revision: current.revision };
  if (action === "switch") {
    update.projectId = positiveId(options["to-project"] ?? current.task.projectId);
    update.taskId = positiveId(options.task);
  }
  return request(path, "POST", update);
}

export async function readProject(request, organizationId, projectId) {
  const project = await request(`/projects/${positiveId(projectId)}/get?view=board`);
  if (project.organizationId !== positiveId(organizationId) || project.id !== Number(projectId) || !Array.isArray(project.tasks)) {
    throw new Error("The project did not match the chosen organization. Nothing changed.");
  }
  return project;
}

function normalize(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim().replace(/\s+/g, " ");
}

function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return value.trim();
}

function taskForAgent(task) {
  const { id, name, description, status, deadline, timeLogged, subtasks, project } = task;
  return { id, name, description, status, deadline, timeLogged, subtasks, project, managedExternally: !!task.externalIssue };
}

/** All commands read the bound project first. A task from another project is never written. */
export async function runTaskCommand(request, session, command, options = {}) {
  const project = await readProject(request, session.org, session.project);
  if (command === "list") return project.tasks.map(taskForAgent);
  if (command === "create") {
    const name = text(options.title, 255, "Task title");
    const duplicate = project.tasks.find((task) => task.status !== "COMPLETED" && normalize(task.name) === normalize(name));
    if (duplicate && !options["allow-duplicate"]) return { existingTask: taskForAgent(duplicate), created: false, message: "Continue this task if it is the same work. Use a distinct outcome, or --allow-duplicate for intentional recurring work." };
    const description = options.description === undefined ? "" : text(options.description, 2000, "Description");
    const created = await request("/tasks/create", "POST", {
      projectId: session.project, name, description, status: "IN_PROGRESS", subtasks: [],
    });
    return { created: true, task: taskForAgent(created) };
  }
  const task = project.tasks.find((item) => item.id === positiveId(options.task));
  if (!task) throw new Error("That task is not on the connected project. Nothing changed.");
  if (command === "show") return taskForAgent(task);
  if (!["start", "complete", "describe"].includes(command)) throw new Error("Unknown command. Run node agent.mjs help.");
  if (task.externalIssue) throw new Error("This task is managed by Jira. Update it in Jira so its sync remains authoritative.");
  if (command === "complete" && !options.verified) throw new Error("Verify the work first, then pass --verified to mark it complete.");
  if (command === "start" && task.status === "COMPLETED") throw new Error("This task is already completed. Choose an open task; reopening is a separate decision.");
  const body = command === "describe"
    ? { description: text(options.description, 2000, "Description") }
    : { status: command === "start" ? "IN_PROGRESS" : "COMPLETED" };
  if (body.status === task.status) return { changed: false, task: taskForAgent(task) };
  return { changed: true, task: taskForAgent(await request(`/tasks/${task.id}/update`, "PUT", body)) };
}

async function savePrivate(path, session) {
  const temporary = `${path}.${process.pid}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(session)); }
  finally { await file.close(); }
  await rename(temporary, path);
  await chmod(path, 0o600);
}

const HELP = `Colabio task bridge (Node 22+)
Commands: connect, view-show, view-apply, view-reset, serve, list, show, create, start, describe, complete, disconnect
Every command needs --org ID --project ID. Task commands also need --task ID.
connect: paste a 60-second code from the board into the local prompt (never into chat).
view-apply: --html-file my-view.html [--view-title "My task space"] (publishes inside Colabio, for you only)
view-show: read your hosted view; view-reset: restore your hosted Colabio view
serve: open your own editable task space on this computer [--port 4318]
create: --title "Specific outcome" [--description-file path] [--allow-duplicate]
describe: --task ID --description-file path (replaces the description; preserve existing context)
complete: --task ID --verified (only after verifying the work)
run-show, run-start, run-finish: --run UUID from the Colabio prompt
run-switch: --run UUID --task ID [--to-project ID] (moves this run and records the prior task)
An independent account session is kept in ~/.config/colabio/task-agent with owner-only permissions.
disconnect removes the local credentials; revoke the device in Colabio to end server access.
No time is tracked by this bridge. Board updates use your existing permissions.
`;

export async function withSessionLock(path, action) {
  let lock;
  try { lock = await open(`${path}.lock`, "wx", 0o600); }
  catch { throw new Error("Another command is using this connection. Wait for it to finish. If it crashed, remove the matching .lock file from ~/.config/colabio/task-agent."); }
  try { return await action(); }
  finally { await lock.close(); await unlink(`${path}.lock`); }
}

async function loadSession(path, org, project) {
  let session;
  try { session = JSON.parse(await readFile(path, "utf8")); }
  catch { throw new Error("Connect this organization and project first. Run node agent.mjs connect --org ID --project ID."); }
  if (session.org !== org || session.project !== project) throw new Error("Connection scope mismatch. Connect again.");
  return session;
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    org: { type: "string" }, project: { type: "string" }, task: { type: "string" }, run: { type: "string" }, "to-project": { type: "string" },
    title: { type: "string" }, "description-file": { type: "string" }, api: { type: "string" },
    verified: { type: "boolean" }, "allow-duplicate": { type: "boolean" },
    port: { type: "string" },
    "html-file": { type: "string" }, "view-title": { type: "string" }, app: { type: "string" },
  } });
  const command = positionals[0] ?? "help";
  if (command === "help") { process.stdout.write(HELP); return; }
  if (!["connect", "serve", "view-show", "view-apply", "view-reset", "disconnect", "list", "show", "create", "start", "describe", "complete", "run-show", "run-start", "run-switch", "run-finish"].includes(command)) throw new Error("Unknown command. Run node agent.mjs help.");
  const org = positiveId(values.org), project = positiveId(values.project);
  const directory = join(homedir(), ".config", "colabio", "task-agent");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = join(directory, `${org}-${project}.json`);
  if (command === "serve") {
    const port = values.port ? positiveId(values.port) : 0;
    if (port > 65535) throw new Error("Choose a local port between 1 and 65535.");
    const { startPersonalSpace } = await import("./personal-space.mjs");
    await startPersonalSpace({ org, project, port, execute: (action, options) => withSessionLock(path, async () => {
      const session = await loadSession(path, org, project);
      const request = createClient(session, (next) => savePrivate(path, next));
      return runTaskCommand(request, session, action, options);
    }) });
    return;
  }
  // Serialize each command across coding-agent and local-view processes: tokens rotate once.
  return withSessionLock(path, async () => {
    if (command === "disconnect") {
      await unlink(path).catch((error) => { if (error.code !== "ENOENT") throw error; });
      process.stdout.write("Local connection removed. Revoke the bridge device in Colabio to end its server session.\n");
      return;
    }
    if (command === "connect") {
      const api = apiBase(values.api);
      const terminal = createInterface({ input: process.stdin, output: process.stderr });
      let code;
      try { code = (await terminal.question("Paste your one-time Colabio connection code: ")).trim(); }
      finally { terminal.close(); }
      if (!code) throw new Error("No code entered. Make a new code on your board.");
      const response = await fetch(`${api}/auth/device-token`, {
        method: "POST", headers: HEADERS, body: JSON.stringify({ code }), redirect: "error", signal: AbortSignal.timeout(30_000),
      });
      code = undefined;
      if (!response.ok) throw new Error("The code expired or was refused. Make a new code on your board.");
      const pair = await response.json();
      if (!pair.accessToken || !pair.refreshToken) throw new Error("The connection response was incomplete.");
      const session = { api, org, project, accessToken: pair.accessToken, refreshToken: pair.refreshToken };
      await savePrivate(path, session);
      const request = createClient(session, (next) => savePrivate(path, next));
      await readProject(request, org, project);
      process.stdout.write("Connected. Your agent can now use this project's board with your permissions.\n");
      return;
    }
    let session = await loadSession(path, org, project);
    const save = async (next) => { session = next; await savePrivate(path, next); };
    const request = createClient(session, save);
    if (command.startsWith("run-")) {
      const app = createClient(session, save, fetch, values.app || "https://www.colabio.org");
      const result = await runAgentRunCommand(app, session, command, values);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command.startsWith("view-")) {
      await readProject(request, org, project);
      const html = values["html-file"] ? await readFile(resolve(values["html-file"]), "utf8") : undefined;
      const result = await runViewCommand(createClient(session, save, fetch, values.app || "https://www.colabio.org"), session, command, { html, title: values["view-title"] });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); return;
    }
    const description = values["description-file"] ? await readFile(resolve(values["description-file"]), "utf8") : undefined;
    const result = await runTaskCommand(request, session, command, { ...values, description });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

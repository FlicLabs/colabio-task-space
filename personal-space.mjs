import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const ASSETS = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/task-space.js", ["task-space.js", "text/javascript; charset=utf-8"]],
  ["/task-space.css", ["task-space.css", "text/css; charset=utf-8"]],
]);

/** A personal, loopback-only view. Credentials stay in the local bridge, never in the browser. */
export function createPersonalSpaceServer({ org, project, execute }) {
  const nonce = randomBytes(32).toString("hex");
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (status, value) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value)); };
    const address = server.address();
    if (!address || typeof address === "string") { json(503, { error: "Starting your space" }); return; }
    const host = `127.0.0.1:${address.port}`;
    const origin = `http://${host}`;
    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) {
      json(403, { error: "Open this space from its own local address." }); return;
    }
    try {
      const url = new URL(request.url, origin);
      if (url.origin !== origin) { json(403, { error: "Local requests only" }); return; }
      if (request.method === "GET" && ASSETS.has(url.pathname)) {
        const [filename, contentType] = ASSETS.get(url.pathname);
        let contents = await readFile(new URL(`./web/${filename}`, import.meta.url), "utf8");
        if (filename === "index.html") contents = contents.replace("{{nonce}}", nonce).replace("{{org}}", String(org)).replace("{{project}}", String(project));
        response.writeHead(200, { "Content-Type": contentType }); response.end(contents); return;
      }
      if (request.method === "GET" && url.pathname === "/api/tasks") {
        json(200, { tasks: await execute("list", {}) }); return;
      }
      if (request.method === "POST" && url.pathname === "/api/command") {
        if (request.headers.origin !== origin || request.headers["x-colabio-task-space"] !== nonce || request.headers["content-type"]?.split(";")[0] !== "application/json") {
          json(403, { error: "Use the controls in your personal space." }); return;
        }
        let body = "";
        for await (const chunk of request) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 8192) { json(413, { error: "That task update is too large." }); return; }
        }
        const input = JSON.parse(body);
        if (!input || !["create", "start", "complete", "describe"].includes(input.command)) { json(400, { error: "Choose a task action." }); return; }
        const options = {};
        // Only task content is accepted. Organization, project and API destination are bound
        // by the local connection; no browser request may supply credentials or a URL.
        for (const key of Object.keys(input)) {
          if (!["command", "task", "title", "description", "verified"].includes(key)) { json(400, { error: "Unsupported task field" }); return; }
          if (key !== "command") options[key] = input[key];
        }
        if (input.command === "complete" && input.verified !== true) { json(400, { error: "Verify the work before completing it." }); return; }
        json(200, await execute(input.command, options)); return;
      }
      json(404, { error: "Not found" });
    } catch (error) {
      json(400, { error: error instanceof SyntaxError ? "The task update was not valid JSON." : error.message });
    }
  });
  return server;
}

export async function startPersonalSpace({ org, project, execute, port = 0 }) {
  const server = createPersonalSpaceServer({ org, project, execute });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", done); });
  process.stdout.write(`Your personal task space: http://127.0.0.1:${server.address().port}\nLayout changes belong to this copy. Task updates sync to the shared board.\nPress Ctrl+C to close it.\n`);
  const stop = () => { server.closeAllConnections(); server.close(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return server;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgentRunCommand } from "../agent.mjs";

test("moves only the selected run to an authorized target checked by the server", async () => {
  const run = "df8d0118-45fa-4b4f-8959-7cac314e960b";
  const calls = [];
  const request = async (...args) => {
    calls.push(args);
    return { id: run, revision: 4, task: { projectId: 24, taskId: 65 } };
  };
  await runAgentRunCommand(request, { org: 8, project: 24 }, "run-switch", { run, task: "87", "to-project": "25" });
  assert.deepEqual(calls, [
    [`/organizations/8/me/task-runs?run=${run}`],
    ["/organizations/8/me/task-runs", "POST", { action: "switch", runId: run, revision: 4, projectId: 25, taskId: 87 }],
  ]);
});

# Working with this task space

Security maintenance: read [SECURITY.md](SECURITY.md) for the published package patch, verification limits and contribution safeguards.

## Default: customize INSIDE Colabio

For personal customization, read `HOSTED.md` and start from `hosted-view.html`.
Produce one self-contained HTML file with inline CSS/JS. The person can preview
and apply it under Tasks → Make it yours. If the bridge is connected, use
`view-apply --org ORG_ID --project PROJECT_ID --html-file my-view.html` to publish
only to their own account. `view-show` reads their current view and `view-reset`
restores the default. Do not run `serve` or build a separate app unless the person
explicitly asks for the optional standalone version. View changes are personal;
task edits remain shared and use Colabio's existing task controls.

This folder is an independent MIT-licensed part of Colabio. The rest of the Colabio
application is not covered by this license. Change the layout, cards, grouping,
filters, interaction and styling freely in your own app. `src/layout.tsx` accepts
your column renderer and knows nothing about credentials or the Colabio backend.
`examples/CustomTaskSpace.tsx` demonstrates an alternative view.

For the runnable personal version, use
`node agent.mjs serve --org ORG_ID --project PROJECT_ID --port 4318` after
connecting. Customize `web/index.html`, `web/task-space.css`, and
`web/task-space.js` in this person's own fork or downloaded copy, then refresh.
These view files affect only their copy, never the hosted app or someone else's
layout. Task content and status changes still update the shared project board.
Keep the local server bound to loopback and preserve its origin, host and request
nonce checks. Never put account tokens in the page, scripts or browser storage.
The React example is optional; the built-in personal view needs no build or npm install.

Use `agent.mjs` from Claude Code, Codex or another agent that can run local commands.
It calls the existing Colabio task API, so the same task is used by the shared board
and progress reports. It does not read or import a conversation automatically.

## Connect once per project

Run `node agent.mjs connect --org ORG_ID --project PROJECT_ID` yourself. When the
bridge asks, paste a single-use code generated on your Colabio Tasks page under
Connect Claude / Codex. The code lasts 60 seconds. Never put it in a chat, an
instruction file, a command argument, or a receipt. No password is needed.

This creates an independent device session with your account's permissions,
not a restricted task-only token. Credentials are saved outside the repository,
with owner-only file permissions. Revoke its device in Colabio's My Account →
Devices & sessions to end server access. `disconnect` only removes the local copy.
For development, `connect` accepts `--api http://localhost:8080/api/v1`.

## Work on a task as a prompt

Colabio Tasks → Run as prompt prepares a separate, personal run ID. For each
run, use the connection arguments provided in its prompt, with `--run UUID`.

- `run-show` reads its current task, state and assignment history.
- `run-start` confirms work started after the user submits the prompt.
- `run-switch --task TASK_ID [--to-project PROJECT_ID]` moves just this run.
  Look for an existing task that matches the work before switching. Use the
  new project's ID when it differs from the run's current project. Colabio
  verifies that the signed-in member has access to that task.
- `run-finish` ends this run. Use the separate task commands when authorized
  to update the shared task itself.

A run move records the old and new task and when the move happened. Parallel
runs can refer to different tasks, or to the same high-level task. No run action
starts tracked time. If the bridge is unavailable, tell the person which task
the run belongs to. They can update it in Agent runs on the Tasks page.

## Keep the work and board together

Replace ORG_ID and PROJECT_ID with the connected scope in every command.

1. Read the board: `node agent.mjs list --org ORG_ID --project PROJECT_ID`.
2. Reuse an open task for the same outcome. Read it with
   `node agent.mjs show --task TASK_ID --org ORG_ID --project PROJECT_ID`.
3. If this is new work, derive a specific outcome from the work the person asked
   you to do and create it with
   `node agent.mjs create --title "Ship the checkout currency fix" --org ORG_ID --project PROJECT_ID`.
   New tasks start IN_PROGRESS and the backend assigns them to the caller.
   Matching open titles are returned instead of duplicated; intentional recurring
   work can use `--allow-duplicate` after the person chooses to do so.
   Tell the person which task you are using. Ask only when the outcome or what
   may be shared is unclear; do not interrupt authorized work for routine updates.
4. Begin an existing task with
   `node agent.mjs start --task TASK_ID --org ORG_ID --project PROJECT_ID`.
5. To share a progress summary, prepare a text file preserving the task's existing
   description, then run `node agent.mjs describe --task TASK_ID --description-file summary.txt --org ORG_ID --project PROJECT_ID`.
   This replaces the description (maximum 2,000 characters). It is a shared task
   summary, not a private scratchpad. Share only the agreed summary. Do not copy raw
   prompts, private conversation, credentials or hidden reasoning.
6. Verify the actual work before
   `node agent.mjs complete --task TASK_ID --verified --org ORG_ID --project PROJECT_ID`.
   A request is not evidence of progress; an agent's attempt is not completion.

Read the latest record before editing. Do not overwrite a colleague's change. The
API currently has no version precondition, so simultaneous description edits can
overwrite one another. Status-only commands leave the description, deadline,
assignment and billing fields alone. Jira owns imported tasks; edit them in Jira.

If a command fails or the connection is unavailable, say so and continue helping.
Never claim the board was updated unless the server confirmed it. Network errors
are not automatically retried; read the board before repeating a create. Concurrent
commands are refused while a connection is in use to protect rotating credentials.
If a process crashes, remove only its matching `.lock` file after confirming that
process ended. Disconnect with
`node agent.mjs disconnect --org ORG_ID --project PROJECT_ID`.

No bridge command changes tracked time, billing, deadlines or assignees. Keep the
backend as the authority for project access and task permissions. Custom views
must use those same rules. Do not create tasks, mark them complete or publish
private prompt text merely to make a report look better.

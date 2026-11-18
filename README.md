# Colabio task space

An editable task-space layout and a local agent bridge, released under the MIT
license. This package contains no Colabio credentials or customer data. Its license
applies only to this folder.

Public source: [FlicLabs/colabio-task-space](https://github.com/FlicLabs/colabio-task-space).
Fork it, download it, or give your own copy to your coding agent.

## Customize inside Colabio

Open **Tasks → Make it yours → Copy agent instructions**. Ask your agent for a
single HTML view, then upload, preview and apply it on that same page. Your view
runs inside Colabio and is saved to your own account in the organization across
browsers. No separate local app is required. Teammates keep their own interfaces.

A connected agent can also publish directly with the `view-apply` command in
bridge version 0.2.0+. See [the hosted customization guide](HOSTED.md) and
[`hosted-view.html`](hosted-view.html) for the complete contract and starter.
Task edits continue through Colabio's regular controls on the shared board.

## Optional standalone local version

Node 22 or later is required. The personal task space and bridge need no npm
dependencies and no AI API key.

```sh
git clone https://github.com/FlicLabs/colabio-task-space.git
cd colabio-task-space
node agent.mjs connect --org ORG_ID --project PROJECT_ID
node agent.mjs serve --org ORG_ID --project PROJECT_ID --port 4318
```

Replace the IDs with those shown under **Connect Claude / Codex** on your Colabio
Tasks page. Run the connect command, make a 60-second code on that page, and paste
it into the local connection prompt. Then run `serve` and open the local address
it prints. Press Ctrl+C when finished. Your agent can use the same connection
while this personal view is open.

Ask your agent to edit `web/index.html`, `web/task-space.css`, and
`web/task-space.js` in **your fork or downloaded copy**, then refresh your local
page. Change the kanban, cards, spacing, colors, filters, or build another layout.
There is no build step for this version. The local server accepts requests only
from its own loopback address and keeps account credentials outside the browser.

**Your interface changes affect only your own copy.** They do not change anyone
else's task space or deploy anything to the hosted Colabio app. Task content and
status edits still update the shared project board with your existing permissions.
Only share a task update when you intend the team to see it.

Run `npm test` to check the local server's isolation and shared task updates.

## Personalize your board

In Colabio, **Make it yours** changes columns to stacked sections, switches card
density, and shows or hides descriptions. These preferences stay with your user
and organization in this browser. They do not change a teammate's view.

For a fully custom view, copy this source into your React/TypeScript app and give
it to your coding agent. Read `examples/CustomTaskSpace.tsx` for a view with your
own cards and status controls. `TaskSpaceLayout` takes a `renderColumn` callback;
replace its markup, style, card structure or layout entirely. It has no dependency
on Next.js, Tailwind, Colabio UI components or the backend. React 18+ is the only
peer dependency. Import `src/layout.tsx` and `src/clarity.ts` in your app's build.

`taskHints` and `taskHintsById` offer conservative hints for generic activity
titles without descriptions and duplicate open titles within one project. These
also suggest reviewing milestones on an open task with at least 40 tracked hours
and no checklist; this is a conversation starter, not a time limit. Suggestions
are optional: recurring work is valid, completed work is excluded, and
nothing changes tasks, time, reports or scores automatically.

You can apply self-contained personal HTML directly inside Colabio using
**Make it yours**, or use the optional standalone app. A personal view never
changes a teammate's interface. Shared product changes still go through the
normal development review.

## Work from Claude Code or Codex

Node 22 or later is required; the bridge needs no npm dependencies. Start with:

```sh
node agent.mjs connect --org ORG_ID --project PROJECT_ID
node agent.mjs list --org ORG_ID --project PROJECT_ID
```

Make a 60-second connection code on your Colabio board and paste it into the local
bridge prompt. Then share `AGENTS.md` with your agent, or copy work instructions
from the board. The bridge updates the actual task API, so the hosted board and
the report's task records follow the same state. A visible board refreshes within
one minute and on returning to the tab. New tasks are assigned to the caller.

The bridge is a local command-line integration for agents that can run commands;
it is not an MCP server, a Claude web connector or a background conversation
monitor. It shares only the commands and summaries you choose. Prompt capture is
separate. On your own captured prompts, **Turn into task** opens a draft for you
to review and save. Neither a captured prompt nor a task creation proves that
work was completed.

Your connection is an independent account device session, **not a task-scoped
token**. It can act with your account permissions; the provided commands expose
only task operations. Store the source somewhere you control and revoke the
device in My Account → Devices & sessions when finished. `disconnect` deletes
the local credentials only. See `AGENTS.md` for commands, limitations and refresh
behavior. The package is available from the public GitHub repository and as a
source download from Colabio. It does not require an npm publication to run.

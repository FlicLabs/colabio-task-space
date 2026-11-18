# Customize your view inside Colabio

Your custom interface runs on your Colabio Tasks page. No separate local app or
local server is required. It is saved to your own account in the organization and
follows you across browsers. Other members keep their own views.

## Apply a view

1. Open **Tasks → Make it yours → Copy agent instructions**.
2. Give those instructions to Claude, Codex, or your agent. Ask for one
   self-contained HTML file. Start from `hosted-view.html` in this repository.
3. Upload or paste the file in **Make it yours**, choose **Preview your view**,
   then **Use this view**. The preview cannot edit tasks or open task controls.

You can return to **Make it yours** to replace the view, or choose **Use Colabio
view** above the custom interface to restore the standard board. This affects
only your own interface. Task edits still update the shared project board.

## Let your connected agent publish directly

Use bridge version 0.2.0 or later. Connect once from the Tasks page as described
in `AGENTS.md`, then your agent can run:

```sh
node agent.mjs view-show --org ORG_ID --project PROJECT_ID
node agent.mjs view-apply --org ORG_ID --project PROJECT_ID --html-file my-view.html --view-title "My task space"
node agent.mjs view-reset --org ORG_ID --project PROJECT_ID
```

These commands update only the account connected to the bridge. There is no
target-member option. They read the current revision before saving; a concurrent
edit is refused so it is not silently overwritten. Open or return to the Tasks
page to see the change, or wait up to 30 seconds while the page is visible.
Do not run `serve` for hosted customization. That command is only for the optional
standalone local app. For development, use `--app http://localhost:3000`.

## View contract

Use inline CSS and JavaScript in one HTML file, at most 200,000 characters, with
a name of at most 80 characters. External scripts, fonts, images and network
requests are unavailable. Use inline SVG or data images for illustrations.

The app provides `window.colabio`:

```js
const unsubscribe = window.colabio.onTasks(model => {
  // model.project: { id, name }
  // model.theme: "light" | "dark"
  // model.tasks: [{ id, name, description, status, priority, deadline,
  //   timeLogged, assignees: [{id, fullName}], subtasks: [{id, name, status}] }]
  // Render with textContent for task text. New board data invokes this again.
});
window.colabio.openTask(taskId); // Opens Colabio's existing task dialog.
window.colabio.createTask();    // Opens Colabio's new-task form.
```

The view receives the current board's filtered tasks. It has no account tokens,
browser storage, app DOM, email fields, pay data or direct task-write API.
Keep a visible route to the task controls. Preview callbacks do not open dialogs.
Do not embed raw conversations, credentials or unrelated member data in the file.

The hosted renderer uses an app-owned wrapper and a nested opaque-origin frame.
Both are restricted to scripts without same-origin access. The wrapper's policy
restricts frame navigation to blobs, while the personal document blocks network
resources and nested frames. Changes to the renderer belong in the shared source;
personal design changes belong in your own HTML file and account.

// Your view belongs to this copy. Customize the markup, columns, cards and behavior here.
const $ = (id) => document.getElementById(id);
const nonce = document.querySelector('meta[name="task-space-connection"]').content;
const columns = [["NOT_STARTED", "Up next"], ["IN_PROGRESS", "In progress"], ["BLOCKED", "Blocked"], ["COMPLETED", "Finished"]];
let tasks = [], editingId = null, busy = false;
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
function render() {
  const search = $("search").value.toLowerCase();
  const board = $("board");
  board.classList.toggle("stacked", $("layout").value === "stack");
  board.replaceChildren();
  for (const [status, label] of columns) {
    const matching = tasks.filter((task) => task.status === status && `${task.name} ${task.description ?? ""}`.toLowerCase().includes(search));
    if (status === "BLOCKED" && !matching.length) continue;
    const lane = node("section", undefined, "lane");
    const heading = node("h2", label); heading.append(node("span", String(matching.length), "count")); lane.append(heading);
    for (const task of matching) {
      const card = node("article", undefined, "card"); card.id = `task-${task.id}`;
      card.append(node("h3", task.name));
      if (task.description) card.append(node("p", task.description));
      if (task.managedExternally) card.append(node("p", "Managed in Jira. Update it there."));
      else {
        const actions = node("div", undefined, "actions");
        const action = (label, work) => {
          const button = node("button", label); button.type = "button"; button.disabled = busy;
          button.addEventListener("click", work); actions.append(button);
        };
        action("Edit summary", () => openEditor(task));
        if (status === "NOT_STARTED" || status === "BLOCKED") action("Start task", () => command("start", { task: task.id }));
        if (status !== "COMPLETED") action("Mark verified work complete", () => command("complete", { task: task.id, verified: true }));
        card.append(actions);
      }
      lane.append(card);
    }
    if (!matching.length) lane.append(node("p", "Room for your next outcome.", "empty"));
    board.append(lane);
  }
}
async function load() {
  try {
    const response = await fetch("/api/tasks");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not read your board.");
    tasks = data.tasks; $("error").textContent = ""; render();
  } catch (error) { $("error").textContent = error.message; }
}
async function command(action, options) {
  if (busy) return;
  busy = true; $("save").disabled = true; $("error").textContent = ""; render();
  try {
    const response = await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json", "X-Colabio-Task-Space": nonce }, body: JSON.stringify({ command: action, ...options }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not save the task.");
    $("editor").close();
    $("notice").textContent = result.created === false ? result.message : "Saved to your shared Colabio board.";
    await load();
  } catch (error) { $("error").textContent = error.message; $("editor-error").textContent = error.message; }
  finally { busy = false; $("save").disabled = false; render(); }
}
function openEditor(task) {
  editingId = task?.id ?? null;
  $("editor-error").textContent = "";
  $("editor-title").textContent = task ? "Update the task summary" : "New task";
  $("title-field").hidden = !!task; $("task-title").required = !task;
  $("task-title").value = task?.name ?? ""; $("task-description").value = task?.description ?? "";
  $("editor").showModal();
}
$("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  command(editingId ? "describe" : "create", editingId
    ? { task: editingId, description: $("task-description").value }
    : { title: $("task-title").value, description: $("task-description").value || undefined });
});
$("cancel").addEventListener("click", () => $("editor").close());
$("add").addEventListener("click", () => openEditor());
$("refresh").addEventListener("click", () => load());
$("search").addEventListener("input", render);
$("layout").addEventListener("change", render);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !busy) load(); });
setInterval(() => { if (!document.hidden && !busy && !$("editor").open) load(); }, 30_000);
load();

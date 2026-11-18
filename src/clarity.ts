/** Suggestions about the record, never a judgement about the person doing the work. */
export interface ClarityTask {
  id: number;
  name: string;
  description?: string | null;
  status?: string;
  timeLogged?: number | null;
  subtasks?: readonly { status: string }[];
}

export interface TaskHint {
  kind: "clarify" | "duplicate" | "milestones";
  message: string;
  relatedTaskId?: number;
}

const ACTIVITY_TITLES = new Set([
  "task", "test", "testing", "work", "working", "general", "general work", "misc",
  "miscellaneous", "other", "development", "dev", "coding", "research", "meeting",
  "meetings", "daily work", "daily task", "new task", "untitled", "todo", "to do",
  "same task", "continued", "ongoing", "updates", "update", "non task", "no task",
]);

/** A prompt to describe milestones, never a deadline or a limit on legitimate long work. */
export const LONG_RUNNING_TASK_SECONDS = 40 * 60 * 60;

export function normalizeTaskTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Only compare tasks in the same project. Completed work is deliberately not a duplicate. */
export function taskHints(task: ClarityTask, projectTasks: readonly ClarityTask[] = []): TaskHint[] {
  if (task.status === "COMPLETED") return [];
  const title = normalizeTaskTitle(task.name);
  if (!title) return [];
  const hints: TaskHint[] = [];
  if (ACTIVITY_TITLES.has(title) && (task.description?.trim().length ?? 0) < 40) {
    hints.push({
      kind: "clarify",
      message: "What will be different when this is done? Name an outcome, or describe the recurring activity so it is useful in your progress report.",
    });
  }
  if ((task.timeLogged ?? 0) >= LONG_RUNNING_TASK_SECONDS && !task.subtasks?.length) {
    hints.push({
      kind: "milestones",
      message: "This task has at least 40 tracked hours and no checklist. Still one outcome? Keep it. If your work now covers other outcomes, add those tasks or describe the next milestone so your progress is visible.",
    });
  }
  const duplicate = projectTasks.find((other) =>
    other.id !== task.id && other.status !== "COMPLETED" && normalizeTaskTitle(other.name) === title,
  );
  if (duplicate) hints.push({
    kind: "duplicate",
    relatedTaskId: duplicate.id,
    message: `There is already an open task called “${duplicate.name}”. Continue that task if this is the same work, or name the different outcome.`,
  });
  return hints;
}

export function taskHintsById(tasks: readonly ClarityTask[]): Map<number, TaskHint[]> {
  const names = new Map<string, ClarityTask[]>();
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const title = normalizeTaskTitle(task.name);
    const group = names.get(title) ?? [];
    group.push(task);
    names.set(title, group);
  }
  return new Map(tasks.map((task) => [task.id, taskHints(task, names.get(normalizeTaskTitle(task.name)))]));
}

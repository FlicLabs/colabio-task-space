import { z } from "zod";

export const HOSTED_VIEW_MAX_LENGTH = 200_000;
export const hostedViewSchema = z.object({
  title: z.string().trim().min(1).max(80),
  html: z.string().min(1).max(HOSTED_VIEW_MAX_LENGTH),
}).strict();
export type HostedTaskView = z.infer<typeof hostedViewSchema>;
export const hostedViewUpdateSchema = z.object({
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  view: hostedViewSchema.nullable(),
}).strict();
export interface PersonalTaskView { version: 1; revision: number; view: HostedTaskView | null }
export const EMPTY_TASK_VIEW: PersonalTaskView = { version: 1, revision: 0, view: null };

/** The key never accepts an organization manager's or agent-supplied target member. */
export function personalTaskViewKey(orgId: number, userId: number) {
  if (![orgId, userId].every((id) => Number.isSafeInteger(id) && id > 0)) throw new Error("Invalid task-space owner");
  return `org_${orgId}_task_space_member_${userId}`;
}

export function parsePersonalTaskView(value: unknown): PersonalTaskView {
  const parsed = z.object({ version: z.literal(1), revision: z.number().int().min(0), view: hostedViewSchema.nullable() }).safeParse(value);
  return parsed.success ? parsed.data : { ...EMPTY_TASK_VIEW };
}

export function hostedViewAgentPrompt(orgId: number, projectId: number) {
  return `Customize my personal task space INSIDE Colabio. Do not build or run a separate local app.

Create a single self-contained HTML file with inline CSS and JavaScript. No external libraries, URLs, fonts, fetch calls, cookies or storage. This runs as an isolated view inside my Colabio Tasks page. Only my own account's view changes; project task records remain shared.

Use window.colabio.onTasks(model => render(model)) to receive {project:{id,name}, tasks:[{id,name,description,status,priority,deadline,timeLogged,assignees:[{id,fullName}],subtasks:[{id,name,status}]}], theme:"light"|"dark"}. Data updates when the board changes. Use textContent for task text. Statuses are NOT_STARTED, IN_PROGRESS, COMPLETED. Call window.colabio.openTask(id) to open Colabio's task controls, or window.colabio.createTask() to open its new-task form. The view cannot write tasks directly.

Read https://github.com/FlicLabs/colabio-task-space/blob/main/HOSTED.md and its hosted-view.html starter. If my agent bridge is connected, publish with:
node agent.mjs view-apply --org ${orgId} --project ${projectId} --html-file my-view.html --view-title "My task space"
The bridge must be version 0.2.0 or later. Otherwise give me the HTML file to upload under Tasks → Make it yours → Custom view. I can preview it and choose Use this view inside Colabio. Never put credentials or private conversation in the HTML. Keep a way to open task controls.`;
}

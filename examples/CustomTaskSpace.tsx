import React from "react";
import { TaskSpaceLayout } from "../src/layout";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
interface Task { id: number; name: string; description?: string; status: Status }
const STATUSES: { id: Status; label: string }[] = [
  { id: "NOT_STARTED", label: "Up next" },
  { id: "IN_PROGRESS", label: "Working on it" },
  { id: "COMPLETED", label: "Finished" },
];

/** Replace any markup here with your agent; supply your own authenticated data adapter. */
export function CustomTaskSpace({ tasks, onStatusChange }: {
  tasks: readonly Task[];
  onStatusChange: (id: number, status: Status) => Promise<void>;
}) {
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState<number | null>(null);
  return <>
    {error ? <p role="alert">{error}</p> : null}
    <TaskSpaceLayout columns={STATUSES} renderColumn={(column) => (
      <section style={{ border: "1px solid currentColor", borderRadius: 16, padding: 20 }}>
        <h2>{column.label}</h2>
        {tasks.filter((task) => task.status === column.id).map((task) => (
          <article key={task.id} style={{ marginBlock: 16 }}>
            <h3>{task.name}</h3><p>{task.description}</p>
            <label>Move task <select value={task.status} disabled={pending !== null} onChange={async (event) => {
              setPending(task.id); setError("");
              try { await onStatusChange(task.id, event.target.value as Status); }
              catch { setError("Could not save the task. Try again."); }
              finally { setPending(null); }
            }}>
              {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select></label>
          </article>
        ))}
      </section>
    )} />
  </>;
}

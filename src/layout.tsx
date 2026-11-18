import React, { type ReactNode } from "react";

export interface TaskSpacePreferences {
  version: 1;
  layout: "columns" | "stack";
  density: "comfortable" | "compact";
  showDescription: boolean;
}

export const DEFAULT_PREFERENCES: TaskSpacePreferences = {
  version: 1, layout: "columns", density: "comfortable", showDescription: true,
};

/** Accept only the documented presentation settings, never executable code. */
export function parsePreferences(value: unknown): TaskSpacePreferences {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) {
    return { ...DEFAULT_PREFERENCES };
  }
  const input = value as Partial<TaskSpacePreferences>;
  return {
    version: 1,
    layout: input.layout === "stack" ? "stack" : "columns",
    density: input.density === "compact" ? "compact" : "comfortable",
    showDescription: input.showDescription !== false,
  };
}

/**
 * The application supplies its own columns, cards, controls and drag/drop behavior.
 * A fork can replace every rendered element without gaining any extra API permissions.
 */
export function TaskSpaceLayout<T extends { id: string }>({
  columns, preferences = DEFAULT_PREFERENCES, renderColumn, className,
}: {
  columns: readonly T[];
  preferences?: TaskSpacePreferences;
  renderColumn: (column: T) => ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      data-task-space="v1"
      data-density={preferences.density}
      style={{
        display: "grid",
        gap: preferences.density === "compact" ? 8 : 16,
        gridTemplateColumns: preferences.layout === "stack"
          ? "minmax(0, 1fr)"
          : "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        alignItems: "start",
      }}
    >
      {columns.map((column) => <React.Fragment key={column.id}>{renderColumn(column)}</React.Fragment>)}
    </div>
  );
}

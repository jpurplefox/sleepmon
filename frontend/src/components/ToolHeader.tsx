import type { ReactNode } from "react";

/** A tool's header: its title and, under it, the context bar (design-system §5). */
export function ToolHeader({
  title,
  count,
  action,
  notice,
  children,
}: {
  title: string;
  /** Shown after the title, e.g. the Box's "(6)"; the caller owns its live region. */
  count?: ReactNode;
  /** Primary action, pushed to the right of the title row. */
  action?: ReactNode;
  /** Page-level error, under the title row. */
  notice?: string | null;
  /** The context bar; omitted when the tool has nothing to configure yet. */
  children?: ReactNode;
}) {
  return (
    <header className="tool-head">
      <div className="tool-head__row">
        <h1>{title}</h1>
        {count}
        {action && <div className="tool-head__action">{action}</div>}
      </div>
      {notice && (
        <p className="error" role="alert">
          {notice}
        </p>
      )}
      {children}
    </header>
  );
}

/** The row of settings that shape a tool's numbers. */
export function ContextBar({ children }: { children: ReactNode }) {
  return <div className="ctx-bar">{children}</div>;
}

/** One setting in the context bar: a muted label and its control. */
export function ContextField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ctx-field">
      <span className="ctx-field__label">{label}</span>
      {children}
    </div>
  );
}

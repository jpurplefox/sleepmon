import type React from "react";

interface PlaceholderProps {
  /** Message shown in place of absent content (may include an inline action). */
  children: React.ReactNode;
  /** True while content is loading — adds `aria-busy`. */
  loading?: boolean;
  /** Extra class for spacing tweaks. */
  className?: string;
}

/**
 * The empty/loading placeholder: a centered muted status line that stands in for
 * absent content — an empty list, a search with no matches, or content still
 * loading. It announces itself via `role="status"` (with `aria-busy` while
 * loading). Error states are separate (`.error` + `role="alert"`).
 */
export function Placeholder({ children, loading, className }: PlaceholderProps) {
  return (
    <p
      className={className ? `placeholder ${className}` : "placeholder"}
      role="status"
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {children}
    </p>
  );
}

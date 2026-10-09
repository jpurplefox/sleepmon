/** The operator's contact address (privacy page, deletion help); null when not configured. */
export function readContactEmail(env: { VITE_CONTACT_EMAIL?: string }): string | null {
  return env.VITE_CONTACT_EMAIL || null;
}

export const CONTACT_EMAIL: string | null = readContactEmail(import.meta.env);

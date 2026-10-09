import { ROUTES } from "../routes";
import type { Tool } from "./events";

const TOOLS: Record<string, Tool> = {
  [ROUTES.compare]: "compare",
  [ROUTES.teamAnalysis]: "team_analysis",
  [ROUTES.box]: "box",
  [ROUTES.savedTeams]: "teams",
};

/** The tool a path belongs to, or null for redirects and unknown paths. */
export function toolOf(path: string): Tool | null {
  return TOOLS[path] ?? null;
}

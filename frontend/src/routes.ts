// Route paths, one per top-level tool, so each is directly linkable.
// Slugs are English and language-neutral; UI labels stay bilingual via i18n.
export const ROUTES = {
  box: "/box",
  compare: "/compare",
  teamAnalysis: "/team-analysis",
  savedTeams: "/teams",
} as const;

// Navigation entries in display order: the analysis tools first (they work signed
// out, so they are the way in), then what you keep ("My box", "My teams"), each group
// ordered Pokémon then team. A new `group` starts behind a separator. `labelKey`
// reuses the existing i18n nav.* keys.
export const NAV_ITEMS: ReadonlyArray<{ path: string; labelKey: string; group: "analysis" | "saved" }> = [
  { path: ROUTES.compare, labelKey: "nav.comparison", group: "analysis" },
  { path: ROUTES.teamAnalysis, labelKey: "nav.teams", group: "analysis" },
  { path: ROUTES.box, labelKey: "nav.team", group: "saved" },
  { path: ROUTES.savedTeams, labelKey: "nav.savedTeams", group: "saved" },
];

// Where "/" and unknown paths land: the first tool.
export const HOME = NAV_ITEMS[0].path;

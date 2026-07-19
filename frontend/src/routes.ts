// Route paths, one per top-level tool, so each is directly linkable.
// Slugs are English and language-neutral; UI labels stay bilingual via i18n.
export const ROUTES = {
  box: "/box",
  compare: "/compare",
  teamAnalysis: "/team-analysis",
} as const;

// Navigation entries in display order. `labelKey` reuses the existing i18n
// nav.* keys so the tab bar keeps its bilingual labels.
export const NAV_ITEMS: ReadonlyArray<{ path: string; labelKey: string }> = [
  { path: ROUTES.box, labelKey: "nav.team" },
  { path: ROUTES.compare, labelKey: "nav.comparison" },
  { path: ROUTES.teamAnalysis, labelKey: "nav.teams" },
];

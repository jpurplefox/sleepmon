// The scrolling lists of the dropdowns that can open inside a modal.
const SCROLLERS = ".filter-list, .filter-grid, .nature-dropdown, .subskill-dropdown, .species-options";
// Below this the list is too short to use: keep it taller and bring it into view.
export const MIN_LIST_HEIGHT = 160;
const GAP = 8;

// Shrinks an opened dropdown's list to the room left in the body's visible area,
// so only the list scrolls — never the list and the body.
export function fitDropdown(scroller: HTMLElement, body: HTMLElement): void {
  let pop: HTMLElement | null = scroller;
  while (pop && pop !== body && getComputedStyle(pop).position !== "absolute") pop = pop.parentElement;
  if (!pop || pop === body) return;

  scroller.style.maxHeight = "";
  const list = scroller.getBoundingClientRect();
  const chrome = pop.getBoundingClientRect().bottom - list.bottom;
  const room = body.getBoundingClientRect().bottom - GAP - chrome - list.top;
  if (room >= list.height) return;
  scroller.style.maxHeight = `${Math.max(room, MIN_LIST_HEIGHT)}px`;
  if (room < MIN_LIST_HEIGHT) pop.scrollIntoView?.({ block: "nearest" });
}

// Fits every dropdown list as it opens inside `body`. Returns the clean-up.
export function fitDropdownsIn(body: HTMLElement): () => void {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const found = [...node.querySelectorAll<HTMLElement>(SCROLLERS)];
        if (node.matches(SCROLLERS)) found.unshift(node);
        found.forEach((scroller) => fitDropdown(scroller, body));
      });
    }
  });
  observer.observe(body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

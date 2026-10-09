import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { NEUTRAL_MAP } from "./comparisonMap";
import { ComparisonSessionProvider, useComparisonSession } from "./comparisonSession";
import { newEntry } from "./roster";
import type { MemberInput } from "./types";

const config = { species: "Pikachu" } as unknown as MemberInput;

// Stands in for the Comparison page: it reads and edits the session.
function Page() {
  const { entries, setEntries, map, setMap } = useComparisonSession();
  return (
    <>
      <p>cards: {entries.map((e) => e.config.species).join(",")}</p>
      <p>island: {map.island ?? "none"}</p>
      <button onClick={() => setEntries((prev) => [...prev, newEntry(config)])}>add</button>
      <button onClick={() => setMap({ ...map, island: "Cyan Beach" })}>map</button>
    </>
  );
}

// Leaving the tool unmounts its page; the provider sits above the routes.
function Shell() {
  const [onPage, setOnPage] = useState(true);
  return (
    <ComparisonSessionProvider>
      <button onClick={() => setOnPage((v) => !v)}>toggle</button>
      {onPage && <Page />}
    </ComparisonSessionProvider>
  );
}

describe("comparison session", () => {
  it("starts empty with the neutral map", () => {
    render(<Shell />);
    expect(screen.getByText("cards:")).toBeInTheDocument();
    expect(screen.getByText(`island: ${NEUTRAL_MAP.island ?? "none"}`)).toBeInTheDocument();
  });

  it("keeps the cards and the map when the page unmounts and comes back", () => {
    render(<Shell />);
    act(() => screen.getByText("add").click());
    act(() => screen.getByText("map").click());

    act(() => screen.getByText("toggle").click()); // go to another tool
    expect(screen.queryByText(/cards:/)).toBeNull();
    act(() => screen.getByText("toggle").click()); // come back

    expect(screen.getByText("cards: Pikachu")).toBeInTheDocument();
    expect(screen.getByText("island: Cyan Beach")).toBeInTheDocument();
  });
});

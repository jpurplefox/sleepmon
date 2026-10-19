import "@fontsource-variable/sora";

import { AccessTable } from "./AccessTable";
import { FAQ_ID } from "./content";
import { Faq } from "./Faq";
import { LandingHero } from "./LandingHero";
import { UseCases } from "./UseCases";
import { useHashScroll } from "./useHashScroll";

/** The public page at "/" (PRD 0023): what sleepmon is for, and its FAQ. */
export function Landing() {
  useHashScroll(FAQ_ID);
  return (
    <div className="landing">
      <div className="landing__inner">
        <LandingHero />
        <UseCases />
        <AccessTable />
        <Faq />
      </div>
    </div>
  );
}

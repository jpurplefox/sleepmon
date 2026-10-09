// The usage-event catalogue of PRD 0017, as a closed type: an event or property
// not listed here does not compile. Change it together with the PRD.
import type { Lang } from "../i18n";

export type Tool = "compare" | "team_analysis" | "box" | "teams";
export type AddSource = "new" | "box" | "box_compare" | "clone";
export type BoxOrigin = "box" | "compare" | "team_analysis" | "team_save";
export type SignInReason = "page_gate" | "my_pokemon" | "save_to_box";
export type ProfileSection = "kitchen" | "recipes" | "areas" | "sleep";
export type BoxFilter = "type" | "ingredient" | "skill" | "specialty";
export type TeamsFilter = "map" | "dish_type" | "pokemon";
export type BoxSortKey = "dex" | "level" | "berries" | "strength" | "ingredients";
type NoProps = Record<string, never>;

export interface TeamSavedProps {
  kind: "new" | "overwrite" | "save_as";
  slots: number;
  split_slots: number;
  members_from_box: number;
  members_created: number;
  has_map: boolean;
  expert_map: boolean;
  meals: number;
}

export type AnalyticsEvent =
  | { name: "tool_viewed"; props: { tool: Tool } }
  | { name: "pokemon_added"; props: { tool: "compare"; source: AddSource; species: string } }
  | {
      name: "pokemon_added";
      props: { tool: "team_analysis"; source: "new" | "box"; slot: "single" | "split"; species: string };
    }
  | { name: "box_pokemon_saved"; props: { origin: BoxOrigin; action: "create" | "update"; species: string } }
  | { name: "box_pokemon_deleted"; props: { teams_affected: number } }
  | { name: "list_filtered"; props: { list: "box"; filter: BoxFilter } | { list: "teams"; filter: TeamsFilter } }
  | { name: "list_sorted"; props: { list: "box"; key: BoxSortKey; direction: "asc" | "desc" } }
  | { name: "team_saved"; props: TeamSavedProps }
  | { name: "team_opened"; props: { members_missing: number } }
  | { name: "team_renamed"; props: NoProps }
  | { name: "team_deleted"; props: NoProps }
  | { name: "map_set"; props: { tool: "compare" | "team_analysis"; island: string; expert: boolean } }
  | { name: "dish_type_set"; props: { dish_type: string } }
  | { name: "meals_set"; props: { meals: number } }
  | { name: "event_effect_added"; props: { effect: string; scope: "team" | "type" | "specialty" } }
  | { name: "good_camp_ticket_set"; props: { on: boolean } }
  | { name: "profile_saved"; props: { from: "profile" | "team_analysis"; sections: ProfileSection[] } }
  | { name: "language_changed"; props: { language: Lang } }
  | { name: "sign_in_prompted"; props: { reason: SignInReason } }
  | { name: "sign_in_completed"; props: { reason: SignInReason | "app_bar" } }
  | { name: "sign_in_abandoned"; props: { reason: SignInReason } }
  | { name: "sign_in_failed"; props: NoProps }
  | { name: "signed_out"; props: NoProps }
  | { name: "species_missing"; props: { species: string; tool: "compare" | "team_analysis" } }
  | { name: "compare_limit_reached"; props: NoProps };

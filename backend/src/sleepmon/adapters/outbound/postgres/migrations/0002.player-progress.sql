-- Player progress: what the user has unlocked in the game (PRD 0011). One row per
-- user; the three mappings are JSONB documents owned entirely by that row and never
-- queried by their inner keys.

CREATE TABLE player_progress (
    user_id          UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    -- Pot capacity: a step of the game's ladder, base 21.
    pot_size         INTEGER     NOT NULL DEFAULT 21,
    -- {"Beanburger Curry": 30} — only levels above the default of 1.
    recipe_levels    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- {"Curry": "Beanburger Curry"} — at most one entry per dish type.
    favorite_recipes JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- {"Cyan Beach": 42} — percentage points, only areas above 0.
    area_bonuses     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

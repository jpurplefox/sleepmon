-- Saved teams (PRD 0016): a named line-up of Box entries plus its map and meals.
-- Slots, favorite berries and meals are JSONB documents owned entirely by the row
-- and never queried by their inner keys.

CREATE TABLE saved_team (
    id               UUID PRIMARY KEY,
    user_id          UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- Trimmed, 1..40 characters; unique per user ignoring case (index below).
    name             TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    -- Island value, or NULL for "no map".
    island           TEXT        NULL,
    -- ["Oran", "Pecha"] — Berry values, at most 3.
    favorite_berries JSONB       NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(favorite_berries) = 'array'),
    main_favorite    TEXT        NULL,
    weekly_bonus     TEXT        NOT NULL,
    -- RecipeType value, or NULL for no dish type.
    dish_type        TEXT        NULL,
    -- ["Fancy Apple Curry", null, null] — always three entries.
    meals            JSONB       NOT NULL
        CHECK (jsonb_typeof(meals) = 'array' AND jsonb_array_length(meals) = 3),
    -- [{"members": ["<team_member uuid>", ...], "share": 0.6}] — 1..5 slots. Members
    -- are Box entries; the application detaches them when a Box entry is deleted.
    slots            JSONB       NOT NULL
        CHECK (jsonb_typeof(slots) = 'array' AND jsonb_array_length(slots) BETWEEN 1 AND 5),
    saved_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX saved_team_user_idx ON saved_team (user_id);

-- Backstop for the application's check: one name per user, ignoring case.
CREATE UNIQUE INDEX saved_team_user_name_key ON saved_team (user_id, lower(name));

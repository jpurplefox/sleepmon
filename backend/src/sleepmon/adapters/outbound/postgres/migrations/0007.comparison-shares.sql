-- Shared comparisons (PRD 0020): a frozen copy of a comparison's cards and map terms,
-- plus the image the sharer's device rendered for the link preview. Read by id only
-- (the link is the capability); goes with the sharer's account.

CREATE TABLE comparison_share (
    -- 12 URL-safe characters, random.
    id          TEXT        PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 32),
    user_id     UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- [{"species": "Pikachu", "level": 30, "nature": "Adamant", "ingredients": [...],
    --   "sub_skills": [...], "ribbon": "", "skill_level": 1, "versatile_skill": null}]
    members     JSONB       NOT NULL
        CHECK (jsonb_typeof(members) = 'array' AND jsonb_array_length(members) BETWEEN 1 AND 5),
    -- Expert Island value, or NULL for Normal.
    island      TEXT        NULL,
    -- Positional slots, null for an open one: ["Oran", null, "Pecha"].
    favorites   JSONB       NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(favorites) = 'array'),
    weekly_bonus TEXT       NOT NULL,
    language    TEXT        NOT NULL,
    image_type  TEXT        NOT NULL,
    image       BYTEA       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX comparison_share_user_idx ON comparison_share (user_id);

-- Shared comparisons (PRD 0020): a frozen copy of a comparison's cards, map terms and
-- the sharer's sleep schedule, plus the image the sharer's device rendered for the link
-- preview. Read by id only (the link is the capability). Created signed in, it goes with
-- the account; signed out, it belongs to no one. Either way it expires 90 days after it
-- was last opened (checked on read; expired rows are deleted when a new share is made).

CREATE TABLE comparison_share (
    id             TEXT        PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 32),
    user_id        UUID        NULL REFERENCES app_user (id) ON DELETE CASCADE,
    members        JSONB       NOT NULL
        CHECK (jsonb_typeof(members) = 'array' AND jsonb_array_length(members) BETWEEN 1 AND 5),
    island         TEXT        NULL,
    favorites      JSONB       NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(favorites) = 'array'),
    weekly_bonus   TEXT        NOT NULL,
    language       TEXT        NOT NULL,
    night_minutes  INTEGER     NOT NULL,
    nap_minutes    INTEGER     NULL,
    image_type     TEXT        NOT NULL,
    image          BYTEA       NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX comparison_share_user_idx ON comparison_share (user_id);
CREATE INDEX comparison_share_last_opened_idx ON comparison_share (last_opened_at);

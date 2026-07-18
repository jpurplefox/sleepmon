-- Initial sleepmon schema: authentication (users + refresh tokens) and the
-- Pokémon Sleep team (member + normalized child tables, one row per slot).

-- Users (Google identity).
CREATE TABLE app_user (
    id           UUID PRIMARY KEY,
    google_sub   TEXT NOT NULL UNIQUE,
    email        TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rotatable refresh tokens, grouped by family so the whole chain can be revoked
-- on reuse.
CREATE TABLE refresh_token (
    id          UUID PRIMARY KEY,
    family_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    consumed    BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refresh_token_family_idx ON refresh_token (family_id);

CREATE INDEX refresh_token_expires_idx ON refresh_token (expires_at);

-- Team member, owned by a user.
CREATE TABLE team_member (
    id          UUID PRIMARY KEY,
    species     TEXT        NOT NULL,
    level       INTEGER     NOT NULL,
    nature      TEXT        NOT NULL,
    ribbon      TEXT        NOT NULL DEFAULT '',
    skill_level INTEGER     NOT NULL DEFAULT 1,
    user_id     UUID        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX team_member_user_idx ON team_member (user_id);

-- Sub skills and ingredients per slot, cascade-deleted with the member.
CREATE TABLE team_member_subskill (
    member_id  UUID    NOT NULL REFERENCES team_member (id) ON DELETE CASCADE,
    slot       INTEGER NOT NULL,
    sub_skill  TEXT    NOT NULL,
    PRIMARY KEY (member_id, slot)
);

CREATE TABLE team_member_ingredient (
    member_id   UUID    NOT NULL REFERENCES team_member (id) ON DELETE CASCADE,
    slot        INTEGER NOT NULL,
    ingredient  TEXT    NOT NULL,
    PRIMARY KEY (member_id, slot)
);

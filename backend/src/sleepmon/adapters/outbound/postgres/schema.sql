-- Esquema del equipo de Pokémon Sleep.
-- Tablas hijas normalizadas (sub skills e ingredientes por slot) con borrado en
-- cascada desde el miembro.

CREATE TABLE IF NOT EXISTS team_member (
    id          UUID PRIMARY KEY,
    species     TEXT        NOT NULL,
    nickname    TEXT,
    level       INTEGER     NOT NULL,
    nature      TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_member_subskill (
    member_id  UUID    NOT NULL REFERENCES team_member (id) ON DELETE CASCADE,
    slot       INTEGER NOT NULL,
    sub_skill  TEXT    NOT NULL,
    PRIMARY KEY (member_id, slot)
);

CREATE TABLE IF NOT EXISTS team_member_ingredient (
    member_id   UUID    NOT NULL REFERENCES team_member (id) ON DELETE CASCADE,
    slot        INTEGER NOT NULL,
    ingredient  TEXT    NOT NULL,
    PRIMARY KEY (member_id, slot)
);

-- Esquema del equipo de Pokémon Sleep.
-- Tablas hijas normalizadas (sub skills e ingredientes por slot) con borrado en
-- cascada desde el miembro.

CREATE TABLE IF NOT EXISTS team_member (
    id          UUID PRIMARY KEY,
    species     TEXT        NOT NULL,
    level       INTEGER     NOT NULL,
    nature      TEXT        NOT NULL,
    ribbon      TEXT        NOT NULL DEFAULT '',
    skill_level INTEGER     NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alta idempotente del listón para bases ya creadas (migrate corre el schema entero).
ALTER TABLE team_member ADD COLUMN IF NOT EXISTS ribbon TEXT NOT NULL DEFAULT '';
-- Alta idempotente del nivel de skill para bases ya creadas.
ALTER TABLE team_member ADD COLUMN IF NOT EXISTS skill_level INTEGER NOT NULL DEFAULT 1;

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

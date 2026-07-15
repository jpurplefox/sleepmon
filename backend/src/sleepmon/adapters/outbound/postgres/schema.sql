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

-- Autenticación: usuarios (identidad de Google) y tokens de refresco (rotables,
-- agrupados por familia para poder revocar toda la cadena ante un reuso).
CREATE TABLE IF NOT EXISTS app_user (
    id           UUID PRIMARY KEY,
    google_sub   TEXT NOT NULL UNIQUE,
    email        TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_token (
    id          UUID PRIMARY KEY,
    family_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    consumed    BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_token_family_idx ON refresh_token (family_id);
CREATE INDEX IF NOT EXISTS refresh_token_expires_idx ON refresh_token (expires_at);

-- Clean slate: legacy prototype members have no owner and are discarded (PRD 0010).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'team_member' AND column_name = 'user_id') THEN
    DELETE FROM team_member;
  END IF;
END $$;

ALTER TABLE team_member ADD COLUMN IF NOT EXISTS user_id UUID
  NOT NULL REFERENCES app_user (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS team_member_user_idx ON team_member (user_id);

-- Mew's chosen Versatile skill (a main skill name); NULL for every other species.

ALTER TABLE team_member
    ADD COLUMN versatile_skill TEXT NULL;

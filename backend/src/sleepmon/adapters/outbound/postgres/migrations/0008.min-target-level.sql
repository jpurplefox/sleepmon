-- Minimum target level (PRD 0021): the Box aims every Pokémon below it straight at it.
-- NULL = no minimum (each Pokémon aims at its next unlock level).

ALTER TABLE player_progress
    ADD COLUMN min_target_level SMALLINT NULL
        CHECK (min_target_level IS NULL OR min_target_level IN (10, 25, 30, 50, 60, 70));

-- Sleep schedule (PRD 0015): the night and an optional nap, in minutes on a
-- 15-minute grid. The defaults read as the game's 100-point night, no nap.

ALTER TABLE player_progress
    ADD COLUMN night_minutes INTEGER NOT NULL DEFAULT 510
        CHECK (night_minutes BETWEEN 90 AND 720 AND night_minutes % 15 = 0),
    ADD COLUMN nap_minutes INTEGER NULL
        CHECK (nap_minutes IS NULL OR (nap_minutes BETWEEN 90 AND 240 AND nap_minutes % 15 = 0)),
    ADD CONSTRAINT player_progress_total_sleep
        CHECK (night_minutes + COALESCE(nap_minutes, 0) <= 840);

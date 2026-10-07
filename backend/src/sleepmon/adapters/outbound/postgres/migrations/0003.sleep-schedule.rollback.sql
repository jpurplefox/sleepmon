ALTER TABLE player_progress
    DROP CONSTRAINT player_progress_total_sleep,
    DROP COLUMN nap_minutes,
    DROP COLUMN night_minutes;

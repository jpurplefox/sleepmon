-- Screenshot imports (PRD 0019): how many reads each user made per UTC day, for the
-- daily cap. One small row per user-day; old rows are harmless and never read.

CREATE TABLE screenshot_import_usage (
    user_id UUID    NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    day     DATE    NOT NULL,
    reads   INTEGER NOT NULL CHECK (reads >= 0),
    PRIMARY KEY (user_id, day)
);

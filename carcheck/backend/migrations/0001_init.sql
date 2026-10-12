-- Run using: npx wrangler d1 migrations apply carscope-history --remote
-- Records are public vehicle metrics only. No personal identity data is stored.
CREATE TABLE IF NOT EXISTS odometer_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT NOT NULL CHECK(length(plate) IN (7,8)),
  mileage_km INTEGER NOT NULL CHECK(mileage_km>=0),
  reading_date TEXT NOT NULL,
  date_type TEXT NOT NULL CHECK(date_type IN ('test_date','first_observed_date','historical_source')),
  source TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(plate,mileage_km,reading_date,date_type,source)
);
CREATE INDEX IF NOT EXISTS odometer_plate_date ON odometer_observations (plate, reading_date);
CREATE TABLE IF NOT EXISTS watched_plates (
  plate TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  next_check_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS watched_due ON watched_plates (next_check_at);
CREATE TABLE IF NOT EXISTS price_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_year INTEGER NOT NULL,
  trim TEXT,
  asking_price_ils INTEGER NOT NULL,
  listing_date TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('asking_price','sold_price')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (manufacturer,model_name,model_year,source_url)
);
CREATE INDEX IF NOT EXISTS price_model_year ON price_observations (manufacturer,model_name,model_year);

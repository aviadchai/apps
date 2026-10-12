-- Additional provenance for licensed historical readings and court-admissibility review.
ALTER TABLE odometer_observations ADD COLUMN source_url TEXT;
ALTER TABLE odometer_observations ADD COLUMN evidence_type TEXT;

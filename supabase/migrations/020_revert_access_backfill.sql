-- Revert faulty backfill: set access='public' back to NULL
-- The 018 migration wrongly marked all courts with numeric osm_id as 'public',
-- even when OSM had no explicit access tag. Courts without an explicit OSM access
-- tag should show "unknown" so users are warned.
UPDATE courts SET access = NULL WHERE access = 'public';
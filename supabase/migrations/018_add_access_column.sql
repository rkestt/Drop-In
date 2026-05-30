-- Add access column to courts table (public/private from OSM access tag)
ALTER TABLE courts ADD COLUMN IF NOT EXISTS access TEXT DEFAULT NULL;

-- Backfill access from OSM data where available
-- Common OSM access values: yes, private, permissive, restricted, no, permit
UPDATE courts SET access = 'public' WHERE access IS NULL AND (
  osm_id IN (
    SELECT osm_id FROM courts WHERE osm_id ~ '^[0-9]+$'
  )
);

-- Mark courts with restricted/private access
UPDATE courts SET access = 'private' WHERE access IS NULL AND venue_type IN ('field_multi', 'field_basketball', 'field_soccer');
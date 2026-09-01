-- Backfill location for any row inserted before the trigger existed
UPDATE courts
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

-- Courts inside a viewport bounding box (uses GIST index idx_courts_location on `location`)
CREATE OR REPLACE FUNCTION courts_in_viewport(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_results INTEGER DEFAULT 2000
)
RETURNS SETOF courts
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM courts
  WHERE status = 'active'
    AND location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  LIMIT max_results;
$$;
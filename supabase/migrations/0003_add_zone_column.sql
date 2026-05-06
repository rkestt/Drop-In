-- Add zone column to courts table
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text matching if needed later

ALTER TABLE courts ADD COLUMN IF NOT EXISTS zone TEXT;

-- Populate zone from address (municipio / area)
-- Address format: "Street, ZonePart, City"
-- We extract the 2nd comma-separated part
UPDATE courts
SET zone = TRIM(SPLIT_PART(address, ',', 2))
WHERE address IS NOT NULL AND zone IS NULL;

-- Normalize some common zone names for cleaner UI
UPDATE courts SET zone = 'Trieste' WHERE zone ~* 'trieste';
UPDATE courts SET zone = 'Parioli' WHERE zone ~* 'parioli';
UPDATE courts SET zone = 'Cinecittà' WHERE zone ~* 'cinecitt';
UPDATE courts SET zone = 'Centocelle' WHERE zone ~* 'centocelle';
UPDATE courts SET zone = 'Aurelio' WHERE zone ~* 'aurelio';
UPDATE courts SET zone = 'Portuense' WHERE zone ~* 'portuense';
UPDATE courts SET zone = 'Val Melaina' WHERE zone ~* 'val melaina';
UPDATE courts SET zone = 'Ponte Mammolo' WHERE zone ~* 'ponte mammolo';
UPDATE courts SET zone = 'EUR' WHERE zone ~* 'e\.u\.r|eur';
UPDATE courts SET zone = 'Flaminio' WHERE zone ~* 'flaminio';
UPDATE courts SET zone = 'Ciampino' WHERE zone ~* 'ciampino';
UPDATE courts SET zone = 'Torre Maura' WHERE zone ~* 'torre maura';
UPDATE courts SET zone = 'Casal Boccone' WHERE zone ~* 'casal boccone';

-- Normalize Municipio names (remove leading space)
UPDATE courts SET zone = TRIM(zone);
UPDATE courts SET zone = REPLACE(zone, 'Municipio Roma ', 'Mun. ');

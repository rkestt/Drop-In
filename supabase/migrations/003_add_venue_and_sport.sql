-- Add venue_type and sport columns to courts table
ALTER TABLE courts
ADD COLUMN venue_type TEXT DEFAULT 'field_multi',
ADD COLUMN sport TEXT;

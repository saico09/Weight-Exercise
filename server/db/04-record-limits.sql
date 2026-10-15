BEGIN;
ALTER TABLE weight_records DROP CONSTRAINT IF EXISTS weight_records_id_check;
ALTER TABLE weight_records ADD CONSTRAINT weight_records_id_check CHECK (length(id) BETWEEN 1 AND 200);
ALTER TABLE weight_records DROP CONSTRAINT IF EXISTS weight_records_weight_kg_check;
ALTER TABLE weight_records ADD CONSTRAINT weight_records_weight_kg_check CHECK (weight_kg >= 10 AND weight_kg <= 650);
COMMIT;

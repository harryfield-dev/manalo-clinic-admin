ALTER TABLE patients
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS suspended_until timestamp;

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS suspension_reason text;

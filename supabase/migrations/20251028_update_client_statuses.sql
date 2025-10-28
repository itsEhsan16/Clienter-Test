-- Update existing clients: map old statuses to new ones
UPDATE clients SET status = CASE
  WHEN status = 'prospect' THEN 'uncertain'
  WHEN status = 'active' THEN 'ongoing'
  WHEN status NOT IN ('prospect', 'active', 'completed') THEN 'uncertain'
  ELSE status
END;

-- Drop old constraint
ALTER TABLE clients DROP CONSTRAINT clients_status_check;

-- Add new constraint
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN ('uncertain', 'potential', 'ongoing', 'completed'));

-- Update default status
ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'uncertain';
-- Add order column to clients table for kanban ordering
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS clients_status_order_idx ON clients(status, "order");

-- Update existing clients to have sequential order within each status
-- This ensures existing clients have proper ordering
WITH ordered_clients AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) - 1 as new_order
  FROM clients
)
UPDATE clients
SET "order" = ordered_clients.new_order
FROM ordered_clients
WHERE clients.id = ordered_clients.id;
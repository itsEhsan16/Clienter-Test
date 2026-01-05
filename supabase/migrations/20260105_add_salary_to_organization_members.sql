-- Add monthly salary field to organization_members
-- This is optional field for team members who have monthly salary instead of project-based pay

-- Only add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'monthly_salary'
    ) THEN
        ALTER TABLE organization_members 
        ADD COLUMN monthly_salary DECIMAL(10, 2) DEFAULT NULL;
        
        -- Add comment to document the field
        COMMENT ON COLUMN organization_members.monthly_salary IS 'Optional monthly salary for team members who are on salary instead of project-based payment';
    END IF;
END $$;

-- Add currency column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE profiles ADD COLUMN currency TEXT DEFAULT 'INR';
    RAISE NOTICE 'Added currency column to profiles table';
  ELSE
    RAISE NOTICE 'Currency column already exists in profiles table';
  END IF;
END $$;

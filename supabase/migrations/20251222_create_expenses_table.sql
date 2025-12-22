-- Create expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Row Level Security for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses" 
  ON expenses FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own expenses" 
  ON expenses FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own expenses" 
  ON expenses FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own expenses" 
  ON expenses FOR DELETE 
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX expenses_user_id_idx ON expenses(user_id);

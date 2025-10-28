-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  default_reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  project_description TEXT,
  budget DECIMAL(10, 2),
  advance_paid DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2),
  status TEXT DEFAULT 'uncertain' CHECK (status IN ('uncertain', 'potential', 'ongoing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Row Level Security Policies

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" 
  ON clients FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own clients" 
  ON clients FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own clients" 
  ON clients FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own clients" 
  ON clients FOR DELETE 
  USING (user_id = auth.uid());

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" 
  ON projects FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own projects" 
  ON projects FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects" 
  ON projects FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects" 
  ON projects FOR DELETE 
  USING (user_id = auth.uid());

-- Meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meetings" 
  ON meetings FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own meetings" 
  ON meetings FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own meetings" 
  ON meetings FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own meetings" 
  ON meetings FOR DELETE 
  USING (user_id = auth.uid());

-- Reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" 
  ON reminders FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reminders" 
  ON reminders FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reminders" 
  ON reminders FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reminders" 
  ON reminders FOR DELETE 
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX clients_user_id_idx ON clients(user_id);
CREATE INDEX clients_status_idx ON clients(status);
CREATE INDEX meetings_user_id_idx ON meetings(user_id);
CREATE INDEX meetings_client_id_idx ON meetings(client_id);
CREATE INDEX meetings_meeting_time_idx ON meetings(meeting_time);
CREATE INDEX reminders_user_id_idx ON reminders(user_id);
CREATE INDEX reminders_meeting_id_idx ON reminders(meeting_id);
CREATE INDEX reminders_remind_at_idx ON reminders(remind_at);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, currency)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'INR'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

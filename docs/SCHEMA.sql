-- OC Maintenance Tracker Database Schema
-- Run in Supabase SQL editor after creating a new project

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  unit_number TEXT,
  email TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  service_type TEXT NOT NULL,
  hourly_rate NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Semi-Annually', 'Annually')),
  estimated_cost NUMERIC(10, 2),
  status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Overdue')),
  start_date DATE NOT NULL,
  last_completed_date DATE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Completions table (audit log)
CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  actual_cost NUMERIC(10, 2),
  notes TEXT
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Profiles: read own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles: update own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: admin insert" ON profiles
  FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies: Vendors
CREATE POLICY "Vendors: authenticated read/write" ON vendors
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Vendors: admin delete" ON vendors
  FOR DELETE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies: Tasks
CREATE POLICY "Tasks: authenticated read/write" ON tasks
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tasks: admin delete" ON tasks
  FOR DELETE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies: Task Completions
CREATE POLICY "Completions: authenticated create" ON task_completions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Completions: authenticated read" ON task_completions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_tasks_vendor_id ON tasks(vendor_id);
CREATE INDEX idx_tasks_start_date ON tasks(start_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_completed_by ON task_completions(completed_by);

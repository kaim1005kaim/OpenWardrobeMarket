-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

-- Create new policies with better permissions
-- Allow anyone to view profiles
CREATE POLICY "Anyone can view profiles" ON user_profiles
  FOR SELECT USING (true);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Authenticated users can create profile" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    auth.uid() IS NOT NULL  -- Allow insert if user is authenticated
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = id);
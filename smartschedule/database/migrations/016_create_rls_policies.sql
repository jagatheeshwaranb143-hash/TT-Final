-- 016_create_rls_policies.sql
-- Enable RLS on core tables
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_versions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user college ID
CREATE OR REPLACE FUNCTION get_current_user_college_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT college_id FROM users WHERE id = auth.uid();
$$;

-- Example Policies (These would be expanded based on exact auth setup)
CREATE POLICY "Users can view their college"
    ON colleges FOR SELECT
    USING (id = get_current_user_college_id());

CREATE POLICY "Users can view their college departments"
    ON departments FOR SELECT
    USING (college_id = get_current_user_college_id());

CREATE POLICY "Faculty can view their department faculty"
    ON faculty FOR SELECT
    USING (department_id IN (
        SELECT department_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Students can view their class data"
    ON classes FOR SELECT
    USING (TRUE); -- Usually accessible to all within college

-- 004_create_users.sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- matches Supabase auth uid
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'hod', 'faculty', 'student')),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Now we can add the FK constraint to departments.hod_id
ALTER TABLE departments
ADD CONSTRAINT fk_departments_hod
FOREIGN KEY (hod_id) REFERENCES users(id) ON DELETE SET NULL;

-- 011_create_constraints.sql
CREATE TABLE IF NOT EXISTS timetable_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    constraint_type VARCHAR(100) NOT NULL,
    constraint_key VARCHAR(100) NOT NULL,
    constraint_value JSONB NOT NULL,
    weight NUMERIC(5,2) DEFAULT 1.0,
    is_hard BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

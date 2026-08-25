-- 009_create_laboratories.sql
CREATE TABLE IF NOT EXISTS laboratories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    building VARCHAR(100),
    capacity INTEGER NOT NULL,
    equipment TEXT[],
    software_list TEXT[],
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    batch_capacity INTEGER NOT NULL,
    supports_multiple_batches BOOLEAN DEFAULT FALSE,
    requires_consecutive_periods BOOLEAN DEFAULT FALSE,
    consecutive_count INTEGER DEFAULT 2,
    available_days TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_availability_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_unavailable BOOLEAN DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_faculty_eligibility (
    lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    PRIMARY KEY (lab_id, faculty_id)
);

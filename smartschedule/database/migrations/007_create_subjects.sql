-- 007_create_subjects.sql
CREATE TABLE IF NOT EXISTS subject_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject_type VARCHAR(50) NOT NULL CHECK (subject_type IN ('theory', 'tutorial', 'practical', 'laboratory', 'seminar', 'project', 'elective', 'activity', 'other')),
    credits NUMERIC(4,2) DEFAULT 0,
    weekly_periods INTEGER NOT NULL,
    lecture_periods INTEGER DEFAULT 0,
    tutorial_periods INTEGER DEFAULT 0,
    practical_periods INTEGER DEFAULT 0,
    semester_number INTEGER,
    requires_lab BOOLEAN DEFAULT FALSE,
    requires_consecutive_periods BOOLEAN DEFAULT FALSE,
    consecutive_count INTEGER DEFAULT 1,
    preferred_days TEXT[],
    restricted_days TEXT[],
    preferred_period_numbers INTEGER[],
    restricted_period_numbers INTEGER[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(faculty_id, subject_id, class_id)
);

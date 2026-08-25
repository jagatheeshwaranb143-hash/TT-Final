-- 012_create_timetables.sql
CREATE TABLE IF NOT EXISTS timetable_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'generated', 'reviewed', 'hod_approved', 'principal_approved', 'published', 'locked', 'archived')),
    quality_score NUMERIC(5,2),
    hard_violations INTEGER DEFAULT 0,
    soft_score NUMERIC(5,2),
    generated_at TIMESTAMP WITH TIME ZONE,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generation_params JSONB,
    hod_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    hod_approved_at TIMESTAMP WITH TIME ZONE,
    principal_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    principal_approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, semester_id, version_number)
);

CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES timetable_versions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    lab_id UUID REFERENCES laboratories(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    period_number INTEGER NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

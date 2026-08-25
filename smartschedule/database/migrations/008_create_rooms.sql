-- 008_create_rooms.sql
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    building VARCHAR(100),
    room_number VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    capacity INTEGER NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    has_projector BOOLEAN DEFAULT FALSE,
    has_ac BOOLEAN DEFAULT FALSE,
    available_days TEXT[],
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_availability_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_unavailable BOOLEAN DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add room_id FK to classes table
ALTER TABLE classes
ADD CONSTRAINT fk_classes_room
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

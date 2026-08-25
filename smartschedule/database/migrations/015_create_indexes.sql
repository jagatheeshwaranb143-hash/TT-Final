-- 015_create_indexes.sql
-- Indexes for timetable_entries
CREATE UNIQUE INDEX idx_timetable_class_slot ON timetable_entries(version_id, day_of_week, period_number, class_id);
CREATE UNIQUE INDEX idx_timetable_faculty_slot ON timetable_entries(version_id, day_of_week, period_number, faculty_id);
CREATE UNIQUE INDEX idx_timetable_room_slot ON timetable_entries(version_id, day_of_week, period_number, room_id) WHERE room_id IS NOT NULL;

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_college_id ON users(college_id);

-- GIN Indexes for text search (requires pg_trgm extension)
CREATE INDEX idx_users_full_name_trgm ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_subjects_name_trgm ON subjects USING gin (name gin_trgm_ops);
CREATE INDEX idx_rooms_display_name_trgm ON rooms USING gin (display_name gin_trgm_ops);

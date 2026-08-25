/// SmartSchedule — User Model
/// Maps 1-to-1 with the users table and the backend /auth/me response.
class AppUser {
  final String id;
  final String email;
  final String fullName;
  final UserRole role;
  final String? collegeId;
  final String? departmentId;
  final bool isActive;

  const AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.collegeId,
    this.departmentId,
    this.isActive = true,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String,
      role: UserRole.fromString(json['role'] as String? ?? 'student'),
      collegeId: json['college_id'] as String?,
      departmentId: json['department_id'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
    'role': role.value,
    'college_id': collegeId,
    'department_id': departmentId,
    'is_active': isActive,
  };

  AppUser copyWith({
    String? fullName,
    String? collegeId,
    String? departmentId,
  }) {
    return AppUser(
      id: id,
      email: email,
      fullName: fullName ?? this.fullName,
      role: role,
      collegeId: collegeId ?? this.collegeId,
      departmentId: departmentId ?? this.departmentId,
      isActive: isActive,
    );
  }

  String get displayInitials {
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  }

  String get roleDisplayName => role.displayName;
}

enum UserRole {
  superAdmin('super_admin', 'Principal / Admin'),
  hod('hod', 'Head of Department'),
  faculty('faculty', 'Faculty'),
  student('student', 'Student');

  final String value;
  final String displayName;

  const UserRole(this.value, this.displayName);

  factory UserRole.fromString(String value) {
    return UserRole.values.firstWhere(
      (r) => r.value == value,
      orElse: () => UserRole.student,
    );
  }
}

/// A single timetable entry
class TimetableEntry {
  final String id;
  final String versionId;
  final String classId;
  final String subjectId;
  final String facultyId;
  final String? roomId;
  final String? labId;
  final String? batchId;
  final int dayOfWeek;
  final int periodNumber;
  final bool isLocked;
  final String? notes;

  // Populated from joined queries
  final String? subjectName;
  final String? subjectCode;
  final String? subjectType;
  final String? facultyName;
  final String? roomName;
  final String? labName;
  final String? startTime;
  final String? endTime;

  const TimetableEntry({
    required this.id,
    required this.versionId,
    required this.classId,
    required this.subjectId,
    required this.facultyId,
    this.roomId,
    this.labId,
    this.batchId,
    required this.dayOfWeek,
    required this.periodNumber,
    this.isLocked = false,
    this.notes,
    this.subjectName,
    this.subjectCode,
    this.subjectType,
    this.facultyName,
    this.roomName,
    this.labName,
    this.startTime,
    this.endTime,
  });

  factory TimetableEntry.fromJson(Map<String, dynamic> json) {
    return TimetableEntry(
      id: json['id'] as String,
      versionId: json['version_id'] as String? ?? '',
      classId: json['class_id'] as String,
      subjectId: json['subject_id'] as String,
      facultyId: json['faculty_id'] as String,
      roomId: json['room_id'] as String?,
      labId: json['lab_id'] as String?,
      batchId: json['batch_id'] as String?,
      dayOfWeek: json['day_of_week'] as int,
      periodNumber: json['period_number'] as int,
      isLocked: json['is_locked'] as bool? ?? false,
      notes: json['notes'] as String?,
      subjectName: json['subject_name'] as String?,
      subjectCode: json['subject_code'] as String?,
      subjectType: json['subject_type'] as String?,
      facultyName: json['faculty_name'] as String?,
      roomName: json['room_name'] as String?,
      labName: json['lab_name'] as String?,
      startTime: json['start_time'] as String?,
      endTime: json['end_time'] as String?,
    );
  }

  String get dayName {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dayOfWeek >= 0 && dayOfWeek < days.length) return days[dayOfWeek];
    return 'Day $dayOfWeek';
  }

  String get fullDayName {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (dayOfWeek >= 0 && dayOfWeek < days.length) return days[dayOfWeek];
    return 'Day $dayOfWeek';
  }

  String get locationName => labName ?? roomName ?? 'TBD';
}

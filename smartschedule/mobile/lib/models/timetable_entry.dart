class TimetableEntry {
  final String id;
  final String subjectName;
  final String subjectCode;
  final String subjectType;
  final String facultyName;
  final String? roomDisplay;
  final String? labName;
  final int dayOfWeek;
  final int periodNumber;
  final String startTime;
  final String endTime;
  final bool isLocked;
  
  const TimetableEntry({
    required this.id,
    required this.subjectName,
    required this.subjectCode,
    required this.subjectType,
    required this.facultyName,
    this.roomDisplay,
    this.labName,
    required this.dayOfWeek,
    required this.periodNumber,
    required this.startTime,
    required this.endTime,
    this.isLocked = false,
  });
  
  factory TimetableEntry.fromJson(Map<String, dynamic> json) => TimetableEntry(
    id: json['id'],
    subjectName: json['subject_name'],
    subjectCode: json['subject_code'],
    subjectType: json['subject_type'],
    facultyName: json['faculty_name'],
    roomDisplay: json['room_display'],
    labName: json['lab_name'],
    dayOfWeek: json['day_of_week'],
    periodNumber: json['period_number'],
    startTime: json['start_time'],
    endTime: json['end_time'],
    isLocked: json['is_locked'] ?? false,
  );
}

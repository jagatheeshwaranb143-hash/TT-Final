import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import 'auth_provider.dart';

// Providers
final apiServiceProvider = Provider<ApiService>((ref) {
  final token = ref.watch(authTokenProvider);
  return ApiService(token: token);
});

final classTimetableProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, classId) async {
    final api = ref.watch(apiServiceProvider);
    return api.getClassTimetable(classId);
  },
);

final facultyTimetableProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, facultyId) async {
    final api = ref.watch(apiServiceProvider);
    return api.getFacultyTimetable(facultyId);
  },
);

final generationStatusProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, jobId) async {
    final api = ref.watch(apiServiceProvider);
    return api.getGenerationStatus(jobId);
  },
);

final notificationsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  return api.getNotifications();
});

final workloadProvider = FutureProvider.family<Map<String, dynamic>, String?>(
  (ref, departmentId) async {
    final api = ref.watch(apiServiceProvider);
    return api.getFacultyWorkload(departmentId: departmentId);
  },
);

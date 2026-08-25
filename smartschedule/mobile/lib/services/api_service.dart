import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// SmartSchedule API Client
/// Connects to FastAPI backend.
/// Reads API_BASE_URL from compile-time dart-define or defaults to localhost.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  final String? token;

  // Set your backend URL here or pass via --dart-define=API_BASE_URL=...
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000', // Android emulator → localhost
  );

  ApiService({required this.token});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  Uri _url(String path) => Uri.parse('$baseUrl/api/v1$path');

  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    if (response.statusCode == 401) {
      throw const ApiException(
        'Session expired. Please log in again.',
        statusCode: 401,
      );
    }
    if (response.statusCode == 403) {
      throw const ApiException(
        'You do not have permission to perform this action.',
        statusCode: 403,
      );
    }
    if (response.statusCode == 404) {
      final body = _parseBody(response.body);
      throw ApiException(
        body['message'] as String? ?? 'Resource not found.',
        statusCode: 404,
      );
    }
    if (response.statusCode >= 400) {
      final body = _parseBody(response.body);
      throw ApiException(
        body['message'] as String? ?? 'Request failed. Please try again.',
        statusCode: response.statusCode,
      );
    }
    if (response.statusCode == 204) return {};
    return _parseBody(response.body);
  }

  Map<String, dynamic> _parseBody(String body) {
    try {
      return json.decode(body) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  // ─── Auth ───
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        _url('/auth/login'),
        headers: _headers,
        body: json.encode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 15));
      return _handleResponse(response);
    } on SocketException {
      throw const ApiException(
        'Cannot connect to SmartSchedule server. '
        'Ensure the backend is running and your network is connected.',
      );
    }
  }

  Future<void> logout() async {
    try {
      await http.post(_url('/auth/logout'), headers: _headers)
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      // Ignore logout errors — always clear local session
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    final response = await http.get(_url('/auth/me'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ─── Timetable ───
  Future<Map<String, dynamic>> getClassTimetable(String classId, {String? versionId}) async {
    final query = versionId != null ? '?version_id=$versionId' : '';
    final response = await http.get(
      _url('/timetable/class/$classId$query'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> getFacultyTimetable(String facultyId, {String? versionId}) async {
    final query = versionId != null ? '?version_id=$versionId' : '';
    final response = await http.get(
      _url('/timetable/faculty/$facultyId$query'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> generateTimetable(Map<String, dynamic> params) async {
    final response = await http.post(
      _url('/timetable/generate'),
      headers: _headers,
      body: json.encode(params),
    ).timeout(const Duration(seconds: 30));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> getGenerationStatus(String jobId) async {
    final response = await http.get(
      _url('/timetable/status/$jobId'),
      headers: _headers,
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> validateTimetableData({
    required String departmentId,
    required String semesterId,
    required String academicYearId,
  }) async {
    final response = await http.get(
      _url('/timetable/validate-data?department_id=$departmentId&semester_id=$semesterId&academic_year_id=$academicYearId'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  // ─── Versions ───
  Future<Map<String, dynamic>> listVersions({String? departmentId}) async {
    final query = departmentId != null ? '?department_id=$departmentId' : '';
    final response = await http.get(
      _url('/versions$query'),
      headers: _headers,
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> approveHod(String versionId, {String? notes}) async {
    final response = await http.post(
      _url('/versions/$versionId/approve-hod'),
      headers: _headers,
      body: json.encode({'notes': notes}),
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> approvePrincipal(String versionId, {String? notes}) async {
    final response = await http.post(
      _url('/versions/$versionId/approve-principal'),
      headers: _headers,
      body: json.encode({'notes': notes}),
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> publishVersion(String versionId) async {
    final response = await http.post(
      _url('/versions/$versionId/publish'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  // ─── Notifications ───
  Future<Map<String, dynamic>> getNotifications() async {
    final response = await http.get(
      _url('/notifications'),
      headers: _headers,
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  Future<void> markNotificationRead(String notificationId) async {
    await http.patch(
      _url('/notifications/$notificationId/read'),
      headers: _headers,
    ).timeout(const Duration(seconds: 5));
  }

  // ─── Analytics ───
  Future<Map<String, dynamic>> getFacultyWorkload({String? departmentId}) async {
    final query = departmentId != null ? '?department_id=$departmentId' : '';
    final response = await http.get(
      _url('/analytics/workload$query'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  // ─── Search ───
  Future<Map<String, dynamic>> search(String query, {String type = 'all'}) async {
    final response = await http.get(
      _url('/search?q=${Uri.encodeComponent(query)}&type=$type'),
      headers: _headers,
    ).timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ─── AI Assistant ───
  Future<Map<String, dynamic>> askAi(String question) async {
    final response = await http.post(
      _url('/ai/query'),
      headers: _headers,
      body: json.encode({'question': question}),
    ).timeout(const Duration(seconds: 30));
    return _handleResponse(response);
  }
}

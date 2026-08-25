import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/user.dart';

// ─── SharedPreferences provider ───
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('Override in ProviderScope'),
);

// ─── Auth State ───
class AuthState {
  final AppUser? user;
  final String? token;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.token,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => user != null && token != null;

  AuthState copyWith({
    AppUser? user,
    String? token,
    bool? isLoading,
    String? error,
    bool clearError = false,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      token: clearUser ? null : (token ?? this.token),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

// ─── Auth Notifier ───
class AuthNotifier extends StateNotifier<AuthState> {
  final SharedPreferences _prefs;
  static const _tokenKey = 'smartschedule_token';
  static const _userKey = 'smartschedule_user';

  AuthNotifier(this._prefs) : super(const AuthState(isLoading: true)) {
    _loadFromStorage();
  }

  void _loadFromStorage() {
    final token = _prefs.getString(_tokenKey);
    final userJson = _prefs.getString(_userKey);

    if (token != null && userJson != null) {
      try {
        final user = AppUser.fromJson(json.decode(userJson) as Map<String, dynamic>);
        state = AuthState(user: user, token: token, isLoading: false);
      } catch (_) {
        // Corrupted data — clear it
        _prefs.remove(_tokenKey);
        _prefs.remove(_userKey);
        state = const AuthState(isLoading: false);
      }
    } else {
      state = const AuthState(isLoading: false);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final apiService = ApiService(token: null);
      final result = await apiService.login(email: email, password: password);

      final token = result['access_token'] as String;
      final userMap = result['user'] as Map<String, dynamic>;
      final user = AppUser.fromJson(userMap);

      // Persist to storage
      await _prefs.setString(_tokenKey, token);
      await _prefs.setString(_userKey, json.encode(userMap));

      state = AuthState(user: user, token: token, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractErrorMessage(e),
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    // Best-effort API logout
    try {
      if (state.token != null) {
        final apiService = ApiService(token: state.token);
        await apiService.logout();
      }
    } catch (_) {
      // Ignore logout API errors
    }

    await _prefs.remove(_tokenKey);
    await _prefs.remove(_userKey);
    state = const AuthState(isLoading: false);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  String _extractErrorMessage(Object e) {
    if (e is ApiException) return e.message;
    final msg = e.toString();
    if (msg.contains('SocketException') || msg.contains('Connection refused')) {
      return 'Cannot connect to server. Check your network connection.';
    }
    if (msg.contains('TimeoutException')) {
      return 'Connection timed out. Please try again.';
    }
    return 'Login failed. Please check your credentials and try again.';
  }
}

// ─── Providers ───
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return AuthNotifier(prefs);
});

// Convenience selectors
final currentUserProvider = Provider<AppUser?>((ref) {
  return ref.watch(authStateProvider).user;
});

final authTokenProvider = Provider<String?>((ref) {
  return ref.watch(authStateProvider).token;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider).isAuthenticated;
});

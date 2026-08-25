import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/student/student_dashboard_screen.dart';
import '../screens/faculty/faculty_dashboard_screen.dart';
import '../screens/hod/hod_dashboard_screen.dart';
import '../screens/principal/principal_dashboard_screen.dart';
import '../screens/shared/timetable_grid_screen.dart';
import '../screens/shared/no_internet_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isAuthenticated = authState.user != null;
      final isOnLogin = state.matchedLocation == '/login';
      final isOnSplash = state.matchedLocation == '/splash';

      // While loading, stay on splash
      if (authState.isLoading && isOnSplash) return null;

      // Not authenticated → login
      if (!isAuthenticated && !isOnLogin && !isOnSplash) {
        return '/login';
      }

      // Authenticated but on login → redirect to role dashboard
      if (isAuthenticated && (isOnLogin || isOnSplash)) {
        return _roleDashboardRoute(authState.user!.role);
      }

      return null;
    },
    routes: [
      // Splash
      GoRoute(
        path: '/splash',
        builder: (context, state) => const _SplashScreen(),
      ),

      // Auth
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Student
      GoRoute(
        path: '/student',
        builder: (context, state) => const StudentDashboardScreen(),
        routes: [
          GoRoute(
            path: 'timetable',
            builder: (context, state) => const TimetableGridScreen(),
          ),
        ],
      ),

      // Faculty
      GoRoute(
        path: '/faculty',
        builder: (context, state) => const FacultyDashboardScreen(),
        routes: [
          GoRoute(
            path: 'timetable',
            builder: (context, state) => const TimetableGridScreen(),
          ),
        ],
      ),

      // HOD
      GoRoute(
        path: '/hod',
        builder: (context, state) => const HodDashboardScreen(),
        routes: [
          GoRoute(
            path: 'timetable/:classId',
            builder: (context, state) => TimetableGridScreen(
              classId: state.pathParameters['classId'],
            ),
          ),
        ],
      ),

      // Principal / Super Admin
      GoRoute(
        path: '/principal',
        builder: (context, state) => const PrincipalDashboardScreen(),
      ),

      // No Internet
      GoRoute(
        path: '/no-internet',
        builder: (context, state) => const NoInternetScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text('Page not found: ${state.uri}'),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.go('/login'),
              child: const Text('Go to Login'),
            ),
          ],
        ),
      ),
    ),
  );
});

String _roleDashboardRoute(String role) {
  switch (role) {
    case 'super_admin':
      return '/principal';
    case 'hod':
      return '/hod';
    case 'faculty':
      return '/faculty';
    case 'student':
      return '/student';
    default:
      return '/login';
  }
}

class _SplashScreen extends ConsumerWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A56DB),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.calendar_month_rounded,
                color: Colors.white,
                size: 48,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'SmartSchedule',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Intelligent College Scheduling',
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 14,
                fontWeight: FontWeight.w400,
              ),
            ),
            const SizedBox(height: 48),
            const SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

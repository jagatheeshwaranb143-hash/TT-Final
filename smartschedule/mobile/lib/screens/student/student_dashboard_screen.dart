import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timetable_provider.dart';
import '../../widgets/period_card_widget.dart';
import '../../widgets/empty_state_widget.dart';

class StudentDashboardScreen extends ConsumerStatefulWidget {
  const StudentDashboardScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends ConsumerState<StudentDashboardScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    // Assuming authProvider exposes a user with classId
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final classId = user?.classId ?? '';
    final timetableAsync = ref.watch(classTimetableProvider(classId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () {},
          ),
        ],
      ),
      body: _selectedIndex == 0
          ? RefreshIndicator(
              onRefresh: () async {
                ref.refresh(classTimetableProvider(classId));
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Next Class',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      _buildNextClassCard(),
                      const SizedBox(height: 24),
                      const Text(
                        "Today's Schedule",
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      timetableAsync.when(
                        data: (data) {
                          if (data == null || data['schedule'] == null || (data['schedule'] as Map).isEmpty) {
                            return const EmptyStateWidget(
                              title: 'No timetable published',
                              description: 'Your timetable hasn\'t been published yet.',
                              icon: Icons.event_busy,
                            );
                          }
                          
                          // Mocking Monday for demo purposes
                          final schedule = data['schedule'] as Map<String, dynamic>;
                          final todayClasses = (schedule['Monday'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                          
                          if (todayClasses.isEmpty) {
                            return const Center(child: Text('No classes today'));
                          }
                          
                          return Column(
                            children: todayClasses.map((entry) {
                              return PeriodCardWidget(
                                entry: entry,
                                periodNumber: entry['period_number'] ?? 1,
                                startTime: entry['start_time'] ?? '',
                                endTime: entry['end_time'] ?? '',
                                isCurrent: false,
                              );
                            }).toList(),
                          );
                        },
                        loading: () => const Center(child: CircularProgressIndicator()),
                        error: (err, stack) => Center(child: Text('Error loading timetable')),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : const Center(child: Text('Timetable / Notifications Tab')),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'Timetable'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications), label: 'Notifications'),
        ],
      ),
    );
  }

  Widget _buildNextClassCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.blueAccent, Colors.indigo],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'In 45 minutes',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
              ),
              const Icon(Icons.timer, color: Colors.white),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Data Structures',
            style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Row(
            children: [
              Icon(Icons.person, color: Colors.white70, size: 16),
              SizedBox(width: 4),
              Text('Dr. Smith', style: TextStyle(color: Colors.white70, fontSize: 16)),
              SizedBox(width: 16),
              Icon(Icons.room, color: Colors.white70, size: 16),
              SizedBox(width: 4),
              Text('Room 101', style: TextStyle(color: Colors.white70, fontSize: 16)),
            ],
          ),
        ],
      ),
    );
  }
}

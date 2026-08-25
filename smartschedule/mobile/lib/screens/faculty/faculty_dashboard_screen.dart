import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timetable_provider.dart';
import '../../widgets/period_card_widget.dart';
import '../../widgets/empty_state_widget.dart';

class FacultyDashboardScreen extends ConsumerStatefulWidget {
  const FacultyDashboardScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<FacultyDashboardScreen> createState() => _FacultyDashboardScreenState();
}

class _FacultyDashboardScreenState extends ConsumerState<FacultyDashboardScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final name = user?.name ?? 'Faculty';
    final facultyId = user?.id ?? '';
    
    final timetableAsync = ref.watch(facultyTimetableProvider(facultyId));

    return Scaffold(
      appBar: AppBar(
        title: Text('Good Morning, $name'),
        actions: [
          IconButton(icon: const Icon(Icons.notifications), onPressed: () {}),
        ],
      ),
      body: _selectedIndex == 0
          ? RefreshIndicator(
              onRefresh: () async {
                ref.refresh(facultyTimetableProvider(facultyId));
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildWorkloadCard(),
                      const SizedBox(height: 24),
                      const Text(
                        "Today's Classes",
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      timetableAsync.when(
                        data: (data) {
                          if (data == null || data['schedule'] == null || (data['schedule'] as Map).isEmpty) {
                            return const EmptyStateWidget(
                              title: 'No classes today',
                              description: 'You have a free day today.',
                              icon: Icons.event_available,
                            );
                          }
                          
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
                        error: (err, stack) => const Center(child: Text('Error loading classes')),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        "Assigned Subjects",
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      _buildSubjectsCard(),
                    ],
                  ),
                ),
              ),
            )
          : const Center(child: Text('Other Tabs')),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'My Timetable'),
          BottomNavigationBarItem(icon: Icon(Icons.book), label: 'Subjects'),
        ],
      ),
    );
  }

  Widget _buildWorkloadCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Workload Summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text('18 / 24 hrs', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: 18 / 24,
                minHeight: 10,
                backgroundColor: Colors.grey.shade200,
                color: Colors.blue,
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _DayLoad(day: 'M', load: 4),
                _DayLoad(day: 'T', load: 3),
                _DayLoad(day: 'W', load: 5),
                _DayLoad(day: 'T', load: 2),
                _DayLoad(day: 'F', load: 4),
                _DayLoad(day: 'S', load: 0),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildSubjectsCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 3,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, index) {
          return ListTile(
            title: Text('Subject ${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Class ${index + 1}A'),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text('4 hrs/wk', style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold)),
            ),
          );
        },
      ),
    );
  }
}

class _DayLoad extends StatelessWidget {
  final String day;
  final int load;
  const _DayLoad({Key? key, required this.day, required this.load}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(load.toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(day, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
      ],
    );
  }
}

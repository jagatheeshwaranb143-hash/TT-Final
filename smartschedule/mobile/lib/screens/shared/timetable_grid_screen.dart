import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/timetable_provider.dart';
import '../../widgets/period_card_widget.dart';
import '../../widgets/empty_state_widget.dart';

class TimetableGridScreen extends ConsumerWidget {
  final String title;
  final String type; // 'class' or 'faculty'
  final String id; // classId or facultyId

  const TimetableGridScreen({
    Key? key,
    required this.title,
    required this.type,
    required this.id,
  }) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetableAsync = type == 'class'
        ? ref.watch(classTimetableProvider(id))
        : ref.watch(facultyTimetableProvider(id));

    return DefaultTabController(
      length: 6,
      child: Scaffold(
        appBar: AppBar(
          title: Text(title),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Mon'),
              Tab(text: 'Tue'),
              Tab(text: 'Wed'),
              Tab(text: 'Thu'),
              Tab(text: 'Fri'),
              Tab(text: 'Sat'),
            ],
          ),
        ),
        body: timetableAsync.when(
          data: (data) {
            if (data == null || data['schedule'] == null || (data['schedule'] as Map).isEmpty) {
              return EmptyStateWidget(
                title: 'No timetable available yet',
                description: 'The timetable has not been published or created.',
                icon: Icons.calendar_today,
                actionLabel: 'Refresh',
                onAction: () => ref.refresh(type == 'class' ? classTimetableProvider(id) : facultyTimetableProvider(id)),
              );
            }

            final schedule = data['schedule'] as Map<String, dynamic>;
            final days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            return TabBarView(
              children: days.map((day) {
                final daySchedule = (schedule[day] as List?)?.cast<Map<String, dynamic>>() ?? [];
                
                if (daySchedule.isEmpty) {
                  return const Center(child: Text('No classes scheduled'));
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    ref.refresh(type == 'class' ? classTimetableProvider(id) : facultyTimetableProvider(id));
                  },
                  child: ListView.builder(
                    itemCount: daySchedule.length,
                    itemBuilder: (context, index) {
                      final entry = daySchedule[index];
                      final isCurrent = false; // Add actual time logic if needed
                      
                      return PeriodCardWidget(
                        entry: entry,
                        periodNumber: entry['period_number'] ?? (index + 1),
                        startTime: entry['start_time'] ?? '',
                        endTime: entry['end_time'] ?? '',
                        isCurrent: isCurrent,
                        isBreak: entry['is_break'] ?? false,
                      );
                    },
                  ),
                );
              }).toList(),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(child: Text('Error: $err')),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/stats_card_widget.dart';
import '../../widgets/quality_score_widget.dart';
import 'generate_timetable_screen.dart';

class HodDashboardScreen extends ConsumerWidget {
  const HodDashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final deptName = user?.departmentId ?? 'Department';

    return Scaffold(
      appBar: AppBar(
        title: Text(deptName),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: StatsCardWidget(
                    label: 'Faculty',
                    value: '12',
                    icon: Icons.people,
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatsCardWidget(
                    label: 'Classes',
                    value: '8',
                    icon: Icons.class_,
                    color: Colors.green,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: StatsCardWidget(
                    label: 'Subjects',
                    value: '24',
                    icon: Icons.book,
                    color: Colors.orange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildStatusCard(context),
            const SizedBox(height: 24),
            const Text('Pending Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildPendingActions(),
            const SizedBox(height: 24),
            const Text('Faculty Workload', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildFacultyWorkload(),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const GenerateTimetableScreen()),
          );
        },
        icon: const Icon(Icons.auto_awesome),
        label: const Text('Generate Timetable'),
      ),
    );
  }

  Widget _buildStatusCard(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            const QualityScoreWidget(score: 85.0, size: 80),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Timetable Status', style: TextStyle(fontSize: 16, color: Colors.grey)),
                  const SizedBox(height: 4),
                  const Text('Active', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.green)),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade50,
                      foregroundColor: Colors.green,
                      elevation: 0,
                    ),
                    child: const Text('View Current'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingActions() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Colors.orange,
          child: Icon(Icons.pending_actions, color: Colors.white),
        ),
        title: const Text('Version 2.1 Awaiting Approval'),
        subtitle: const Text('Generated 2 hours ago'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {},
      ),
    );
  }

  Widget _buildFacultyWorkload() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: List.generate(3, (index) {
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.blue.shade100,
              child: Text('${index + 1}'),
            ),
            title: Text('Faculty Member ${index + 1}'),
            subtitle: const Text('Assigned: 20/24 periods'),
            trailing: Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                color: Colors.green,
                shape: BoxShape.circle,
              ),
            ),
          );
        }),
      ),
    );
  }
}

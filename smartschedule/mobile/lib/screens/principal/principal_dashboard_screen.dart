import 'package:flutter/material.dart';
import '../../widgets/stats_card_widget.dart';
import '../../widgets/quality_score_widget.dart';

class PrincipalDashboardScreen extends StatefulWidget {
  const PrincipalDashboardScreen({Key? key}) : super(key: key);

  @override
  State<PrincipalDashboardScreen> createState() => _PrincipalDashboardScreenState();
}

class _PrincipalDashboardScreenState extends State<PrincipalDashboardScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SmartSchedule'),
        actions: [
          IconButton(icon: const Icon(Icons.notifications), onPressed: () {}),
          IconButton(icon: const Icon(Icons.settings), onPressed: () {}),
        ],
      ),
      body: _selectedIndex == 0
          ? SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildStatsGrid(),
                  const SizedBox(height: 24),
                  const Text('Pending Approvals', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _buildPendingApprovals(),
                  const SizedBox(height: 24),
                  const Text('Department Overview', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _buildDepartmentOverview(),
                  const SizedBox(height: 24),
                  _buildSystemHealth(),
                ],
              ),
            )
          : const Center(child: Text('Other Tabs')),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.domain), label: 'Departments'),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Faculty'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.5,
      children: [
        StatsCardWidget(label: 'Departments', value: '5', icon: Icons.domain, color: Colors.blue),
        StatsCardWidget(label: 'Faculty', value: '64', icon: Icons.people, color: Colors.indigo),
        StatsCardWidget(label: 'Published', value: '4/5', icon: Icons.check_circle, color: Colors.green),
        StatsCardWidget(label: 'Pending', value: '1', icon: Icons.pending, color: Colors.orange),
      ],
    );
  }

  Widget _buildPendingApprovals() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        title: const Text('Computer Science Dept'),
        subtitle: const Text('HOD: Dr. Alan Turing • Quality: 92%'),
        trailing: ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.blue,
            foregroundColor: Colors.white,
          ),
          child: const Text('Approve'),
        ),
      ),
    );
  }

  Widget _buildDepartmentOverview() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          _deptTile('Computer Science', 'Active', Colors.green),
          const Divider(height: 1),
          _deptTile('Mechanical', 'Pending Approval', Colors.orange),
          const Divider(height: 1),
          _deptTile('Civil', 'Active', Colors.green),
        ],
      ),
    );
  }

  Widget _deptTile(String name, String status, Color color) {
    return ListTile(
      title: Text(name),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(status, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12)),
      ),
      onTap: () {},
    );
  }

  Widget _buildSystemHealth() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('System Health', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _healthIndicator('Database', true),
                _healthIndicator('API', true),
                _healthIndicator('AI Engine', true),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _healthIndicator(String label, bool isOk) {
    return Column(
      children: [
        Icon(isOk ? Icons.check_circle : Icons.error, color: isOk ? Colors.green : Colors.red, size: 32),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

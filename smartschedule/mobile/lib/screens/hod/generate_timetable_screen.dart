import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/quality_score_widget.dart';

class GenerateTimetableScreen extends ConsumerStatefulWidget {
  const GenerateTimetableScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<GenerateTimetableScreen> createState() => _GenerateTimetableScreenState();
}

class _GenerateTimetableScreenState extends ConsumerState<GenerateTimetableScreen> {
  String _semester = '1';
  String _academicYear = '2023-2024';
  int _timeLimit = 2;
  bool _isValidating = false;
  bool _isValidated = false;
  bool _isGenerating = false;
  bool _isSuccess = false;
  String _progressText = 'Loading data...';

  void _validateData() {
    setState(() => _isValidating = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isValidating = false;
          _isValidated = true;
        });
      }
    });
  }

  void _generateTimetable() {
    setState(() {
      _isGenerating = true;
      _progressText = 'Building model...';
    });
    
    // Simulate generation stages
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _progressText = 'Solving constraints...');
    });
    
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) setState(() => _progressText = 'Optimizing layout...');
    });
    
    Future.delayed(const Duration(seconds: 6), () {
      if (mounted) {
        setState(() {
          _isGenerating = false;
          _isSuccess = true;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final deptName = user?.departmentId ?? 'Department';

    if (_isSuccess) {
      return _buildSuccessScreen();
    }

    if (_isGenerating) {
      return _buildProgressScreen();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Generate Timetable')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextFormField(
              initialValue: deptName,
              decoration: const InputDecoration(labelText: 'Department', border: OutlineInputBorder()),
              enabled: false,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _semester,
              decoration: const InputDecoration(labelText: 'Semester', border: OutlineInputBorder()),
              items: ['1', '2', '3', '4', '5', '6', '7', '8']
                  .map((e) => DropdownMenuItem(value: e, child: Text('Semester $e')))
                  .toList(),
              onChanged: (val) => setState(() => _semester = val!),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _academicYear,
              decoration: const InputDecoration(labelText: 'Academic Year', border: OutlineInputBorder()),
              items: ['2023-2024', '2024-2025']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (val) => setState(() => _academicYear = val!),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<int>(
              value: _timeLimit,
              decoration: const InputDecoration(labelText: 'Time Limit (minutes)', border: OutlineInputBorder()),
              items: [2, 5, 10]
                  .map((e) => DropdownMenuItem(value: e, child: Text('$e minutes')))
                  .toList(),
              onChanged: (val) => setState(() => _timeLimit = val!),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isValidating ? null : _validateData,
                child: _isValidating
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Validate Data'),
              ),
            ),
            if (_isValidated) ...[
              const SizedBox(height: 24),
              const Text('Validation Report', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      _validationItem('Faculty Workload Limits', true),
                      _validationItem('Room Availability', true),
                      _validationItem('Subject Mapping', true),
                      const SizedBox(height: 16),
                      const Text('Ready to Generate', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _generateTimetable,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  child: const Text('Generate Now'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _validationItem(String text, bool isPass) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(isPass ? Icons.check_circle : Icons.cancel, color: isPass ? Colors.green : Colors.red),
          const SizedBox(width: 8),
          Text(text),
        ],
      ),
    );
  }

  Widget _buildProgressScreen() {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text(
              _progressText,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text('Please wait while AI generates the timetable...'),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessScreen() {
    return Scaffold(
      appBar: AppBar(title: const Text('Generation Complete')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const QualityScoreWidget(score: 95.0, size: 150),
              const SizedBox(height: 32),
              const Text('Timetable Generated Successfully!', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              const Text('120 periods scheduled across 8 classes.'),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('View Timetable'),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Submit for Approval'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

class PeriodCardWidget extends StatelessWidget {
  final Map<String, dynamic>? entry;
  final int periodNumber;
  final String startTime;
  final String endTime;
  final bool isCurrent;
  final bool isBreak;
  final VoidCallback? onTap;

  const PeriodCardWidget({
    Key? key,
    this.entry,
    required this.periodNumber,
    required this.startTime,
    required this.endTime,
    this.isCurrent = false,
    this.isBreak = false,
    this.onTap,
  }) : super(key: key);

  Color _getSubjectColor(String? type) {
    switch (type?.toLowerCase()) {
      case 'lab':
        return Colors.blue;
      case 'lecture':
        return Colors.green;
      case 'tutorial':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isBreak) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Center(
          child: Text(
            entry?['subject_name'] ?? 'Break',
            style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }

    final hasEntry = entry != null;
    final subjectColor = hasEntry ? _getSubjectColor(entry!['subject_type']) : Colors.grey.shade300;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isCurrent ? Colors.green : Colors.grey.shade200,
            width: isCurrent ? 2 : 1,
          ),
          boxShadow: [
            if (isCurrent)
              BoxShadow(color: Colors.green.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4))
            else
              BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2)),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(
                width: 6,
                decoration: BoxDecoration(
                  color: subjectColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    bottomLeft: Radius.circular(12),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'P$periodNumber',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade800),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '$startTime - $endTime',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                          if (isCurrent)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.green.shade100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'NOW',
                                style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (hasEntry) ...[
                        Text(
                          entry!['subject_name'] ?? 'Unknown Subject',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.person, size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                entry!['faculty_name'] ?? 'TBA',
                                style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.room, size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text(
                              entry!['room_id'] ?? 'TBA',
                              style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      ] else ...[
                        const Text(
                          'Free Period',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

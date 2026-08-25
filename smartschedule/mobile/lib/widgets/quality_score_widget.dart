import 'package:flutter/material.dart';

class QualityScoreWidget extends StatefulWidget {
  final double score; // 0-100
  final double size;
  final bool showGrade;

  const QualityScoreWidget({
    Key? key,
    required this.score,
    this.size = 120.0,
    this.showGrade = true,
  }) : super(key: key);

  @override
  State<QualityScoreWidget> createState() => _QualityScoreWidgetState();
}

class _QualityScoreWidgetState extends State<QualityScoreWidget> {
  Color _getColor(double score) {
    if (score >= 90) return Colors.green;
    if (score >= 75) return Colors.blue;
    if (score >= 60) return Colors.yellow.shade700;
    if (score >= 40) return Colors.orange;
    return Colors.red;
  }

  String _getGrade(double score) {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  @override
  Widget build(BuildContext context) {
    final color = _getColor(widget.score);
    final grade = _getGrade(widget.score);

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: widget.score),
      duration: const Duration(milliseconds: 1500),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CircularProgressIndicator(
                value: value / 100,
                strokeWidth: widget.size * 0.08,
                backgroundColor: Colors.grey.shade200,
                color: color,
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.showGrade)
                      Text(
                        grade,
                        style: TextStyle(
                          fontSize: widget.size * 0.35,
                          fontWeight: FontWeight.bold,
                          color: color,
                        ),
                      ),
                    Text(
                      '${value.toInt()}',
                      style: TextStyle(
                        fontSize: widget.size * 0.18,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

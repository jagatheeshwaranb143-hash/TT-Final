import 'package:flutter/material.dart';

class QrScannerScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Scan Room QR')),
      body: Center(
        child: Text('Camera Preview (Mock)'),
      ),
    );
  }
}

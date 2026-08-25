# SmartSchedule Mobile App

## Build Instructions

### Prerequisites
- Flutter SDK (latest stable)
- Android Studio / SDK
- For iOS: Xcode

### Environment Setup
You can run the app pointing to your local or production backend using `dart-define`.
`flutter run --dart-define=API_BASE_URL=http://your-ip:8000/api/v1`

### Build Release APK
`flutter build apk --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1`

### Features
- Role-based dashboards
- Offline timetable support
- QR scanning for room timetables

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'core/bootstrap/app_startup.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    AppStartup(
      initialize: () async {
        await Firebase.initializeApp();
      },
      appBuilder: (_) => const SnapkitApp(),
    ),
  );
}

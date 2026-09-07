import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../application/auth_controller.dart';
import 'login_screen.dart';
import 'splash_screen.dart';
import '../../../shared/widgets/app_shell.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _splashCompleted = false;

  void _onSplashFinished() {
    if (mounted) {
      setState(() => _splashCompleted = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = Get.find<AuthController>();
    return Obx(() {
      final status = controller.status;
      if (!_splashCompleted) {
        return SplashScreen(onFinished: _onSplashFinished);
      }
      return switch (status) {
        AuthStatus.checking => SplashScreen(onFinished: _onSplashFinished),
        AuthStatus.unauthenticated => const LoginScreen(),
        AuthStatus.authenticated => const AppShell(),
      };
    });
  }
}

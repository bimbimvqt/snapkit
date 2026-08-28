import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/styles/app_dimensions.dart';
import '../application/auth_controller.dart';
import 'login_screen.dart';
import '../../../shared/widgets/app_shell.dart';

class AuthGate extends GetView<AuthController> {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) => Obx(
    () => switch (controller.status) {
      AuthStatus.checking => const _AuthLoadingScreen(),
      AuthStatus.unauthenticated => const LoginScreen(),
      AuthStatus.authenticated => const AppShell(),
    },
  );
}

class _AuthLoadingScreen extends StatelessWidget {
  const _AuthLoadingScreen();

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(padding: EdgeInsets.all(AppDimensions.space24), child: const CircularProgressIndicator()),
      ),
    ),
  );
}

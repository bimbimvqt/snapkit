import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../features/auth/application/auth_controller.dart';
import 'app_routes.dart';

class AuthMiddleware extends GetMiddleware {
  @override
  RouteSettings? redirect(String? route) {
    final authController = Get.find<AuthController>();
    return authController.status == AuthStatus.authenticated ? null : const RouteSettings(name: AppRoutes.root);
  }
}

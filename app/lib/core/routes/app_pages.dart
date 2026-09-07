import 'package:get/get.dart';

import '../../features/auth/presentation/auth_gate.dart';
import '../../features/caption/presentation/caption_studio_screen.dart';
import '../../features/qr/presentation/scanner_screen.dart';
import '../bindings/caption_studio_binding.dart';
import '../bindings/qr_scanner_binding.dart';
import 'app_routes.dart';
import 'auth_middleware.dart';

abstract final class AppPages {
  static final pages = <GetPage<dynamic>>[
    GetPage(name: AppRoutes.root, page: () => const AuthGate()),
    GetPage(
      name: AppRoutes.scanner,
      page: () => const ScannerScreen(),
      binding: QrScannerBinding(),
      middlewares: [AuthMiddleware()],
    ),
    GetPage(
      name: AppRoutes.captionStudio,
      page: () => const CaptionStudioScreen(),
      binding: CaptionStudioBinding(),
      middlewares: [AuthMiddleware()],
    ),
  ];
}

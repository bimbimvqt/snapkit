import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import 'core/bindings/app_binding.dart';
import 'core/config/remote_config.dart';
import 'core/routes/app_pages.dart';
import 'core/routes/app_routes.dart';
import 'core/styles/app_dimensions.dart';
import 'core/theme/snapkit_theme.dart';
import 'features/auth/domain/auth_repository.dart';

class SnapkitApp extends StatefulWidget {
  const SnapkitApp({this.authRepository, super.key});

  final AuthRepository? authRepository;

  @override
  State<SnapkitApp> createState() => _SnapkitAppState();
}

class _SnapkitAppState extends State<SnapkitApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      RemoteConfig.instance.refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      RemoteConfig.instance.refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScreenUtilInit(
    designSize: AppDimensions.designSize,
    minTextAdapt: true,
    splitScreenMode: true,
    fontSizeResolver: AppDimensions.resolveFontSize,
    builder: (context, _) => AnimatedBuilder(
      animation: RemoteConfig.instance,
      builder: (context, _) {
        final settings = RemoteConfig.instance.theme;
        return GetMaterialApp(
          title: 'Snapkit',
          debugShowCheckedModeBanner: false,
          initialBinding: AppBinding(authRepository: widget.authRepository),
          initialRoute: AppRoutes.root,
          getPages: AppPages.pages,
          theme: SnapkitTheme.light(settings.preset),
          darkTheme: SnapkitTheme.dark(settings.preset),
          themeMode: settings.mode,
        );
      },
    ),
  );
}

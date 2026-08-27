import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'core/config/remote_config.dart';
import 'core/theme/toolbox_theme.dart';
import 'features/cleaner/presentation/cleaner_screen.dart';
import 'features/home/presentation/home_screen.dart';
import 'features/qr/presentation/qr_screen.dart';
import 'features/qr/presentation/scanner_screen.dart';
import 'features/settings/presentation/settings_screen.dart';
import 'shared/widgets/app_shell.dart';

final _router = GoRouter(
  initialLocation: '/home',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AppShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/cleaner', builder: (_, _) => const CleanerScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [GoRoute(path: '/qr', builder: (_, _) => const QrScreen())],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (_, _) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(path: '/qr/scanner', builder: (_, _) => const ScannerScreen()),
  ],
);

class ToolboxApp extends StatefulWidget {
  const ToolboxApp({super.key});

  @override
  State<ToolboxApp> createState() => _ToolboxAppState();
}

class _ToolboxAppState extends State<ToolboxApp> with WidgetsBindingObserver {
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
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: RemoteConfig.instance,
    builder: (context, _) {
      final settings = RemoteConfig.instance.theme;
      return MaterialApp.router(
        title: 'Toolbox One',
        debugShowCheckedModeBanner: false,
        theme: ToolboxTheme.light(settings.preset),
        darkTheme: ToolboxTheme.dark(settings.preset),
        themeMode: settings.mode,
        themeAnimationDuration: const Duration(milliseconds: 240),
        routerConfig: _router,
      );
    },
  );
}

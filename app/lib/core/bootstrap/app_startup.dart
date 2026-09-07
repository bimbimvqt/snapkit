import 'package:flutter/material.dart';

import '../theme/snapkit_theme.dart';

/// Keeps initialization failures recoverable before the authenticated app exists.
class AppStartup extends StatefulWidget {
  const AppStartup({required this.initialize, required this.appBuilder, super.key});

  final Future<void> Function() initialize;
  final WidgetBuilder appBuilder;

  @override
  State<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<AppStartup> {
  late Future<void> _initialization;

  @override
  void initState() {
    super.initState();
    _initialization = Future<void>.sync(widget.initialize);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialization,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.done && !snapshot.hasError) {
        return widget.appBuilder(context);
      }
      return MaterialApp(
        title: 'Snapkit',
        debugShowCheckedModeBanner: false,
        theme: SnapkitTheme.light(),
        darkTheme: SnapkitTheme.dark(),
        home: Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Builder(
                    builder: (context) => Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!snapshot.hasError) ...[
                          const CircularProgressIndicator(),
                          const SizedBox(height: 24),
                          const Text('Đang mở Snapkit…'),
                        ] else ...[
                          Icon(Icons.cloud_off_outlined, size: 48, color: Theme.of(context).colorScheme.primary),
                          const SizedBox(height: 24),
                          Text('Chưa thể mở Snapkit', style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 12),
                          const Text(
                            'Khởi tạo ứng dụng chưa thành công. Vui lòng thử lại.',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: () {
                              final next = Future<void>.sync(widget.initialize);
                              setState(() {
                                _initialization = next;
                              });
                            },
                            child: const Text('Thử lại'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

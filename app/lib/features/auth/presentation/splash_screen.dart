import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({this.onFinished, super.key});

  final VoidCallback? onFinished;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  static const _animationDuration = Duration(milliseconds: 900);
  static const _descriptionText = 'Smart Tech For Modern Needs';

  late final AnimationController _controller;
  late final Animation<double> _logoFadeAnimation;
  late final Animation<double> _logoScaleAnimation;
  late final Animation<double> _descriptionFadeAnimation;
  bool _animationStarted = false;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _animationDuration);
    _logoFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutCubic),
      ),
    );
    _logoScaleAnimation = Tween<double>(begin: 0.94, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOutCubic),
      ),
    );
    _descriptionFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.28, 0.72, curve: Curves.easeOut),
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_animationStarted) return;
    _animationStarted = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1.0;
      WidgetsBinding.instance.addPostFrameCallback((_) => _notifyFinished());
      return;
    }
    unawaited(_playAnimation());
  }

  Future<void> _playAnimation() async {
    try {
      await _controller.forward().orCancel;
      _notifyFinished();
    } on TickerCanceled {
      // Disposing the splash cancels the animation and must not fire navigation.
    }
  }

  void _notifyFinished() {
    if (!mounted || _finished) return;
    _finished = true;
    widget.onFinished?.call();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppDimensions.pageHorizontal(constraints.maxWidth)),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: RepaintBoundary(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FadeTransition(
                        opacity: _logoFadeAnimation,
                        child: ScaleTransition(
                          scale: _logoScaleAnimation,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'Snapkit',
                              style: AppTextStyles.display.copyWith(
                                color: scheme.primary,
                                fontSize: 58.sp,
                                letterSpacing: -1.2,
                              ),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: AppDimensions.space12),
                      FadeTransition(
                        opacity: _descriptionFadeAnimation,
                        child: Text(
                          _descriptionText,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: scheme.onSurfaceVariant,
                            fontSize: 16.sp,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

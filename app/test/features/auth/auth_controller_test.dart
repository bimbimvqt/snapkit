import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/auth/application/auth_controller.dart';
import 'package:snapkit/features/auth/domain/auth_failure.dart';
import 'package:snapkit/features/auth/domain/auth_repository.dart';
import 'package:snapkit/features/auth/domain/auth_user.dart';
import 'package:snapkit/features/auth/presentation/login_screen.dart';

const _user = AuthUser(id: 'user-test', email: 'user@example.com', role: 'USER', name: 'Snapkit User');

void main() {
  setUp(() {
    Get.testMode = true;
  });

  tearDown(Get.reset);

  test('restores an authenticated session', () async {
    final controller = AuthController(_FakeAuthRepository(restoredUser: _user));
    await controller.initialize();
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.user, _user);
  });

  test('shows a friendly failure and supports retry', () async {
    final repository = _FakeAuthRepository(signInFailure: const AuthNetworkFailure());
    final controller = AuthController(repository);
    await controller.initialize();
    await controller.signInWithGoogle();
    expect(controller.status, AuthStatus.unauthenticated);
    expect(controller.errorMessage, contains('kiểm tra mạng'));

    repository.signInFailure = null;
    await controller.signInWithGoogle();
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.errorMessage, isNull);
  });

  test('ignores duplicate sign-in submissions', () async {
    final completer = Completer<AuthUser>();
    final repository = _FakeAuthRepository(signInCompleter: completer);
    final controller = AuthController(repository);
    await controller.initialize();

    final first = controller.signInWithGoogle();
    final second = controller.signInWithGoogle();
    expect(repository.signInCalls, 1);
    completer.complete(_user);
    await Future.wait([first, second]);
    expect(controller.status, AuthStatus.authenticated);
  });

  test('clears local auth state even when remote sign-out fails', () async {
    final controller = AuthController(_FakeAuthRepository(restoredUser: _user, failSignOut: true));
    await controller.initialize();
    await controller.signOut();
    expect(controller.status, AuthStatus.unauthenticated);
    expect(controller.user, isNull);
  });

  test('refreshes the Pro entitlement without dropping the active session', () async {
    final repository = _FakeAuthRepository(restoredUser: _user);
    final controller = AuthController(repository);
    await controller.initialize();
    repository.restoredUser = const AuthUser(
      id: 'user-test',
      email: 'user@example.com',
      role: 'USER',
      isPro: true,
      planId: 'yearly',
    );

    await controller.refreshSession();

    expect(controller.status, AuthStatus.authenticated);
    expect(controller.user?.isPro, isTrue);
    expect(controller.user?.planId, 'yearly');
  });

  test('clears a session that is no longer valid during entitlement refresh', () async {
    final repository = _FakeAuthRepository(restoredUser: _user);
    final controller = AuthController(repository);
    await controller.initialize();
    repository.restoredUser = null;

    await controller.refreshSession();

    expect(controller.status, AuthStatus.unauthenticated);
    expect(controller.user, isNull);
  });

  test('resets tools on identity changes but keeps them on entitlement refresh', () async {
    var resets = 0;
    final repository = _FakeAuthRepository(restoredUser: _user);
    final controller = AuthController(repository, onSessionChanged: () => resets++);
    await controller.initialize();
    expect(resets, 1);
    await controller.refreshSession();
    expect(resets, 1);
    await controller.signOut();
    expect(resets, 2);
    await controller.signInWithGoogle();
    expect(resets, 3);
  });

  test('late entitlement response cannot restore a signed-out user', () async {
    final repository = _FakeAuthRepository(restoredUser: _user);
    final controller = AuthController(repository);
    await controller.initialize();
    final pending = Completer<AuthUser?>();
    repository.restoreCompleter = pending;
    final refreshing = controller.refreshSession();
    await controller.signOut();
    pending.complete(_user);
    await refreshing;
    expect(controller.status, AuthStatus.unauthenticated);
    expect(controller.user, isNull);
  });

  test('foreground refresh ignores concurrent requests and preserves user on network failure', () async {
    final repository = _FakeAuthRepository(restoredUser: _user);
    final controller = AuthController(repository);
    await controller.initialize();
    final pending = Completer<AuthUser?>();
    repository.restoreCompleter = pending;
    final first = controller.refreshSession();
    await controller.refreshSession();
    expect(repository.restoreCalls, 2);
    pending.completeError(const AuthNetworkFailure());
    await first;
    expect(controller.user, _user);
    expect(controller.status, AuthStatus.authenticated);
  });

  testWidgets('login stays usable on a 375px phone and in landscape with large text', (tester) async {
    final repository = _FakeAuthRepository();
    final controller = AuthController(repository);
    await controller.initialize();
    Get.put(controller);

    Future<void> render(
      Size size, {
      double textScale = 1,
      ThemeMode themeMode = ThemeMode.light,
      bool disableAnimations = false,
    }) async {
      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(
        ScreenUtilInit(
          designSize: AppDimensions.designSize,
          minTextAdapt: true,
          splitScreenMode: true,
          fontSizeResolver: AppDimensions.resolveFontSize,
          builder: (context, _) => GetMaterialApp(
            theme: SnapkitTheme.light(),
            darkTheme: SnapkitTheme.dark(),
            themeMode: themeMode,
            home: MediaQuery(
              data: MediaQueryData(
                size: size,
                textScaler: TextScaler.linear(textScale),
                disableAnimations: disableAnimations,
              ),
              child: const LoginScreen(),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Tiếp tục với Google'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }

    await render(const Size(375, 667));
    await render(const Size(667, 375), textScale: 1.6, themeMode: ThemeMode.dark, disableAnimations: true);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  });
}

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.restoredUser, this.signInFailure, this.signInCompleter, this.failSignOut = false});

  AuthUser? restoredUser;
  AuthFailure? signInFailure;
  final Completer<AuthUser>? signInCompleter;
  final bool failSignOut;
  int signInCalls = 0;
  int restoreCalls = 0;
  Completer<AuthUser?>? restoreCompleter;

  @override
  Future<AuthUser?> restoreSession() async {
    restoreCalls++;
    return restoreCompleter == null ? restoredUser : restoreCompleter!.future;
  }

  @override
  Future<AuthUser> signInWithGoogle() async {
    signInCalls += 1;
    final failure = signInFailure;
    if (failure != null) throw failure;
    final completer = signInCompleter;
    return completer == null ? _user : completer.future;
  }

  @override
  Future<void> signOut() async {
    if (failSignOut) throw StateError('network unavailable');
  }
}

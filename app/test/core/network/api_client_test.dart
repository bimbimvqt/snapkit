import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:snapkit/core/network/api_client.dart';

ResponseBody _json(int status, Map<String, Object?> data) => ResponseBody.fromString(
  jsonEncode(data),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) =>
      respond(options);
  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const storage = FlutterSecureStorage();
  late Dio transport;
  late Dio refresh;
  late ApiClient api;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({'access_token': 'old-access', 'refresh_token': 'old-refresh'});
    transport = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
    refresh = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
    api = ApiClient(client: transport, refreshClient: refresh, storage: storage);
    transport.httpClientAdapter = _Adapter(
      (options) async => options.headers['authorization'] == 'Bearer new-access'
          ? _json(200, {
              'data': {'id': 'user-1'},
            })
          : _json(401, {}),
    );
  });

  test('concurrent unauthorized requests rotate once and replay with the new token', () async {
    var calls = 0;
    final entered = Completer<void>();
    final release = Completer<void>();
    refresh.httpClientAdapter = _Adapter((_) async {
      calls++;
      entered.complete();
      await release.future;
      return _json(200, {
        'data': {'accessToken': 'new-access', 'refreshToken': 'new-refresh'},
      });
    });
    final first = api.currentUser();
    final second = api.currentUser();
    await entered.future;
    release.complete();
    expect(await Future.wait([first, second]), everyElement({'id': 'user-1'}));
    expect(calls, 1);
    expect(await storage.read(key: 'refresh_token'), 'new-refresh');
  });

  test('temporary refresh failure preserves credentials and surfaces the server error', () async {
    refresh.httpClientAdapter = _Adapter((_) async => _json(503, {}));
    await expectLater(
      api.currentUser(),
      throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 503)),
    );
    expect(await api.hasSession(), isTrue);
    expect(await storage.read(key: 'refresh_token'), 'old-refresh');
  });

  test('revoked refresh token clears credentials', () async {
    refresh.httpClientAdapter = _Adapter((_) async => _json(401, {}));
    await expectLater(api.currentUser(), throwsA(isA<DioException>()));
    expect(await api.hasSession(), isFalse);
    expect(await storage.read(key: 'refresh_token'), isNull);
  });

  test('rejected replay clears credentials and preserves the unauthorized result', () async {
    transport.httpClientAdapter = _Adapter((_) async => _json(401, {}));
    refresh.httpClientAdapter = _Adapter(
      (_) async => _json(200, {
        'data': {'accessToken': 'new-access', 'refreshToken': 'new-refresh'},
      }),
    );
    await expectLater(
      api.currentUser(),
      throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 401)),
    );
    expect(await api.hasSession(), isFalse);
  });

  test('resource permission denial after refresh preserves valid credentials', () async {
    transport.httpClientAdapter = _Adapter(
      (options) async => _json(options.headers['authorization'] == 'Bearer new-access' ? 403 : 401, {}),
    );
    refresh.httpClientAdapter = _Adapter(
      (_) async => _json(200, {
        'data': {'accessToken': 'new-access', 'refreshToken': 'new-refresh'},
      }),
    );
    await expectLater(
      api.currentUser(),
      throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 403)),
    );
    expect(await storage.read(key: 'access_token'), 'new-access');
  });

  test('old refresh cannot overwrite a newly authenticated account', () async {
    final entered = Completer<void>();
    final release = Completer<void>();
    refresh.httpClientAdapter = _Adapter((_) async {
      entered.complete();
      await release.future;
      return _json(200, {
        'data': {'accessToken': 'old-user-rotated', 'refreshToken': 'old-user-refresh'},
      });
    });
    transport.httpClientAdapter = _Adapter(
      (options) async => options.path == '/api/v1/auth/google'
          ? _json(200, {
              'data': {
                'accessToken': 'new-user-access',
                'refreshToken': 'new-user-refresh',
                'user': {'id': 'user-2'},
              },
            })
          : _json(401, {}),
    );
    final pending = expectLater(api.currentUser(), throwsA(isA<DioException>()));
    await entered.future;
    await api.authenticateWithGoogle('google-test-token');
    release.complete();
    await pending;
    expect(await storage.read(key: 'access_token'), 'new-user-access');
    expect(await storage.read(key: 'refresh_token'), 'new-user-refresh');
  });

  test('logout prevents an in-flight refresh from restoring credentials', () async {
    final entered = Completer<void>();
    final release = Completer<void>();
    refresh.httpClientAdapter = _Adapter((_) async {
      entered.complete();
      await release.future;
      return _json(200, {
        'data': {'accessToken': 'new-access', 'refreshToken': 'new-refresh'},
      });
    });
    final pending = expectLater(api.currentUser(), throwsA(isA<DioException>()));
    await entered.future;
    await api.clearSession();
    release.complete();
    await pending;
    expect(await api.hasSession(), isFalse);
    expect(await storage.read(key: 'refresh_token'), isNull);
  });

  test('media retry does not submit an old payload after the session changes', () async {
    var requests = 0;
    final entered = Completer<void>();
    transport.httpClientAdapter = _Adapter((_) async {
      requests++;
      if (!entered.isCompleted) entered.complete();
      return _json(503, {});
    });
    final pending = api.syncMediaScanBatch({'clientScanId': 'private-old-scan'});
    await entered.future;
    await api.clearSession();
    expect(await pending, isNull);
    expect(requests, 1);
  });

  test('malformed refresh response preserves the previous session', () async {
    refresh.httpClientAdapter = _Adapter(
      (_) async => _json(200, {
        'data': {'accessToken': 42},
      }),
    );
    await expectLater(api.currentUser(), throwsA(isA<DioException>()));
    expect(await storage.read(key: 'access_token'), 'old-access');
  });
}

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../config/app_environment.dart';

class ApiClient {
  ApiClient({Dio? client, Dio? refreshClient, FlutterSecureStorage? storage})
    : dio = client ?? Dio(_options()),
      _refreshClient = refreshClient ?? Dio(_options()),
      _storage = storage ?? const FlutterSecureStorage() {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          try {
            final version = options.extra.putIfAbsent('sessionVersion', () => _sessionVersion);
            if (version != _sessionVersion) {
              handler.reject(DioException(requestOptions: options, type: DioExceptionType.cancel));
              return;
            }
            final token = await _storage.read(key: 'access_token');
            if (version != _sessionVersion) {
              handler.reject(DioException(requestOptions: options, type: DioExceptionType.cancel));
              return;
            }
            if (token != null) options.headers['authorization'] = 'Bearer $token';
            handler.next(options);
          } catch (error, stackTrace) {
            handler.reject(DioException(requestOptions: options, error: error, stackTrace: stackTrace));
          }
        },
        onError: (error, handler) async {
          final request = error.requestOptions;
          final version = request.extra['sessionVersion'];
          if (version != _sessionVersion) {
            handler.next(DioException(requestOptions: request, type: DioExceptionType.cancel));
            return;
          }
          if (error.response?.statusCode != 401 ||
              request.extra['retried'] == true ||
              request.path.startsWith('/api/v1/auth/') && request.path != '/api/v1/auth/me') {
            handler.next(error);
            return;
          }
          String? access;
          try {
            access = await _refreshAccessToken(version as int, request.headers['authorization'] as String?);
          } on DioException catch (refreshError) {
            // A timeout or 5xx during refresh must not be mistaken for revoked credentials.
            if (version != _sessionVersion) {
              handler.next(DioException(requestOptions: request, type: DioExceptionType.cancel));
              return;
            }
            if (refreshError.response?.statusCode == 401 || refreshError.response?.statusCode == 403) {
              await clearSession();
            }
            handler.next(refreshError);
            return;
          } catch (cause, stackTrace) {
            handler.next(DioException(requestOptions: request, error: cause, stackTrace: stackTrace));
            return;
          }
          if (version != _sessionVersion) {
            handler.next(DioException(requestOptions: request, type: DioExceptionType.cancel));
            return;
          }
          if (access == null) await clearSession();
          if (access == null || request.data is Stream) {
            handler.next(error);
            return;
          }
          request.extra['retried'] = true;
          request.headers['authorization'] = 'Bearer $access';
          try {
            handler.resolve(await dio.fetch(request));
          } on DioException catch (replayError) {
            // A resource-level 403 after a successful refresh is not session revocation.
            if (replayError.response?.statusCode == 401 && version == _sessionVersion) await clearSession();
            handler.next(replayError);
          } catch (cause, stackTrace) {
            handler.next(DioException(requestOptions: request, error: cause, stackTrace: stackTrace));
          }
        },
      ),
    );
  }

  static BaseOptions _options() => BaseOptions(
    baseUrl: AppEnvironment.apiBaseUrl,
    connectTimeout: const Duration(seconds: 8),
    sendTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'content-type': 'application/json'},
  );

  static final instance = ApiClient();
  final Dio dio;
  final Dio _refreshClient;
  final FlutterSecureStorage _storage;
  int _sessionVersion = 0;
  Future<String?>? _refreshing;
  Future<void> _tokenWrite = Future<void>.value();

  Future<String?> _refreshAccessToken(int version, String? failedAuthorization) async {
    final current = await _storage.read(key: 'access_token');
    if (version != _sessionVersion) return null;
    // Another request may already have rotated the token before this 401 arrived.
    if (current != null && 'Bearer $current' != failedAuthorization) return current;
    final pending = _refreshing;
    if (pending != null) return pending;
    final refresh = _rotateTokens(version);
    _refreshing = refresh;
    try {
      return await refresh;
    } finally {
      if (identical(_refreshing, refresh)) _refreshing = null;
    }
  }

  Future<String?> _rotateTokens(int version) async {
    final token = await _storage.read(key: 'refresh_token');
    if (token == null || version != _sessionVersion) return null;
    final response = await _refreshClient.post<Map<String, dynamic>>(
      '/api/v1/auth/refresh',
      data: {'refreshToken': token},
    );
    final data = _dataMap(response.data);
    final access = data['accessToken'];
    final refresh = data['refreshToken'];
    if (access is! String || access.isEmpty || refresh is! String || refresh.isEmpty) {
      throw const FormatException('Invalid refresh response');
    }
    await _saveTokens(access, refresh, version);
    return version == _sessionVersion ? access : null;
  }

  Future<void> _saveTokens(String access, String refresh, int version) => _queueTokenWrite(() async {
    if (version != _sessionVersion) return;
    await Future.wait([
      _storage.write(key: 'access_token', value: access),
      _storage.write(key: 'refresh_token', value: refresh),
    ]);
  });

  Future<void> _queueTokenWrite(Future<void> Function() write) {
    final next = _tokenWrite.then((_) => write());
    _tokenWrite = next.catchError((Object _) {});
    return next;
  }

  Future<bool> hasSession() async => await _storage.read(key: 'access_token') != null;

  Future<void> clearSession() {
    _sessionVersion += 1;
    _refreshing = null;
    return _queueTokenWrite(() async {
      await Future.wait([_storage.delete(key: 'access_token'), _storage.delete(key: 'refresh_token')]);
    });
  }

  Future<Map<String, dynamic>> currentUser() async {
    final response = await dio.get<Map<String, dynamic>>('/api/v1/auth/me');
    return _dataMap(response.data);
  }

  Future<Map<String, dynamic>> authenticateWithGoogle(String idToken) async {
    final version = ++_sessionVersion;
    _refreshing = null;
    final response = await dio.post<Map<String, dynamic>>(
      '/api/v1/auth/google',
      data: {'idToken': idToken, 'deviceId': await deviceId()},
      options: Options(extra: {'sessionVersion': version}),
    );
    final data = _dataMap(response.data);
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    if (accessToken is! String || accessToken.isEmpty || refreshToken is! String || refreshToken.isEmpty) {
      throw const FormatException('Authentication response does not contain tokens');
    }
    final user = data['user'];
    if (user is! Map || user['id'] is! String || (user['id'] as String).isEmpty) {
      throw const FormatException('Authentication response does not contain a user');
    }
    await _saveTokens(accessToken, refreshToken, version);
    if (version != _sessionVersion) throw const FormatException('Session changed during sign-in');
    if (user is Map<String, dynamic>) return user;
    return Map<String, dynamic>.from(user);
  }

  Future<void> logout() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    await clearSession();
    try {
      await dio.post<Map<String, dynamic>>('/api/v1/auth/logout', data: {'refreshToken': refreshToken});
    } catch (_) {
      // Local logout must still complete when the network is unavailable.
    }
  }

  Future<String> deviceId() async {
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getString('device_id');
    if (current != null) return current;
    final id = const Uuid().v4();
    await prefs.setString('device_id', id);
    return id;
  }

  Future<void> event(String name, [Map<String, Object?> metadata = const {}]) async {
    final version = _sessionVersion;
    try {
      await dio.post(
        '/api/v1/events',
        options: Options(extra: {'sessionVersion': version}),
        data: {
          'deviceId': await deviceId(),
          'name': name,
          'platform': Platform.isIOS ? 'ios' : 'android',
          'metadata': metadata,
        },
      );
    } catch (_) {}
  }

  Future<bool> saveQr({required String kind, required String content, required Map<String, Object> style}) async {
    final version = _sessionVersion;
    try {
      await dio.post(
        '/api/v1/qr',
        options: Options(extra: {'sessionVersion': version}),
        data: {'deviceId': await deviceId(), 'kind': kind, 'content': content, 'style': style},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> reportCleanup({
    required int scanned,
    required int removed,
    required int bytesFreed,
    required int durationMs,
  }) async {
    final version = _sessionVersion;
    try {
      await dio.post(
        '/api/v1/media-cleanups',
        options: Options(extra: {'sessionVersion': version}),
        data: {
          'deviceId': await deviceId(),
          'scannedCount': scanned,
          'removedCount': removed,
          'bytesFreed': bytesFreed,
          'durationMs': durationMs,
        },
      );
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> syncMediaScanBatch(Map<String, Object?> payload) async {
    final version = _sessionVersion;
    const retryDelays = [Duration.zero, Duration(milliseconds: 500), Duration(seconds: 1)];
    for (var attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt] > Duration.zero) await Future<void>.delayed(retryDelays[attempt]);
      if (version != _sessionVersion) return null;
      try {
        final response = await dio.post<Map<String, dynamic>>(
          '/api/v1/media-scans',
          data: payload,
          options: Options(extra: {'sessionVersion': version}),
        );
        return _dataMap(response.data);
      } on DioException catch (error) {
        final statusCode = error.response?.statusCode;
        final retryable =
            statusCode == null || statusCode == 408 || statusCode == 429 || (statusCode >= 500 && statusCode <= 599);
        if (!retryable || attempt == retryDelays.length - 1) return null;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  Future<bool> uploadMediaPreview({
    required String assetId,
    required Stream<List<int>> stream,
    required int length,
    required String mimeType,
  }) async {
    final version = _sessionVersion;
    try {
      final prepared = await dio.post<Map<String, dynamic>>(
        '/api/v1/media-scans/assets/$assetId/upload',
        data: {'mimeType': mimeType, 'bytes': length},
        options: Options(extra: {'sessionVersion': version}),
      );
      if (version != _sessionVersion) return false;
      final upload = _dataMap(prepared.data);
      final uploadUrl = upload['uploadUrl'];
      final mode = upload['mode'];
      if (uploadUrl is! String || (mode != 'direct' && mode != 'proxy')) return false;

      if (mode == 'proxy') {
        await dio.put<Map<String, dynamic>>(
          uploadUrl,
          data: stream,
          options: Options(
            extra: {'sessionVersion': version},
            headers: {Headers.contentTypeHeader: mimeType, Headers.contentLengthHeader: length},
            sendTimeout: const Duration(minutes: 30),
            receiveTimeout: const Duration(minutes: 30),
          ),
        );
        return true;
      }

      final rawHeaders = upload['headers'];
      final headers = rawHeaders is Map ? Map<String, dynamic>.from(rawHeaders) : <String, dynamic>{};
      await Dio().put<void>(
        uploadUrl,
        data: stream,
        options: Options(
          headers: headers,
          sendTimeout: const Duration(minutes: 30),
          receiveTimeout: const Duration(minutes: 2),
          responseType: ResponseType.plain,
        ),
      );
      await dio.post<Map<String, dynamic>>(
        '/api/v1/media-scans/assets/$assetId/upload/complete',
        options: Options(receiveTimeout: const Duration(minutes: 30), extra: {'sessionVersion': version}),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Map<String, dynamic> _dataMap(Map<String, dynamic>? envelope) {
    final data = envelope?['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw const FormatException('API response does not contain an object');
  }
}

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../config/app_environment.dart';

class ApiClient {
  ApiClient._()
    : dio = Dio(
        BaseOptions(
          baseUrl: AppEnvironment.apiBaseUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 10),
          headers: {'content-type': 'application/json'},
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'access_token');
          if (token != null) options.headers['authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode != 401 || error.requestOptions.extra['retried'] == true) {
            handler.next(error);
            return;
          }
          final refreshToken = await _storage.read(key: 'refresh_token');
          if (refreshToken == null) {
            handler.next(error);
            return;
          }
          try {
            final refresh = await Dio(
              BaseOptions(baseUrl: AppEnvironment.apiBaseUrl),
            ).post<Map<String, dynamic>>('/api/v1/auth/refresh', data: {'refreshToken': refreshToken});
            final data = refresh.data?['data'] as Map<String, dynamic>;
            await _saveTokens(data['accessToken'] as String, data['refreshToken'] as String);
            error.requestOptions.extra['retried'] = true;
            error.requestOptions.headers['authorization'] = 'Bearer ${data['accessToken']}';
            handler.resolve(await dio.fetch(error.requestOptions));
          } catch (_) {
            await clearSession();
            handler.next(error);
          }
        },
      ),
    );
  }
  static final instance = ApiClient._();
  final Dio dio;
  static const _storage = FlutterSecureStorage();

  static Future<void> _saveTokens(String access, String refresh) async {
    await Future.wait([
      _storage.write(key: 'access_token', value: access),
      _storage.write(key: 'refresh_token', value: refresh),
    ]);
  }

  Future<bool> hasSession() async => await _storage.read(key: 'access_token') != null;

  Future<void> clearSession() async {
    await Future.wait([_storage.delete(key: 'access_token'), _storage.delete(key: 'refresh_token')]);
  }

  Future<Map<String, dynamic>> currentUser() async {
    final response = await dio.get<Map<String, dynamic>>('/api/v1/auth/me');
    return _dataMap(response.data);
  }

  Future<Map<String, dynamic>> authenticateWithGoogle(String idToken) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/api/v1/auth/google',
      data: {'idToken': idToken, 'deviceId': await deviceId()},
    );
    final data = _dataMap(response.data);
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    if (accessToken is! String || refreshToken is! String) {
      throw const FormatException('Authentication response does not contain tokens');
    }
    await _saveTokens(accessToken, refreshToken);
    final user = data['user'];
    if (user is Map<String, dynamic>) return user;
    if (user is Map) return Map<String, dynamic>.from(user);
    throw const FormatException('Authentication response does not contain a user');
  }

  Future<void> logout() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    try {
      await dio.post<Map<String, dynamic>>('/api/v1/auth/logout', data: {'refreshToken': refreshToken});
    } catch (_) {
      // Local logout must still complete when the network is unavailable.
    } finally {
      await clearSession();
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
    try {
      await dio.post(
        '/api/v1/events',
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
    try {
      await dio.post(
        '/api/v1/qr',
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
    try {
      await dio.post(
        '/api/v1/media-cleanups',
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
    const retryDelays = [Duration.zero, Duration(milliseconds: 500), Duration(seconds: 1)];
    for (var attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt] > Duration.zero) await Future<void>.delayed(retryDelays[attempt]);
      try {
        final response = await dio.post<Map<String, dynamic>>('/api/v1/media-scans', data: payload);
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
    try {
      final prepared = await dio.post<Map<String, dynamic>>(
        '/api/v1/media-scans/assets/$assetId/upload',
        data: {'mimeType': mimeType, 'bytes': length},
      );
      final upload = _dataMap(prepared.data);
      final uploadUrl = upload['uploadUrl'];
      final mode = upload['mode'];
      if (uploadUrl is! String || (mode != 'direct' && mode != 'proxy')) return false;

      if (mode == 'proxy') {
        await dio.put<Map<String, dynamic>>(
          uploadUrl,
          data: stream,
          options: Options(
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
        options: Options(receiveTimeout: const Duration(minutes: 30)),
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

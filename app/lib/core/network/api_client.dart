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

  Future<void> bootstrap() async {
    if (await _storage.read(key: 'access_token') != null) return;
    try {
      final response = await dio.post<Map<String, dynamic>>(
        '/api/v1/auth/anonymous',
        data: {'deviceId': await deviceId()},
      );
      final data = response.data?['data'] as Map<String, dynamic>;
      await _saveTokens(data['accessToken'] as String, data['refreshToken'] as String);
    } catch (_) {}
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
}

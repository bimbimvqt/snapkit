import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

abstract interface class CaptionDataSource {
  Future<Map<String, dynamic>> generateCaptions({
    required List<String> images,
    required String tone,
    required String platform,
    required String language,
    String? contextHint,
  });
}

class CaptionRemoteDataSource implements CaptionDataSource {
  const CaptionRemoteDataSource({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  @override
  Future<Map<String, dynamic>> generateCaptions({
    required List<String> images,
    required String tone,
    required String platform,
    required String language,
    String? contextHint,
  }) async {
    final response = await _apiClient.dio.post<Map<String, dynamic>>(
      '/api/v1/ai/caption/generate',
      data: {
        'images': images,
        'tone': tone,
        'platform': platform,
        'language': language,
        if (contextHint != null && contextHint.isNotEmpty) 'contextHint': contextHint,
      },
      options: Options(sendTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 35)),
    );
    final data = response.data?['data'];
    if (data is! Map) throw const FormatException('Invalid AI caption response');
    return Map<String, dynamic>.from(data);
  }
}

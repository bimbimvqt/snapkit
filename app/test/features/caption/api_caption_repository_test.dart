import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/caption/data/api_caption_repository.dart';
import 'package:snapkit/features/caption/data/caption_remote_datasource.dart';
import 'package:snapkit/features/caption/domain/caption_failure.dart';
import 'package:snapkit/features/caption/domain/caption_models.dart';

class FakeCaptionDataSource implements CaptionDataSource {
  FakeCaptionDataSource({this.response = const {}, this.error});

  final Map<String, dynamic> response;
  final Object? error;
  List<String>? receivedImages;

  @override
  Future<Map<String, dynamic>> generateCaptions({
    required List<String> images,
    required String tone,
    required String platform,
    required String language,
    String? contextHint,
  }) async {
    receivedImages = images;
    if (error case final exception?) throw exception;
    return response;
  }
}

void main() {
  late Directory temporaryDirectory;
  late String imagePath;

  setUpAll(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp('snapkit-caption-test-');
    final file = File('${temporaryDirectory.path}/pixel.png');
    await file.writeAsBytes(
      base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
    );
    imagePath = file.path;
  });

  tearDownAll(() => temporaryDirectory.delete(recursive: true));

  test('compresses images locally and parses a valid result', () async {
    final dataSource = FakeCaptionDataSource(
      response: {
        'detectedTags': ['ảnh'],
        'vibeSummary': 'Một ảnh thử nghiệm',
        'variants': [
          {
            'id': 'v1',
            'hookHeadline': 'Mở đầu',
            'body': 'Nội dung hợp lệ',
            'oneLiner': 'Ngắn gọn',
            'suggestedAudio': 'Nhạc nhẹ',
            'viralScore': 80,
          },
        ],
        'hashtags': {
          'trending': ['#Snapkit'],
          'topic': <String>[],
          'community': <String>[],
        },
        'usage': {'used': 1, 'limit': 3},
      },
    );
    final repository = ApiCaptionRepository(remoteDataSource: dataSource);

    final result = await repository.generateCaptions(
      imagePaths: [imagePath],
      tone: CaptionTone.meme,
      platform: SocialPlatform.instagram,
    );

    expect(result.variants.single.body, 'Nội dung hợp lệ');
    expect(result.usage.remaining, 2);
    expect(dataSource.receivedImages?.single, startsWith('data:image/jpeg;base64,'));
  });

  test('maps an unavailable file to a friendly image failure', () async {
    final repository = ApiCaptionRepository(remoteDataSource: FakeCaptionDataSource());

    expect(
      () => repository.generateCaptions(
        imagePaths: ['${temporaryDirectory.path}/missing.jpg'],
        tone: CaptionTone.meme,
        platform: SocialPlatform.instagram,
      ),
      throwsA(isA<CaptionInvalidImageFailure>()),
    );
  });

  test('maps a daily-limit response without exposing the HTTP exception', () async {
    final options = RequestOptions(path: '/api/v1/ai/caption/generate');
    final repository = ApiCaptionRepository(
      remoteDataSource: FakeCaptionDataSource(
        error: DioException(
          requestOptions: options,
          response: Response<void>(requestOptions: options, statusCode: 429),
          type: DioExceptionType.badResponse,
        ),
      ),
    );

    expect(
      () => repository.generateCaptions(
        imagePaths: [imagePath],
        tone: CaptionTone.meme,
        platform: SocialPlatform.instagram,
      ),
      throwsA(isA<CaptionDailyLimitFailure>()),
    );
  });
}

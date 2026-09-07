import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

import '../domain/caption_failure.dart';
import '../domain/caption_models.dart';
import '../domain/caption_repository.dart';
import 'caption_remote_datasource.dart';

class ApiCaptionRepository implements CaptionRepository {
  const ApiCaptionRepository({required CaptionDataSource remoteDataSource}) : _remoteDataSource = remoteDataSource;

  static const maximumImages = 4;
  final CaptionDataSource _remoteDataSource;

  @override
  Future<CaptionGenerationResult> generateCaptions({
    required List<String> imagePaths,
    required CaptionTone tone,
    required SocialPlatform platform,
    String language = 'vi',
    String? contextHint,
  }) async {
    if (imagePaths.isEmpty || imagePaths.length > maximumImages) throw const CaptionInvalidImageFailure();

    try {
      final images = await _encodeImages(imagePaths);
      final data = await _remoteDataSource.generateCaptions(
        images: images,
        tone: tone.key,
        platform: platform.key,
        language: language,
        contextHint: contextHint?.trim(),
      );
      final result = CaptionGenerationResult.fromJson(data);
      if (result.variants.isEmpty) throw const CaptionUnexpectedFailure();
      return result;
    } on CaptionFailure {
      rethrow;
    } on DioException catch (error) {
      throw switch (error.response?.statusCode) {
        401 => const CaptionUnauthorizedFailure(),
        429 => const CaptionDailyLimitFailure(),
        503 => const CaptionUnavailableFailure(),
        null => const CaptionNetworkFailure(),
        _ => const CaptionUnexpectedFailure(),
      };
    } on FormatException {
      throw const CaptionUnexpectedFailure();
    } catch (_) {
      throw const CaptionUnexpectedFailure();
    }
  }

  Future<List<String>> _encodeImages(List<String> paths) async {
    final encoded = <String>[];
    for (var start = 0; start < paths.length; start += 2) {
      final end = start + 2 < paths.length ? start + 2 : paths.length;
      encoded.addAll(await Future.wait(paths.sublist(start, end).map(_encodeImage)));
    }
    return encoded;
  }

  Future<String> _encodeImage(String path) async {
    final file = File(path);
    if (!await file.exists()) throw const CaptionInvalidImageFailure();
    try {
      final jpegBytes = await compute(_prepareCaptionImage, await file.readAsBytes());
      return 'data:image/jpeg;base64,${base64Encode(jpegBytes)}';
    } catch (_) {
      throw const CaptionInvalidImageFailure();
    }
  }
}

Uint8List _prepareCaptionImage(Uint8List rawBytes) {
  final decoded = img.decodeImage(rawBytes);
  if (decoded == null) throw const FormatException('Unsupported image data');
  const maximumDimension = 960;
  final needsResize = decoded.width > maximumDimension || decoded.height > maximumDimension;
  final processed = needsResize
      ? img.copyResize(
          decoded,
          width: decoded.width >= decoded.height ? maximumDimension : null,
          height: decoded.height > decoded.width ? maximumDimension : null,
          interpolation: img.Interpolation.linear,
        )
      : decoded;
  return Uint8List.fromList(img.encodeJpg(processed, quality: 72));
}

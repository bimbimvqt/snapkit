import 'caption_models.dart';

abstract interface class CaptionRepository {
  Future<CaptionGenerationResult> generateCaptions({
    required List<String> imagePaths,
    required CaptionTone tone,
    required SocialPlatform platform,
    String language = 'vi',
    String? contextHint,
  });
}

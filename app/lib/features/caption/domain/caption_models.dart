enum CaptionTone {
  meme('Meme / Hài hước', 'meme', 'Hài hước, gần gũi, phù hợp bạn bè hoặc các tình huống vui'),
  flirty('Thả thính', 'flirty', 'Ngọt ngào, tinh tế, phù hợp ảnh chân dung hoặc cặp đôi'),
  genz('Gen Z', 'genz', 'Ngắn, giàu năng lượng và sử dụng ngôn ngữ mạng xã hội'),
  foodie('Ẩm thực', 'foodie', 'Mô tả món ăn hấp dẫn nhưng vẫn đúng nội dung ảnh'),
  deep('Sâu lắng', 'deep', 'Tâm trạng, chiêm nghiệm cuộc sống hoặc ảnh phong cảnh'),
  brand('Thương hiệu', 'brand', 'Chuyên nghiệp, rõ thông điệp và có lời kêu gọi hành động');

  const CaptionTone(this.label, this.key, this.description);
  final String label;
  final String key;
  final String description;
}

enum SocialPlatform {
  instagram('Instagram', 'instagram'),
  threads('Threads', 'threads'),
  tiktok('TikTok', 'tiktok'),
  facebook('Facebook', 'facebook');

  const SocialPlatform(this.label, this.key);
  final String label;
  final String key;
}

class CaptionVariant {
  const CaptionVariant({
    required this.id,
    required this.hookHeadline,
    required this.body,
    required this.oneLiner,
    required this.suggestedAudio,
    required this.viralScore,
  });

  final String id;
  final String hookHeadline;
  final String body;
  final String oneLiner;
  final String suggestedAudio;
  final int viralScore;

  factory CaptionVariant.fromJson(Map<String, dynamic> json) {
    return CaptionVariant(
      id: _string(json['id'], fallback: 'v1'),
      hookHeadline: _string(json['hookHeadline']),
      body: _string(json['body']),
      oneLiner: _string(json['oneLiner']),
      suggestedAudio: _string(json['suggestedAudio']),
      viralScore: ((json['viralScore'] as num?)?.toInt() ?? 0).clamp(0, 100),
    );
  }
}

class CaptionHashtags {
  const CaptionHashtags({this.trending = const [], this.topic = const [], this.community = const []});

  final List<String> trending;
  final List<String> topic;
  final List<String> community;

  List<String> get all => {...trending, ...topic, ...community}.toList(growable: false);

  String get asFormattedString => all.join(' ');

  factory CaptionHashtags.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const CaptionHashtags();
    return CaptionHashtags(
      trending: _strings(json['trending']),
      topic: _strings(json['topic']),
      community: _strings(json['community']),
    );
  }
}

class CaptionUsage {
  const CaptionUsage({required this.used, required this.limit});

  final int used;
  final int limit;

  int get remaining => (limit - used).clamp(0, limit);

  factory CaptionUsage.fromJson(Object? value) {
    final json = _map(value);
    final limit = ((json?['limit'] as num?)?.toInt() ?? 0).clamp(0, 1000);
    final used = ((json?['used'] as num?)?.toInt() ?? 0).clamp(0, limit);
    return CaptionUsage(used: used, limit: limit);
  }
}

class CaptionGenerationResult {
  const CaptionGenerationResult({
    required this.detectedTags,
    required this.vibeSummary,
    required this.variants,
    required this.hashtags,
    required this.usage,
  });

  final List<String> detectedTags;
  final String vibeSummary;
  final List<CaptionVariant> variants;
  final CaptionHashtags hashtags;
  final CaptionUsage usage;

  factory CaptionGenerationResult.fromJson(Map<String, dynamic> json) {
    return CaptionGenerationResult(
      detectedTags: _strings(json['detectedTags']),
      vibeSummary: _string(json['vibeSummary']),
      variants:
          (json['variants'] as List?)
              ?.map(_map)
              .whereType<Map<String, dynamic>>()
              .map(CaptionVariant.fromJson)
              .where((variant) => variant.body.isNotEmpty)
              .toList(growable: false) ??
          const <CaptionVariant>[],
      hashtags: CaptionHashtags.fromJson(_map(json['hashtags'])),
      usage: CaptionUsage.fromJson(json['usage']),
    );
  }
}

Map<String, dynamic>? _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

String _string(Object? value, {String fallback = ''}) {
  if (value is! String) return fallback;
  final trimmed = value.trim();
  return trimmed.isEmpty ? fallback : trimmed;
}

List<String> _strings(Object? value) {
  if (value is! List) return const [];
  return value.map(_string).where((item) => item.isNotEmpty).toSet().take(20).toList(growable: false);
}

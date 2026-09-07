import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:snapkit/core/styles/app_dimensions.dart';
import 'package:snapkit/core/theme/snapkit_theme.dart';
import 'package:snapkit/features/caption/application/caption_studio_controller.dart';
import 'package:snapkit/features/caption/domain/caption_failure.dart';
import 'package:snapkit/features/caption/domain/caption_models.dart';
import 'package:snapkit/features/caption/domain/caption_repository.dart';
import 'package:snapkit/features/caption/presentation/caption_studio_screen.dart';

class MockCaptionRepository implements CaptionRepository {
  @override
  Future<CaptionGenerationResult> generateCaptions({
    required List<String> imagePaths,
    required CaptionTone tone,
    required SocialPlatform platform,
    String language = 'vi',
    String? contextHint,
  }) async {
    return sampleResult;
  }
}

const sampleResult = CaptionGenerationResult(
  detectedTags: ['Cặp đôi', 'Meme Recreation'],
  vibeSummary: 'Meme recreation cực hài hước',
  variants: [
    CaptionVariant(
      id: 'v1',
      hookHeadline: "Dừng lại 2 giây để chứng kiến 'Match My Freak'!",
      body: 'Người ta yêu nhau: Em là công chúa... Còn chúng tôi...',
      oneLiner: 'Tình yêu không tự nhiên sinh ra, nó chỉ chuyển từ dỗ dành sang dìm hàng.',
      suggestedAudio: 'Until I Found You (Lofi Meme)',
      viralScore: 98,
    ),
    CaptionVariant(
      id: 'v2',
      hookHeadline: 'Ai làm đạt hơn? Vote 1 cho chú khỉ tuyết!',
      body: 'Khi bạn bảo người yêu chụp ảnh nàng thơ...',
      oneLiner: 'Một phát ăn ngay ảnh dìm.',
      suggestedAudio: 'Funny Sound Meme',
      viralScore: 92,
    ),
  ],
  hashtags: CaptionHashtags(
    trending: ['#MatchMyFreak', '#CoupleMemes'],
    topic: ['#HaiHuoc'],
    community: ['#SnapkitAI'],
  ),
  usage: CaptionUsage(used: 1, limit: 3),
);

class ControlledCaptionRepository implements CaptionRepository {
  ControlledCaptionRepository(this.resultFuture);

  final Future<CaptionGenerationResult> resultFuture;
  int callCount = 0;

  @override
  Future<CaptionGenerationResult> generateCaptions({
    required List<String> imagePaths,
    required CaptionTone tone,
    required SocialPlatform platform,
    String language = 'vi',
    String? contextHint,
  }) {
    callCount += 1;
    return resultFuture;
  }
}

void main() {
  setUp(() {
    Get.reset();
  });

  test('CaptionStudioController manages tones, variants and generation lifecycle', () async {
    final controller = CaptionStudioController(repository: MockCaptionRepository());
    Get.put(controller);

    expect(controller.selectedTone.value, CaptionTone.meme);
    expect(controller.selectedPlatform.value, SocialPlatform.instagram);

    controller.selectTone(CaptionTone.foodie);
    expect(controller.selectedTone.value, CaptionTone.foodie);

    controller.selectedImages.add('mock_path_1.jpg');
    controller.selectedImages.add('mock_path_2.jpg');

    await controller.generateCaptions();

    expect(controller.result.value, isNotNull);
    expect(controller.result.value!.variants.length, 2);
    expect(controller.currentVariant?.hookHeadline, contains('Match My Freak'));

    controller.selectVariantIndex(1);
    expect(controller.currentVariant?.hookHeadline, contains('Ai làm đạt hơn'));

    final copied = await controller.copyCurrentCaption();
    expect(copied, isTrue);

    final tagsCopied = await controller.copyHashtags();
    expect(tagsCopied, isTrue);
  });

  test('CaptionStudioController blocks duplicate generation requests', () async {
    final completer = Completer<CaptionGenerationResult>();
    final repository = ControlledCaptionRepository(completer.future);
    final controller = CaptionStudioController(repository: repository)..selectedImages.add('mock.jpg');

    final firstRequest = controller.generateCaptions();
    final secondRequest = controller.generateCaptions();

    expect(repository.callCount, 1);
    expect(controller.isLoading.value, isTrue);
    completer.complete(sampleResult);
    await Future.wait([firstRequest, secondRequest]);
    expect(controller.isLoading.value, isFalse);
    expect(controller.result.value, sampleResult);
  });

  test('generation cannot start while an image picker is pending', () async {
    final repository = ControlledCaptionRepository(Future.value(sampleResult));
    final controller = CaptionStudioController(repository: repository)
      ..selectedImages.add('existing.jpg')
      ..isPickingImage.value = true;

    expect(controller.canGenerate, isFalse);
    await controller.generateCaptions();
    expect(repository.callCount, 0);
  });

  test('generation completing after disposal cannot publish a result', () async {
    final completer = Completer<CaptionGenerationResult>();
    final controller = CaptionStudioController(repository: ControlledCaptionRepository(completer.future))
      ..selectedImages.add('existing.jpg');
    final pending = controller.generateCaptions();
    controller.onClose();
    completer.complete(sampleResult);
    await pending;
    expect(controller.result.value, isNull);
  });

  test('CaptionStudioController exposes friendly domain failure messages', () async {
    final repository = ControlledCaptionRepository(Future.error(const CaptionDailyLimitFailure()));
    final controller = CaptionStudioController(repository: repository)..selectedImages.add('mock.jpg');

    await controller.generateCaptions();

    expect(controller.result.value, isNull);
    expect(controller.errorMessage.value, contains('hết lượt AI'));
  });

  testWidgets('CaptionStudioScreen renders UI, tone chips and Instagram card', (tester) async {
    final controller = CaptionStudioController(repository: MockCaptionRepository());
    Get.put(controller);

    controller.selectedImages.add('mock_image.jpg');
    await controller.generateCaptions();

    await tester.pumpWidget(
      ScreenUtilInit(
        designSize: const Size(393, 852),
        builder: (context, _) => GetMaterialApp(theme: SnapkitTheme.dark(), home: const CaptionStudioScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('AI Social Studio'), findsOneWidget);
    expect(find.text('CHỌN TONE GIỌNG'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Tạo nội dung AI'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Tạo nội dung AI'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Match My Freak'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.textContaining('Match My Freak'), findsOneWidget);
    expect(find.text('Sao chép Caption'), findsOneWidget);
    expect(find.text('Copy Tags'), findsOneWidget);
  });

  testWidgets('AI Social Studio remains usable across phone, landscape, tablet and large text', (tester) async {
    final scenarios = <({Size size, ThemeMode mode, double textScale, bool reducedMotion})>[
      (size: const Size(375, 812), mode: ThemeMode.light, textScale: 1, reducedMotion: false),
      (size: const Size(375, 812), mode: ThemeMode.dark, textScale: 1.5, reducedMotion: true),
      (size: const Size(812, 375), mode: ThemeMode.dark, textScale: 1, reducedMotion: true),
      (size: const Size(768, 1024), mode: ThemeMode.light, textScale: 1.5, reducedMotion: true),
    ];

    for (final scenario in scenarios) {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = scenario.size;
      Get.reset();
      final controller = CaptionStudioController(repository: MockCaptionRepository());
      controller.result.value = sampleResult;
      Get.put(controller);

      await tester.pumpWidget(
        ScreenUtilInit(
          designSize: AppDimensions.designSize,
          minTextAdapt: true,
          splitScreenMode: true,
          fontSizeResolver: AppDimensions.resolveFontSize,
          builder: (context, _) => GetMaterialApp(
            theme: SnapkitTheme.light(),
            darkTheme: SnapkitTheme.dark(),
            themeMode: scenario.mode,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scenario.textScale), disableAnimations: scenario.reducedMotion),
              child: child ?? const SizedBox.shrink(),
            ),
            home: const CaptionStudioScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).first, const Offset(0, -2400));
      await tester.pumpAndSettle();

      expect(find.text('Sao chép Caption'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

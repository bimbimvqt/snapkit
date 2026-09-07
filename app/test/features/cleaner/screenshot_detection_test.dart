import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/cleaner/data/screenshot_detection.dart';

void main() {
  group('ScreenshotDetection', () {
    test('recognizes common Android screenshot albums and filenames', () {
      expect(ScreenshotDetection.matches('Pictures/Screenshots/'), isTrue);
      expect(ScreenshotDetection.matches('DCIM/Screenshots/'), isTrue);
      expect(ScreenshotDetection.matches('Screenshot_20260904-123456.png'), isTrue);
      expect(ScreenshotDetection.matches('Screen Shot 2026-09-04 at 12.34.56.png'), isTrue);
      expect(ScreenshotDetection.matches('screen_capture_20260904.jpg'), isTrue);
      expect(ScreenshotDetection.matches('screencap_20260904.png'), isTrue);
      expect(ScreenshotDetection.matches('Screenshot20260904.png'), isTrue);
      expect(ScreenshotDetection.matches('screenshot1.jpg'), isTrue);
    });

    test('recognizes localized screenshot album names', () {
      expect(ScreenshotDetection.matches('Ảnh chụp màn hình'), isTrue);
      expect(ScreenshotDetection.matches('Chụp màn hình'), isTrue);
      expect(ScreenshotDetection.matches('Capturas de pantalla'), isTrue);
      expect(ScreenshotDetection.matches('Captura de ecrã'), isTrue);
      expect(ScreenshotDetection.matches('スクリーンショット'), isTrue);
      expect(ScreenshotDetection.matches('截图'), isTrue);
      expect(ScreenshotDetection.matches('屏幕快照'), isTrue);
      expect(ScreenshotDetection.matches('螢幕快照'), isTrue);
      expect(ScreenshotDetection.matches('Istantanee'), isTrue);
      expect(ScreenshotDetection.matches('Снимки экрана'), isTrue);
      expect(ScreenshotDetection.matches('Bildschirmfotos'), isTrue);
    });

    test('recognizes the PhotoKit screenshot media subtype', () {
      expect(ScreenshotDetection.matchesDarwinSubtype(ScreenshotDetection.darwinPhotoScreenshotSubtype), isTrue);
      expect(ScreenshotDetection.matchesDarwinSubtype((1 << 2) | (1 << 3)), isTrue);
      expect(ScreenshotDetection.matchesDarwinSubtype(1 << 3), isFalse);
    });

    test('does not classify unrelated albums as screenshots', () {
      expect(ScreenshotDetection.matches('DCIM/Camera/'), isFalse);
      expect(ScreenshotDetection.matches('Pictures/Snapkit/'), isFalse);
      expect(ScreenshotDetection.matches('screenshotting-guide.jpg'), isFalse);
      expect(ScreenshotDetection.matches('screenplay-draft.pdf'), isFalse);
      expect(ScreenshotDetection.matches(null), isFalse);
    });
  });
}

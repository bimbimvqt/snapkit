import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/cleaner/presentation/widgets/video_preview.dart';

void main() {
  group('video preview formatting', () {
    test('formats short and hour-long timestamps', () {
      expect(formatVideoTimestamp(const Duration(seconds: 9)), '0:09');
      expect(formatVideoTimestamp(const Duration(minutes: 3, seconds: 7)), '3:07');
      expect(formatVideoTimestamp(const Duration(hours: 1, minutes: 2, seconds: 5)), '1:02:05');
    });

    test('formats whole and fractional playback speeds', () {
      expect(formatPlaybackSpeed(1), '1×');
      expect(formatPlaybackSpeed(1.25), '1.25×');
      expect(formatPlaybackSpeed(2), '2×');
    });
  });

  group('video preview seeking', () {
    test('moves within the video duration', () {
      expect(
        calculateVideoSeekPosition(
          position: const Duration(seconds: 20),
          offset: const Duration(seconds: 10),
          duration: const Duration(minutes: 1),
        ),
        const Duration(seconds: 30),
      );
    });

    test('clamps seeking at the start and end', () {
      expect(
        calculateVideoSeekPosition(
          position: const Duration(seconds: 5),
          offset: const Duration(seconds: -10),
          duration: const Duration(minutes: 1),
        ),
        Duration.zero,
      );
      expect(
        calculateVideoSeekPosition(
          position: const Duration(seconds: 55),
          offset: const Duration(seconds: 10),
          duration: const Duration(minutes: 1),
        ),
        const Duration(minutes: 1),
      );
    });
  });
}

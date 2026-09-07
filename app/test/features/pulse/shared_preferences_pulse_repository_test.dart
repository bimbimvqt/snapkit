import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:snapkit/features/pulse/data/shared_preferences_pulse_repository.dart';
import 'package:snapkit/features/pulse/domain/pulse_progress.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('round trips weekly progress, streak, grace and reward', () async {
    final repository = SharedPreferencesPulseRepository();
    final snapshot = PulseSnapshot(
      progress: PulseProgress(
        weekStartedAt: DateTime(2026, 8, 31),
        cleanedItems: 5,
        cleanedBytes: 20 * 1024 * 1024,
        focusedItems: 2,
        qrActions: 1,
        completedAt: DateTime(2026, 9, 4, 10),
      ),
      streakWeeks: 3,
      lastCompletedWeekStart: DateTime(2026, 8, 31),
      lastGraceWeekStart: DateTime(2026, 8, 17),
      interstitialFreeUntil: DateTime(2026, 9, 7, 10),
    );

    await repository.write(snapshot);
    final restored = await repository.read();

    expect(restored?.progress.cleanedItems, 5);
    expect(restored?.progress.cleanedBytes, 20 * 1024 * 1024);
    expect(restored?.streakWeeks, 3);
    expect(restored?.lastGraceWeekStart, DateTime(2026, 8, 17));
    expect(await repository.isInterstitialRewardActive(DateTime(2026, 9, 6)), isTrue);
    expect(await repository.isInterstitialRewardActive(DateTime(2026, 9, 8)), isFalse);
  });

  test('invalid stored counters are clamped without breaking the feature', () async {
    SharedPreferences.setMockInitialValues({
      'pulse.week_started_at': 20260902,
      'pulse.cleaned_items': -3,
      'pulse.focused_items': -1,
    });

    final restored = await SharedPreferencesPulseRepository().read();

    expect(restored?.progress.weekStartedAt, DateTime(2026, 8, 31));
    expect(restored?.progress.cleanedItems, 0);
    expect(restored?.progress.focusedItems, 0);
  });
}

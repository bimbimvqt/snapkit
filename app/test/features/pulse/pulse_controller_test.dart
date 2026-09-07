import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/pulse/application/pulse_controller.dart';
import 'package:snapkit/features/pulse/domain/pulse_progress.dart';
import 'package:snapkit/features/pulse/domain/pulse_repository.dart';

void main() {
  test('completing the three weekly goals creates a streak and a three-day ad reward', () async {
    final repository = _MemoryPulseRepository();
    final now = DateTime(2026, 9, 4, 10);
    final controller = PulseController(repository: repository, clock: () => now);

    await controller.recordCleanup(removedCount: 5, bytesFreed: 12 * 1024 * 1024, focusedCount: 2);
    await controller.recordQrAction();

    expect(controller.progress.isComplete, isTrue);
    expect(controller.snapshot.streakWeeks, 1);
    expect(controller.snapshot.interstitialFreeUntil, now.add(const Duration(days: 3)));
    expect(repository.value?.progress.cleanedBytes, 12 * 1024 * 1024);
  });

  test('a single missed week uses grace and preserves the streak', () async {
    final currentWeek = DateTime(2026, 9, 14);
    final previousCompletedWeek = currentWeek.subtract(const Duration(days: 14));
    final repository = _MemoryPulseRepository(
      PulseSnapshot(
        progress: PulseProgress.empty(previousCompletedWeek),
        streakWeeks: 4,
        lastCompletedWeekStart: previousCompletedWeek,
      ),
    );
    final controller = PulseController(repository: repository, clock: () => currentWeek);
    controller.onInit();

    await controller.recordCleanup(removedCount: 5, bytesFreed: 1024, focusedCount: 2);
    await controller.recordQrAction();

    expect(controller.snapshot.streakWeeks, 5);
    expect(controller.snapshot.lastGraceWeekStart, DateTime(2026, 9, 7));
  });

  test('two missed weeks reset the streak without punishing current progress', () async {
    final currentWeek = DateTime(2026, 9, 21);
    final repository = _MemoryPulseRepository(
      PulseSnapshot(
        progress: PulseProgress.empty(DateTime(2026, 8, 31)),
        streakWeeks: 8,
        lastCompletedWeekStart: DateTime(2026, 8, 31),
      ),
    );
    final controller = PulseController(repository: repository, clock: () => currentWeek);
    controller.onInit();

    await controller.recordQrAction();

    expect(controller.snapshot.streakWeeks, 0);
    expect(controller.progress.qrActions, 1);
    expect(controller.progress.weekStartedAt, currentWeek);
  });

  test('concurrent actions are serialized and do not lose progress', () async {
    final repository = _MemoryPulseRepository();
    final controller = PulseController(repository: repository, clock: () => DateTime(2026, 9, 4));

    await Future.wait(List.generate(4, (_) => controller.recordQrAction()));

    expect(controller.progress.qrActions, 4);
    expect(repository.value?.progress.qrActions, 4);
  });
}

class _MemoryPulseRepository implements PulseRepository {
  _MemoryPulseRepository([this.value]);

  PulseSnapshot? value;

  @override
  Future<PulseSnapshot?> read() async => value;

  @override
  Future<void> write(PulseSnapshot snapshot) async => value = snapshot;

  @override
  Future<bool> isInterstitialRewardActive(DateTime now) async {
    final rewardUntil = value?.interstitialFreeUntil;
    return rewardUntil != null && rewardUntil.isAfter(now);
  }
}

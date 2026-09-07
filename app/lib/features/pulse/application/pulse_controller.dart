import 'dart:async';

import 'package:get/get.dart';

import '../domain/pulse_progress.dart';
import '../domain/pulse_repository.dart';

enum PulseStatus { loading, ready }

class PulseController extends GetxController implements PulseActivityRecorder {
  PulseController({required PulseRepository repository, DateTime Function()? clock})
    : _repository = repository,
      _clock = clock ?? DateTime.now,
      snapshot = PulseSnapshot(progress: PulseProgress.empty(pulseWeekStart((clock ?? DateTime.now)())));

  final PulseRepository _repository;
  final DateTime Function() _clock;
  PulseSnapshot snapshot;
  PulseStatus status = PulseStatus.loading;
  Future<void>? _initialization;
  Future<void> _mutationQueue = Future<void>.value();

  PulseProgress get progress => snapshot.progress;
  bool get rewardIsActive {
    final rewardUntil = snapshot.interstitialFreeUntil;
    return rewardUntil != null && rewardUntil.isAfter(_clock());
  }

  @override
  void onInit() {
    super.onInit();
    _initialization = _load();
  }

  Future<void> refreshForCurrentWeek() => _enqueue((now) async {});

  @override
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount}) {
    if (removedCount <= 0) return Future<void>.value();
    return _enqueue((now) async {
      final current = snapshot.progress;
      snapshot = snapshot.copyWith(
        progress: current.copyWith(
          cleanedItems: current.cleanedItems + removedCount,
          cleanedBytes: current.cleanedBytes + (bytesFreed < 0 ? 0 : bytesFreed),
          focusedItems: current.focusedItems + focusedCount.clamp(0, removedCount),
        ),
      );
      _completeIfNeeded(now);
    });
  }

  @override
  Future<void> recordQrAction() => _enqueue((now) async {
    final current = snapshot.progress;
    snapshot = snapshot.copyWith(progress: current.copyWith(qrActions: current.qrActions + 1));
    _completeIfNeeded(now);
  });

  Future<void> _load() async {
    try {
      final stored = await _repository.read();
      if (stored != null) snapshot = _normalized(stored, _clock());
    } catch (_) {
      snapshot = PulseSnapshot(progress: PulseProgress.empty(pulseWeekStart(_clock())));
    } finally {
      status = PulseStatus.ready;
      update();
    }
  }

  Future<void> _enqueue(Future<void> Function(DateTime now) mutation) {
    final operation = _mutationQueue.then((_) async {
      await (_initialization ?? Future<void>.value());
      final now = _clock();
      snapshot = _normalized(snapshot, now);
      await mutation(now);
      try {
        await _repository.write(snapshot);
      } catch (_) {
        // Pulse is a local retention aid and must never block the tool the user just completed.
      }
      status = PulseStatus.ready;
      update();
    });
    _mutationQueue = operation.catchError((_) {});
    return operation;
  }

  PulseSnapshot _normalized(PulseSnapshot value, DateTime now) {
    final currentWeekStart = pulseWeekStart(now);
    var normalized = value;
    if (value.progress.weekStartedAt != currentWeekStart) {
      normalized = value.copyWith(progress: PulseProgress.empty(currentWeekStart));
    }

    final lastCompleted = normalized.lastCompletedWeekStart;
    if (lastCompleted != null && _weeksBetween(pulseWeekStart(lastCompleted), currentWeekStart) > 2) {
      normalized = normalized.copyWith(streakWeeks: 0);
    }
    return normalized;
  }

  void _completeIfNeeded(DateTime now) {
    final current = snapshot.progress;
    if (!current.isComplete || current.completedAt != null) return;

    final weekStart = current.weekStartedAt;
    final lastCompleted = snapshot.lastCompletedWeekStart;
    final weeksSinceLast = lastCompleted == null ? null : _weeksBetween(pulseWeekStart(lastCompleted), weekStart);
    final nextStreak = switch (weeksSinceLast) {
      null => 1,
      0 => snapshot.streakWeeks,
      1 || 2 => snapshot.streakWeeks + 1,
      _ => 1,
    };
    final graceWeek = weeksSinceLast == 2 ? weekStart.subtract(const Duration(days: 7)) : snapshot.lastGraceWeekStart;
    snapshot = snapshot.copyWith(
      progress: current.copyWith(completedAt: now),
      streakWeeks: nextStreak,
      lastCompletedWeekStart: weekStart,
      lastGraceWeekStart: graceWeek,
      interstitialFreeUntil: now.add(PulseGoals.interstitialRewardDuration),
    );
  }

  int _weeksBetween(DateTime first, DateTime second) {
    final firstDay = DateTime.utc(first.year, first.month, first.day);
    final secondDay = DateTime.utc(second.year, second.month, second.day);
    return secondDay.difference(firstDay).inDays ~/ 7;
  }
}

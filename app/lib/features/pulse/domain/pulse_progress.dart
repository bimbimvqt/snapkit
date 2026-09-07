abstract final class PulseGoals {
  static const cleanedItems = 5;
  static const focusedItems = 2;
  static const qrActions = 1;
  static const interstitialRewardDuration = Duration(days: 3);
}

class PulseProgress {
  const PulseProgress({
    required this.weekStartedAt,
    this.cleanedItems = 0,
    this.cleanedBytes = 0,
    this.focusedItems = 0,
    this.qrActions = 0,
    this.completedAt,
  });

  factory PulseProgress.empty(DateTime weekStartedAt) => PulseProgress(weekStartedAt: weekStartedAt);

  final DateTime weekStartedAt;
  final int cleanedItems;
  final int cleanedBytes;
  final int focusedItems;
  final int qrActions;
  final DateTime? completedAt;

  bool get isComplete =>
      cleanedItems >= PulseGoals.cleanedItems &&
      focusedItems >= PulseGoals.focusedItems &&
      qrActions >= PulseGoals.qrActions;

  int get completedGoals =>
      (cleanedItems >= PulseGoals.cleanedItems ? 1 : 0) +
      (focusedItems >= PulseGoals.focusedItems ? 1 : 0) +
      (qrActions >= PulseGoals.qrActions ? 1 : 0);

  double get completion {
    final cleanup = (cleanedItems / PulseGoals.cleanedItems).clamp(0.0, 1.0);
    final focused = (focusedItems / PulseGoals.focusedItems).clamp(0.0, 1.0);
    final qr = (qrActions / PulseGoals.qrActions).clamp(0.0, 1.0);
    return (cleanup + focused + qr) / 3;
  }

  PulseProgress copyWith({
    int? cleanedItems,
    int? cleanedBytes,
    int? focusedItems,
    int? qrActions,
    DateTime? completedAt,
  }) => PulseProgress(
    weekStartedAt: weekStartedAt,
    cleanedItems: cleanedItems ?? this.cleanedItems,
    cleanedBytes: cleanedBytes ?? this.cleanedBytes,
    focusedItems: focusedItems ?? this.focusedItems,
    qrActions: qrActions ?? this.qrActions,
    completedAt: completedAt ?? this.completedAt,
  );
}

class PulseSnapshot {
  const PulseSnapshot({
    required this.progress,
    this.streakWeeks = 0,
    this.lastCompletedWeekStart,
    this.lastGraceWeekStart,
    this.interstitialFreeUntil,
  });

  final PulseProgress progress;
  final int streakWeeks;
  final DateTime? lastCompletedWeekStart;
  final DateTime? lastGraceWeekStart;
  final DateTime? interstitialFreeUntil;

  PulseSnapshot copyWith({
    PulseProgress? progress,
    int? streakWeeks,
    DateTime? lastCompletedWeekStart,
    DateTime? lastGraceWeekStart,
    DateTime? interstitialFreeUntil,
  }) => PulseSnapshot(
    progress: progress ?? this.progress,
    streakWeeks: streakWeeks ?? this.streakWeeks,
    lastCompletedWeekStart: lastCompletedWeekStart ?? this.lastCompletedWeekStart,
    lastGraceWeekStart: lastGraceWeekStart ?? this.lastGraceWeekStart,
    interstitialFreeUntil: interstitialFreeUntil ?? this.interstitialFreeUntil,
  );
}

DateTime pulseWeekStart(DateTime value) {
  final date = DateTime(value.year, value.month, value.day);
  return date.subtract(Duration(days: date.weekday - DateTime.monday));
}

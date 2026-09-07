import 'package:shared_preferences/shared_preferences.dart';

import '../domain/pulse_progress.dart';
import '../domain/pulse_repository.dart';

class SharedPreferencesPulseRepository implements PulseRepository {
  static const _weekStartedAtKey = 'pulse.week_started_at';
  static const _cleanedItemsKey = 'pulse.cleaned_items';
  static const _cleanedBytesKey = 'pulse.cleaned_bytes';
  static const _focusedItemsKey = 'pulse.focused_items';
  static const _qrActionsKey = 'pulse.qr_actions';
  static const _completedAtKey = 'pulse.completed_at';
  static const _streakWeeksKey = 'pulse.streak_weeks';
  static const _lastCompletedWeekStartKey = 'pulse.last_completed_week_start';
  static const _lastGraceWeekStartKey = 'pulse.last_grace_week_start';
  static const _interstitialFreeUntilKey = 'pulse.interstitial_free_until';

  @override
  Future<PulseSnapshot?> read() async {
    final preferences = await SharedPreferences.getInstance();
    final weekStartedAt = _weekDate(preferences.getInt(_weekStartedAtKey));
    if (weekStartedAt == null) return null;

    return PulseSnapshot(
      progress: PulseProgress(
        weekStartedAt: pulseWeekStart(weekStartedAt),
        cleanedItems: _nonNegative(preferences.getInt(_cleanedItemsKey)),
        cleanedBytes: _nonNegative(preferences.getInt(_cleanedBytesKey)),
        focusedItems: _nonNegative(preferences.getInt(_focusedItemsKey)),
        qrActions: _nonNegative(preferences.getInt(_qrActionsKey)),
        completedAt: _date(preferences.getInt(_completedAtKey)),
      ),
      streakWeeks: _nonNegative(preferences.getInt(_streakWeeksKey)),
      lastCompletedWeekStart: _weekDate(preferences.getInt(_lastCompletedWeekStartKey)),
      lastGraceWeekStart: _weekDate(preferences.getInt(_lastGraceWeekStartKey)),
      interstitialFreeUntil: _date(preferences.getInt(_interstitialFreeUntilKey)),
    );
  }

  @override
  Future<void> write(PulseSnapshot snapshot) async {
    final preferences = await SharedPreferences.getInstance();
    final progress = snapshot.progress;
    await Future.wait([
      preferences.setInt(_weekStartedAtKey, _weekCode(progress.weekStartedAt)),
      preferences.setInt(_cleanedItemsKey, progress.cleanedItems),
      preferences.setInt(_cleanedBytesKey, progress.cleanedBytes),
      preferences.setInt(_focusedItemsKey, progress.focusedItems),
      preferences.setInt(_qrActionsKey, progress.qrActions),
      preferences.setInt(_streakWeeksKey, snapshot.streakWeeks),
      _writeDate(preferences, _completedAtKey, progress.completedAt),
      _writeWeek(preferences, _lastCompletedWeekStartKey, snapshot.lastCompletedWeekStart),
      _writeWeek(preferences, _lastGraceWeekStartKey, snapshot.lastGraceWeekStart),
      _writeDate(preferences, _interstitialFreeUntilKey, snapshot.interstitialFreeUntil),
    ]);
  }

  @override
  Future<bool> isInterstitialRewardActive(DateTime now) async {
    final preferences = await SharedPreferences.getInstance();
    final rewardUntil = _date(preferences.getInt(_interstitialFreeUntilKey));
    return rewardUntil != null && rewardUntil.isAfter(now);
  }

  Future<bool> _writeDate(SharedPreferences preferences, String key, DateTime? value) =>
      value == null ? preferences.remove(key) : preferences.setInt(key, value.millisecondsSinceEpoch);

  Future<bool> _writeWeek(SharedPreferences preferences, String key, DateTime? value) =>
      value == null ? preferences.remove(key) : preferences.setInt(key, _weekCode(value));

  DateTime? _date(int? milliseconds) =>
      milliseconds == null || milliseconds <= 0 ? null : DateTime.fromMillisecondsSinceEpoch(milliseconds);

  DateTime? _weekDate(int? code) {
    if (code == null || code < 10000101 || code > 99991231) return null;
    final year = code ~/ 10000;
    final month = (code % 10000) ~/ 100;
    final day = code % 100;
    final value = DateTime(year, month, day);
    if (value.year != year || value.month != month || value.day != day) return null;
    return pulseWeekStart(value);
  }

  int _weekCode(DateTime value) => value.year * 10000 + value.month * 100 + value.day;

  int _nonNegative(int? value) => value == null || value < 0 ? 0 : value;
}

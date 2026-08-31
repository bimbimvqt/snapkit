import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/styles/app_colors.dart';
import '../../../../core/styles/app_dimensions.dart';
import '../../../../core/styles/app_text_styles.dart';

const _seekInterval = Duration(seconds: 10);
const _controlsTimeout = Duration(seconds: 3);
const _playbackSpeeds = <double>[.5, .75, 1, 1.25, 1.5, 2];

class MediaVideoPreview extends StatefulWidget {
  const MediaVideoPreview({super.key, required this.asset, required this.isActive});

  final AssetEntity asset;
  final bool isActive;

  @override
  State<MediaVideoPreview> createState() => _MediaVideoPreviewState();
}

class _MediaVideoPreviewState extends State<MediaVideoPreview> {
  VideoPlayerController? _controller;
  late final Future<void> _initialize = _initializeVideo();
  Timer? _controlsTimer;
  Timer? _seekFeedbackTimer;
  bool _controlsVisible = true;
  bool _isScrubbing = false;
  bool _wasPlayingBeforeScrub = false;
  bool _wasCompleted = false;
  double? _scrubPositionMilliseconds;
  _SeekDirection? _seekFeedback;
  Offset? _doubleTapPosition;

  Future<void> _initializeVideo() async {
    final file = await widget.asset.file;
    if (file == null) throw StateError('Video file is unavailable');

    final controller = VideoPlayerController.file(file);
    _controller = controller;
    try {
      await controller.initialize();
    } catch (_) {
      if (identical(_controller, controller)) {
        _controller = null;
        await controller.dispose();
      }
      rethrow;
    }

    if (!mounted) {
      if (identical(_controller, controller)) {
        _controller = null;
        await controller.dispose();
      }
      return;
    }
    controller.addListener(_handleControllerValue);
    setState(() {});
  }

  void _handleControllerValue() {
    final controller = _controller;
    if (controller == null || !mounted) return;
    final isCompleted = controller.value.isCompleted;
    if (isCompleted && !_wasCompleted) {
      _controlsTimer?.cancel();
      setState(() => _controlsVisible = true);
    }
    _wasCompleted = isCompleted;
  }

  @override
  void didUpdateWidget(covariant MediaVideoPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive && !widget.isActive) {
      _controlsTimer?.cancel();
      final controller = _controller;
      if (controller != null) unawaited(controller.pause());
      if (!_controlsVisible) setState(() => _controlsVisible = true);
    }
  }

  @override
  void dispose() {
    _controlsTimer?.cancel();
    _seekFeedbackTimer?.cancel();
    final controller = _controller;
    _controller = null;
    controller?.removeListener(_handleControllerValue);
    if (controller != null) unawaited(controller.dispose());
    super.dispose();
  }

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    if (_controlsVisible) _scheduleControlsHide();
  }

  Future<void> _togglePlayback(VideoPlayerController controller) async {
    _controlsTimer?.cancel();
    if (controller.value.isPlaying) {
      await controller.pause();
      if (mounted) setState(() => _controlsVisible = true);
      return;
    }

    if (controller.value.position >= controller.value.duration) {
      await controller.seekTo(Duration.zero);
    }
    await controller.play();
    _scheduleControlsHide();
  }

  Future<void> _seekBy(VideoPlayerController controller, Duration delta) async {
    final target = calculateVideoSeekPosition(
      position: controller.value.position,
      offset: delta,
      duration: controller.value.duration,
    );
    await controller.seekTo(target);
    if (!mounted) return;
    setState(() {
      _seekFeedback = delta.isNegative ? _SeekDirection.backward : _SeekDirection.forward;
      _controlsVisible = true;
    });
    _seekFeedbackTimer?.cancel();
    _seekFeedbackTimer = Timer(const Duration(milliseconds: 650), () {
      if (mounted) setState(() => _seekFeedback = null);
    });
    _scheduleControlsHide();
    HapticFeedback.selectionClick();
  }

  void _handleDoubleTap(VideoPlayerController controller, double width) {
    final position = _doubleTapPosition;
    if (position == null) return;
    _seekBy(controller, position.dx < width / 2 ? -_seekInterval : _seekInterval);
  }

  void _startScrubbing(VideoPlayerController controller, double value) {
    _controlsTimer?.cancel();
    _wasPlayingBeforeScrub = controller.value.isPlaying;
    if (_wasPlayingBeforeScrub) controller.pause();
    setState(() {
      _isScrubbing = true;
      _scrubPositionMilliseconds = value;
    });
  }

  void _updateScrubbing(double value) => setState(() => _scrubPositionMilliseconds = value);

  Future<void> _finishScrubbing(VideoPlayerController controller, double value) async {
    await controller.seekTo(Duration(milliseconds: value.round()));
    if (_wasPlayingBeforeScrub) await controller.play();
    if (!mounted) return;
    setState(() {
      _isScrubbing = false;
      _scrubPositionMilliseconds = null;
    });
    _scheduleControlsHide();
  }

  Future<void> _selectPlaybackSpeed(VideoPlayerController controller) async {
    _controlsTimer?.cancel();
    final currentSpeed = controller.value.playbackSpeed;
    final selectedSpeed = await showModalBottomSheet<double>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.midnightLime.darkSurface,
      barrierColor: AppColors.black.withValues(alpha: .68),
      builder: (context) => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(AppDimensions.space20, 0, AppDimensions.space20, AppDimensions.space20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Tốc độ phát', style: AppTextStyles.titleMedium.copyWith(color: AppColors.white)),
              SizedBox(height: AppDimensions.space12),
              Wrap(
                spacing: AppDimensions.space8,
                runSpacing: AppDimensions.space8,
                children: _playbackSpeeds
                    .map(
                      (speed) => ChoiceChip(
                        label: Text(
                          formatPlaybackSpeed(speed),
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: speed == currentSpeed ? AppColors.darkInk : AppColors.white,
                          ),
                        ),
                        selected: speed == currentSpeed,
                        selectedColor: AppColors.midnightLime.accent,
                        backgroundColor: AppColors.midnightLime.darkRaised,
                        side: BorderSide(color: AppColors.midnightLime.darkOutline),
                        onSelected: (_) => Navigator.of(context).pop(speed),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted) return;
    if (selectedSpeed != null) {
      await controller.setPlaybackSpeed(selectedSpeed);
      HapticFeedback.selectionClick();
    }
    _scheduleControlsHide();
  }

  void _scheduleControlsHide() {
    _controlsTimer?.cancel();
    final controller = _controller;
    if (controller == null || !controller.value.isPlaying || _isScrubbing || !widget.isActive) {
      return;
    }
    _controlsTimer = Timer(_controlsTimeout, () {
      if (mounted) {
        setState(() => _controlsVisible = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialize,
    builder: (context, snapshot) {
      final controller = _controller;
      if (snapshot.hasError) {
        return const _VideoPreviewMessage(message: 'Không thể phát video này.');
      }
      if (snapshot.connectionState != ConnectionState.done || controller == null) {
        return const Center(child: CircularProgressIndicator());
      }

      return Center(
        child: AspectRatio(
          aspectRatio: controller.value.aspectRatio,
          child: ValueListenableBuilder<VideoPlayerValue>(
            valueListenable: controller,
            builder: (context, value, _) => LayoutBuilder(
              builder: (context, constraints) => GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _toggleControls,
                onDoubleTapDown: (details) => _doubleTapPosition = details.localPosition,
                onDoubleTap: () => _handleDoubleTap(controller, constraints.maxWidth),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    VideoPlayer(controller),
                    _VideoControls(
                      value: value,
                      visible: _controlsVisible,
                      scrubPositionMilliseconds: _scrubPositionMilliseconds,
                      onTogglePlayback: () => _togglePlayback(controller),
                      onSeekBackward: () => _seekBy(controller, -_seekInterval),
                      onSeekForward: () => _seekBy(controller, _seekInterval),
                      onScrubStart: (position) => _startScrubbing(controller, position),
                      onScrubUpdate: _updateScrubbing,
                      onScrubEnd: (position) => _finishScrubbing(controller, position),
                      onSelectSpeed: () => _selectPlaybackSpeed(controller),
                    ),
                    _SeekFeedback(direction: _seekFeedback),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _VideoControls extends StatelessWidget {
  const _VideoControls({
    required this.value,
    required this.visible,
    required this.scrubPositionMilliseconds,
    required this.onTogglePlayback,
    required this.onSeekBackward,
    required this.onSeekForward,
    required this.onScrubStart,
    required this.onScrubUpdate,
    required this.onScrubEnd,
    required this.onSelectSpeed,
  });

  final VideoPlayerValue value;
  final bool visible;
  final double? scrubPositionMilliseconds;
  final VoidCallback onTogglePlayback;
  final VoidCallback onSeekBackward;
  final VoidCallback onSeekForward;
  final ValueChanged<double> onScrubStart;
  final ValueChanged<double> onScrubUpdate;
  final ValueChanged<double> onScrubEnd;
  final VoidCallback onSelectSpeed;

  @override
  Widget build(BuildContext context) {
    final durationMilliseconds = math.max(1, value.duration.inMilliseconds).toDouble();
    final progressMilliseconds = (scrubPositionMilliseconds ?? value.position.inMilliseconds.toDouble())
        .clamp(0, durationMilliseconds)
        .toDouble();
    final position = Duration(milliseconds: progressMilliseconds.round());

    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 200),
        child: Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.black.withValues(alpha: .32),
                    AppColors.black.withValues(alpha: .09),
                    AppColors.black.withValues(alpha: .72),
                  ],
                  stops: [0, .48, 1],
                ),
              ),
            ),
            Align(
              alignment: const Alignment(0, -.18),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _RoundVideoButton(
                    icon: Icons.replay_10_rounded,
                    tooltip: 'Tua lùi 10 giây',
                    onPressed: onSeekBackward,
                  ),
                  SizedBox(width: AppDimensions.space12),
                  _RoundVideoButton(
                    icon: value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    tooltip: value.isPlaying ? 'Tạm dừng' : 'Phát video',
                    onPressed: onTogglePlayback,
                    emphasized: true,
                  ),
                  SizedBox(width: AppDimensions.space12),
                  _RoundVideoButton(
                    icon: Icons.forward_10_rounded,
                    tooltip: 'Tua tới 10 giây',
                    onPressed: onSeekForward,
                  ),
                ],
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: SafeArea(
                top: false,
                minimum: EdgeInsets.fromLTRB(
                  AppDimensions.space12,
                  AppDimensions.space12,
                  AppDimensions.space12,
                  AppDimensions.space8,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _VideoProgressSlider(
                      value: progressMilliseconds,
                      durationMilliseconds: durationMilliseconds,
                      bufferedFraction: _bufferedFraction(value),
                      onChangeStart: onScrubStart,
                      onChanged: onScrubUpdate,
                      onChangeEnd: onScrubEnd,
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${formatVideoTimestamp(position)} / ${formatVideoTimestamp(value.duration)}',
                                maxLines: 1,
                                style: AppTextStyles.caption.copyWith(
                                  color: AppColors.white,
                                  fontWeight: FontWeight.w700,
                                  shadows: const [Shadow(blurRadius: 6, color: AppColors.black)],
                                ),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: AppDimensions.space8),
                        TextButton(
                          onPressed: onSelectSpeed,
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.white,
                            minimumSize: const Size(AppDimensions.minTouchTarget, AppDimensions.minTouchTarget),
                            padding: EdgeInsets.symmetric(horizontal: AppDimensions.space12),
                            backgroundColor: AppColors.black.withValues(alpha: .52),
                          ),
                          child: FittedBox(child: Text(formatPlaybackSpeed(value.playbackSpeed))),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoProgressSlider extends StatelessWidget {
  const _VideoProgressSlider({
    required this.value,
    required this.durationMilliseconds,
    required this.bufferedFraction,
    required this.onChangeStart,
    required this.onChanged,
    required this.onChangeEnd,
  });

  final double value;
  final double durationMilliseconds;
  final double bufferedFraction;
  final ValueChanged<double> onChangeStart;
  final ValueChanged<double> onChanged;
  final ValueChanged<double> onChangeEnd;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: AppDimensions.minTouchTarget,
    child: Stack(
      alignment: Alignment.centerLeft,
      children: [
        Container(height: 3.h, color: AppColors.white.withValues(alpha: .26)),
        FractionallySizedBox(
          widthFactor: bufferedFraction,
          child: Container(height: 3.h, color: AppColors.white.withValues(alpha: .52)),
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 3.h,
            activeTrackColor: Theme.of(context).colorScheme.primary,
            inactiveTrackColor: AppColors.transparent,
            thumbColor: Theme.of(context).colorScheme.primary,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
            overlayColor: Theme.of(context).colorScheme.primary.withValues(alpha: .2),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
          ),
          child: Slider(
            value: value,
            max: durationMilliseconds,
            onChangeStart: onChangeStart,
            onChanged: onChanged,
            onChangeEnd: onChangeEnd,
            semanticFormatterCallback: (milliseconds) =>
                formatVideoTimestamp(Duration(milliseconds: milliseconds.round())),
          ),
        ),
      ],
    ),
  );
}

class _RoundVideoButton extends StatelessWidget {
  const _RoundVideoButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.emphasized = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.black.withValues(alpha: emphasized ? .72 : .5),
    shape: const CircleBorder(),
    child: IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      constraints: BoxConstraints.tightFor(
        width: emphasized ? 64.r : AppDimensions.minTouchTarget,
        height: emphasized ? 64.r : AppDimensions.minTouchTarget,
      ),
      iconSize: emphasized ? 36.sp : 27.sp,
      icon: Icon(icon, color: AppColors.white),
    ),
  );
}

class _SeekFeedback extends StatelessWidget {
  const _SeekFeedback({required this.direction});

  final _SeekDirection? direction;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedOpacity(
      opacity: direction == null ? 0 : 1,
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 160),
      child: Align(
        alignment: direction == _SeekDirection.backward ? const Alignment(-.62, 0) : const Alignment(.62, 0),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: AppDimensions.space12, vertical: AppDimensions.space8),
          decoration: BoxDecoration(
            color: AppColors.black.withValues(alpha: .68),
            borderRadius: BorderRadius.circular(AppDimensions.radius20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                direction == _SeekDirection.backward ? Icons.replay_10_rounded : Icons.forward_10_rounded,
                color: AppColors.white,
                size: 22.sp,
              ),
              SizedBox(width: AppDimensions.space4),
              Text(
                '10 giây',
                style: AppTextStyles.caption.copyWith(color: AppColors.white, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _VideoPreviewMessage extends StatelessWidget {
  const _VideoPreviewMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.video_file_outlined, color: AppColors.white),
        SizedBox(height: AppDimensions.space12),
        Text(message, style: AppTextStyles.body.copyWith(color: AppColors.white)),
      ],
    ),
  );
}

enum _SeekDirection { backward, forward }

double _bufferedFraction(VideoPlayerValue value) {
  if (value.duration <= Duration.zero || value.buffered.isEmpty) return 0;
  final bufferedEnd = value.buffered.map((range) => range.end).reduce((a, b) => a > b ? a : b);
  return (bufferedEnd.inMilliseconds / value.duration.inMilliseconds).clamp(0, 1);
}

String formatVideoTimestamp(Duration duration) {
  final totalSeconds = math.max(0, duration.inSeconds);
  final hours = totalSeconds ~/ Duration.secondsPerHour;
  final minutes = (totalSeconds ~/ Duration.secondsPerMinute) % Duration.minutesPerHour;
  final seconds = totalSeconds % Duration.secondsPerMinute;
  if (hours > 0) {
    return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

String formatPlaybackSpeed(double speed) => speed == speed.roundToDouble() ? '${speed.round()}×' : '$speed×';

Duration calculateVideoSeekPosition({
  required Duration position,
  required Duration offset,
  required Duration duration,
}) {
  final targetMilliseconds = (position + offset).inMilliseconds.clamp(0, math.max(0, duration.inMilliseconds)).toInt();
  return Duration(milliseconds: targetMilliseconds);
}

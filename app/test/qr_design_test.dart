import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/qr/application/qr_editor_controller.dart';
import 'package:snapkit/features/qr/data/device_qr_logo_picker.dart';
import 'package:snapkit/features/qr/domain/qr_design.dart';
import 'package:snapkit/features/qr/domain/qr_gallery_saver.dart';
import 'package:snapkit/features/qr/domain/qr_repository.dart';
import 'package:snapkit/features/pulse/domain/pulse_repository.dart';

import 'support/noop_pulse_activity_recorder.dart';

void main() {
  test('decorative presets remain scannable and serialize the extended contract', () {
    for (final preset in QrDesignPreset.values) {
      expect(QrDesign.fromPreset(preset).isScannable, isTrue, reason: preset.name);
    }

    final payload = QrDesign.fromPreset(QrDesignPreset.floral)
        .copyWith(
          logoKind: QrLogoKind.custom,
          logoShape: QrLogoShape.circle,
          customLogoBytes: Uint8List.fromList([1, 2, 3]),
        )
        .toPayload();

    expect(payload, containsPair('frameStyle', 'floral'));
    expect(payload, containsPair('frameSecondaryColor', '#F59E0B'));
    expect(payload, containsPair('icon', 'custom'));
    expect(payload, containsPair('logoShape', 'circle'));
    expect(payload.values.whereType<Uint8List>(), isEmpty);
  });

  test('editor saves the encoded Wi-Fi content once and tracks safe design metadata', () async {
    final repository = _FakeQrRepository();
    final pulse = _RecordingPulseActivity();
    final controller = QrEditorController(
      repository: repository,
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
      pulseRecorder: pulse,
      isFeatureEnabled: () => true,
    );

    controller.setKind(QrContentKind.wifi);
    controller.setContent('Snapkit;Guest');
    controller.setWifiPassword('safe:password');
    controller.applyPreset(QrDesignPreset.rainbow);
    final result = await controller.save();

    expect(result, QrSaveResult.saved);
    expect(repository.savedContent, r'WIFI:T:WPA;S:Snapkit\;Guest;P:safe\:password;;');
    expect(repository.savedStyle, containsPair('frameStyle', 'rainbow'));
    expect(repository.trackedFrameStyle, 'rainbow');
    expect(controller.isSaved, isTrue);
    expect(pulse.qrActions, 1);
  });

  test('editing during save keeps the newer draft unsaved and tracks the saved design', () async {
    final completer = Completer<bool>();
    final repository = _FakeQrRepository()..saveCompleter = completer;
    final controller = QrEditorController(
      repository: repository,
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
      pulseRecorder: const NoopPulseActivityRecorder(),
      isFeatureEnabled: () => true,
    )..setContent('first draft');

    final pending = controller.save();
    controller.setContent('new draft');
    controller.applyPreset(QrDesignPreset.rainbow);
    completer.complete(true);
    expect(await pending, QrSaveResult.saved);
    expect(repository.savedContent, 'first draft');
    expect(repository.trackedFrameStyle, QrDesign.initial.frameStyle.wireName);
    expect(controller.isSaved, isFalse);
  });

  test('session reset clears Wi-Fi secrets and rejects completion of the previous account save', () async {
    final completer = Completer<bool>();
    final pulse = _RecordingPulseActivity();
    final controller =
        QrEditorController(
            repository: _FakeQrRepository()..saveCompleter = completer,
            logoPicker: _FakeQrLogoPicker(),
            gallerySaver: _FakeQrGallerySaver(),
            pulseRecorder: pulse,
            isFeatureEnabled: () => true,
          )
          ..setKind(QrContentKind.wifi)
          ..setContent('private network')
          ..setWifiPassword('secret');
    final pending = controller.save();
    controller.resetForSessionChange();
    expect(controller.content, isEmpty);
    expect(controller.wifiPassword, isEmpty);
    expect(controller.isSaved, isFalse);
    completer.complete(true);
    expect(await pending, QrSaveResult.invalid);
    expect(controller.isSaved, isFalse);
    expect(pulse.qrActions, 0);
  });

  test('Pulse failure cannot turn a completed save or gallery export into an error', () async {
    final controller = QrEditorController(
      repository: _FakeQrRepository(),
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
      pulseRecorder: _FailingPulseActivity(),
      isFeatureEnabled: () => true,
    )..setContent('local QR');

    expect(await controller.save(), QrSaveResult.saved);
    expect(await controller.saveToGallery(Uint8List.fromList([1, 2, 3])), QrGallerySaveResult.saved);
  });

  test('custom logo stays local while its rendering options remain in history', () async {
    final repository = _FakeQrRepository();
    final controller = QrEditorController(
      repository: repository,
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
      pulseRecorder: const NoopPulseActivityRecorder(),
      isFeatureEnabled: () => true,
    );

    await controller.pickCustomLogo();
    controller.setContent('https://snapkit.local');
    await controller.save();

    expect(controller.design.hasCustomLogo, isTrue);
    expect(repository.savedStyle, containsPair('icon', 'custom'));
    expect(repository.savedStyle?.values.whereType<Uint8List>(), isEmpty);
  });

  test('editor exports PNG bytes to the device gallery and resets the exporting state', () async {
    final gallerySaver = _FakeQrGallerySaver();
    final controller = QrEditorController(
      repository: _FakeQrRepository(),
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: gallerySaver,
      pulseRecorder: const NoopPulseActivityRecorder(),
      isFeatureEnabled: () => true,
    );
    controller.setContent('https://snapkit.local');

    final result = await controller.saveToGallery(Uint8List.fromList([137, 80, 78, 71]));

    expect(result, QrGallerySaveResult.saved);
    expect(gallerySaver.savedBytes, [137, 80, 78, 71]);
    expect(controller.isExporting, isFalse);
  });

  test('editor maps denied gallery permission to a recoverable result', () async {
    final controller = QrEditorController(
      repository: _FakeQrRepository(),
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(denyPermission: true),
      pulseRecorder: const NoopPulseActivityRecorder(),
      isFeatureEnabled: () => true,
    );
    controller.setContent('https://snapkit.local');

    final result = await controller.saveToGallery(Uint8List.fromList([137, 80, 78, 71]));

    expect(result, QrGallerySaveResult.permissionDenied);
    expect(controller.isExporting, isFalse);
  });
}

class _FakeQrRepository implements QrRepository {
  Completer<bool>? saveCompleter;
  String? savedContent;
  Map<String, Object>? savedStyle;
  String? trackedFrameStyle;

  @override
  Future<bool> save({required String kind, required String content, required Map<String, Object> style}) async {
    savedContent = content;
    savedStyle = style;
    return saveCompleter?.future ?? true;
  }

  @override
  Future<void> trackCreated({required String kind, required String frameStyle, required String icon}) async {
    trackedFrameStyle = frameStyle;
  }
}

class _FakeQrLogoPicker implements QrLogoPicker {
  @override
  Future<PickedQrLogo?> pick() async => PickedQrLogo(Uint8List.fromList([1, 2, 3]));
}

class _FakeQrGallerySaver implements QrGallerySaver {
  _FakeQrGallerySaver({this.denyPermission = false});

  final bool denyPermission;
  Uint8List? savedBytes;

  @override
  Future<void> savePng(Uint8List bytes) async {
    if (denyPermission) throw const QrGalleryPermissionException();
    savedBytes = bytes;
  }
}

class _RecordingPulseActivity implements PulseActivityRecorder {
  int qrActions = 0;

  @override
  Future<void> recordCleanup({required int removedCount, required int bytesFreed, required int focusedCount}) async {}

  @override
  Future<void> recordQrAction() async => qrActions += 1;
}

class _FailingPulseActivity extends _RecordingPulseActivity {
  @override
  Future<void> recordQrAction() async => throw StateError('storage unavailable');
}

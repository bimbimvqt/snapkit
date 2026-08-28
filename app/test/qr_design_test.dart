import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/qr/application/qr_editor_controller.dart';
import 'package:snapkit/features/qr/data/device_qr_logo_picker.dart';
import 'package:snapkit/features/qr/domain/qr_design.dart';
import 'package:snapkit/features/qr/domain/qr_gallery_saver.dart';
import 'package:snapkit/features/qr/domain/qr_repository.dart';

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
    final controller = QrEditorController(
      repository: repository,
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
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
  });

  test('custom logo stays local while its rendering options remain in history', () async {
    final repository = _FakeQrRepository();
    final controller = QrEditorController(
      repository: repository,
      logoPicker: _FakeQrLogoPicker(),
      gallerySaver: _FakeQrGallerySaver(),
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
      isFeatureEnabled: () => true,
    );
    controller.setContent('https://snapkit.local');

    final result = await controller.saveToGallery(Uint8List.fromList([137, 80, 78, 71]));

    expect(result, QrGallerySaveResult.permissionDenied);
    expect(controller.isExporting, isFalse);
  });
}

class _FakeQrRepository implements QrRepository {
  String? savedContent;
  Map<String, Object>? savedStyle;
  String? trackedFrameStyle;

  @override
  Future<bool> save({required String kind, required String content, required Map<String, Object> style}) async {
    savedContent = content;
    savedStyle = style;
    return true;
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

import 'dart:typed_data';

import 'package:get/get.dart';

import '../data/device_qr_logo_picker.dart';
import '../domain/qr_design.dart';
import '../domain/qr_gallery_saver.dart';
import '../domain/qr_repository.dart';

enum QrSaveResult { saved, unavailable, invalid, failed }

enum QrGallerySaveResult { saved, invalid, permissionDenied, failed }

class QrEditorController extends GetxController {
  QrEditorController({
    required QrRepository repository,
    required QrLogoPicker logoPicker,
    required QrGallerySaver gallerySaver,
    required bool Function() isFeatureEnabled,
  }) : _repository = repository,
       _logoPicker = logoPicker,
       _gallerySaver = gallerySaver,
       _isFeatureEnabled = isFeatureEnabled;

  final QrRepository _repository;
  final QrLogoPicker _logoPicker;
  final QrGallerySaver _gallerySaver;
  final bool Function() _isFeatureEnabled;

  QrContentKind kind = QrContentKind.text;
  QrDesign design = QrDesign.initial;
  QrDesignPreset? activePreset = QrDesignPreset.classic;
  String content = '';
  String wifiPassword = '';
  bool isSaving = false;
  bool isSaved = false;
  bool isPickingLogo = false;
  bool isExporting = false;
  String? logoError;

  String get encodedContent {
    final value = content.trim();
    if (kind == QrContentKind.wifi) {
      return value.isEmpty ? '' : 'WIFI:T:WPA;S:${_escape(value)};P:${_escape(wifiPassword)};;';
    }
    return value;
  }

  bool get canSave => encodedContent.isNotEmpty && design.isScannable && !isSaving && !isExporting;
  bool get canExport => encodedContent.isNotEmpty && design.isScannable && !isExporting && !isSaving;

  void setKind(QrContentKind value) {
    if (kind == value) return;
    kind = value;
    _markChanged();
  }

  void setContent(String value) {
    content = value;
    _markChanged();
  }

  void setWifiPassword(String value) {
    wifiPassword = value;
    _markChanged();
  }

  void updateDesign(QrDesign value) {
    design = value;
    activePreset = null;
    _markChanged();
  }

  void applyPreset(QrDesignPreset preset) {
    design = QrDesign.fromPreset(preset);
    activePreset = preset;
    _markChanged();
  }

  void resetDesign() {
    design = QrDesign.initial;
    activePreset = QrDesignPreset.classic;
    logoError = null;
    _markChanged();
  }

  Future<void> pickCustomLogo() async {
    if (isPickingLogo) return;
    isPickingLogo = true;
    logoError = null;
    update();
    try {
      final picked = await _logoPicker.pick();
      if (picked == null) return;
      design = design.copyWith(logoKind: QrLogoKind.custom, customLogoBytes: picked.bytes);
      activePreset = null;
      isSaved = false;
    } on QrLogoTooLargeException {
      logoError = 'Ảnh vẫn lớn hơn 1 MB sau khi tối ưu. Hãy chọn ảnh khác nhẹ hơn.';
    } catch (_) {
      logoError = 'Không thể đọc ảnh này. Hãy thử ảnh PNG hoặc JPG khác.';
    } finally {
      isPickingLogo = false;
      update();
    }
  }

  void removeCustomLogo() {
    design = design.copyWith(logoKind: QrLogoKind.none, clearCustomLogo: true);
    activePreset = null;
    logoError = null;
    _markChanged();
  }

  Future<QrSaveResult> save() async {
    if (isSaving) return QrSaveResult.invalid;
    if (!_isFeatureEnabled()) return QrSaveResult.unavailable;
    if (!canSave) return QrSaveResult.invalid;
    isSaving = true;
    isSaved = false;
    update();
    try {
      final saved = await _repository.save(kind: kind.wireName, content: encodedContent, style: design.toPayload());
      if (!saved) return QrSaveResult.failed;
      await _repository.trackCreated(
        kind: kind.wireName,
        frameStyle: design.frameStyle.wireName,
        icon: design.logoKind.wireName,
      );
      isSaved = true;
      return QrSaveResult.saved;
    } catch (_) {
      return QrSaveResult.failed;
    } finally {
      isSaving = false;
      update();
    }
  }

  Future<QrGallerySaveResult> saveToGallery(Uint8List pngBytes) async {
    if (isExporting || !canExport || pngBytes.isEmpty) return QrGallerySaveResult.invalid;
    isExporting = true;
    update();
    try {
      await _gallerySaver.savePng(pngBytes);
      return QrGallerySaveResult.saved;
    } on QrGalleryPermissionException {
      return QrGallerySaveResult.permissionDenied;
    } catch (_) {
      return QrGallerySaveResult.failed;
    } finally {
      isExporting = false;
      update();
    }
  }

  void _markChanged() {
    isSaved = false;
    update();
  }

  String _escape(String value) =>
      value.replaceAll(r'\', r'\\').replaceAll(';', r'\;').replaceAll(',', r'\,').replaceAll(':', r'\:');
}

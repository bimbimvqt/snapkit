import 'dart:typed_data';

import 'package:get/get.dart';

import '../../pulse/domain/pulse_repository.dart';
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
    required PulseActivityRecorder pulseRecorder,
    required bool Function() isFeatureEnabled,
  }) : _repository = repository,
       _logoPicker = logoPicker,
       _gallerySaver = gallerySaver,
       _pulseRecorder = pulseRecorder,
       _isFeatureEnabled = isFeatureEnabled;

  final QrRepository _repository;
  final QrLogoPicker _logoPicker;
  final QrGallerySaver _gallerySaver;
  final PulseActivityRecorder _pulseRecorder;
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
  int _inputVersion = 0;
  int _sessionVersion = 0;
  bool _disposed = false;

  @override
  void onClose() {
    _disposed = true;
    super.onClose();
  }

  void resetForSessionChange() {
    _sessionVersion++;
    _inputVersion++;
    kind = QrContentKind.text;
    design = QrDesign.initial;
    activePreset = QrDesignPreset.classic;
    content = '';
    wifiPassword = '';
    logoError = null;
    isSaved = false;
    if (!_disposed) update();
  }

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
    if (_disposed || isPickingLogo) return;
    isPickingLogo = true;
    final sessionVersion = _sessionVersion;
    logoError = null;
    update();
    try {
      final picked = await _logoPicker.pick();
      if (_disposed || sessionVersion != _sessionVersion || picked == null) return;
      design = design.copyWith(logoKind: QrLogoKind.custom, customLogoBytes: picked.bytes);
      activePreset = null;
      isSaved = false;
      _inputVersion++;
    } on QrLogoTooLargeException {
      if (!_disposed && sessionVersion == _sessionVersion) {
        logoError = 'Ảnh vẫn lớn hơn 1 MB sau khi tối ưu. Hãy chọn ảnh khác nhẹ hơn.';
      }
    } catch (_) {
      if (!_disposed && sessionVersion == _sessionVersion) {
        logoError = 'Không thể đọc ảnh này. Hãy thử ảnh PNG hoặc JPG khác.';
      }
    } finally {
      isPickingLogo = false;
      if (!_disposed) update();
    }
  }

  void removeCustomLogo() {
    design = design.copyWith(logoKind: QrLogoKind.none, clearCustomLogo: true);
    activePreset = null;
    logoError = null;
    _markChanged();
  }

  Future<QrSaveResult> save() async {
    if (_disposed || isSaving) return QrSaveResult.invalid;
    if (!_isFeatureEnabled()) return QrSaveResult.unavailable;
    if (!canSave) return QrSaveResult.invalid;
    isSaving = true;
    isSaved = false;
    final requestVersion = _inputVersion;
    final sessionVersion = _sessionVersion;
    final savedKind = kind;
    final savedDesign = design;
    final savedContent = encodedContent;
    update();
    try {
      final saved = await _repository.save(
        kind: savedKind.wireName,
        content: savedContent,
        style: savedDesign.toPayload(),
      );
      if (_disposed || sessionVersion != _sessionVersion) return QrSaveResult.invalid;
      if (!saved) return QrSaveResult.failed;
      if (!_disposed && requestVersion == _inputVersion) isSaved = true;
      await _recordPulse();
      if (_disposed || sessionVersion != _sessionVersion) return QrSaveResult.saved;
      try {
        await _repository.trackCreated(
          kind: savedKind.wireName,
          frameStyle: savedDesign.frameStyle.wireName,
          icon: savedDesign.logoKind.wireName,
        );
      } catch (_) {
        // Analytics is best effort and must not turn a successful local action into an error.
      }
      return QrSaveResult.saved;
    } catch (_) {
      return QrSaveResult.failed;
    } finally {
      isSaving = false;
      if (!_disposed) update();
    }
  }

  Future<QrGallerySaveResult> saveToGallery(Uint8List pngBytes) async {
    if (_disposed || isExporting || !canExport || pngBytes.isEmpty) return QrGallerySaveResult.invalid;
    isExporting = true;
    final sessionVersion = _sessionVersion;
    update();
    try {
      await _gallerySaver.savePng(pngBytes);
      if (_disposed || sessionVersion != _sessionVersion) return QrGallerySaveResult.invalid;
      await _recordPulse();
      return QrGallerySaveResult.saved;
    } on QrGalleryPermissionException {
      return QrGallerySaveResult.permissionDenied;
    } catch (_) {
      return QrGallerySaveResult.failed;
    } finally {
      isExporting = false;
      if (!_disposed) update();
    }
  }

  void _markChanged() {
    _inputVersion++;
    isSaved = false;
    if (!_disposed) update();
  }

  Future<void> _recordPulse() async {
    try {
      await _pulseRecorder.recordQrAction();
    } catch (_) {
      // Progress persistence cannot turn a completed save or export into a failure.
    }
  }

  String _escape(String value) =>
      value.replaceAll(r'\', r'\\').replaceAll(';', r'\;').replaceAll(',', r'\,').replaceAll(':', r'\:');
}

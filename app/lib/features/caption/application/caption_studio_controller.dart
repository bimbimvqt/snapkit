import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';

import '../domain/caption_failure.dart';
import '../domain/caption_models.dart';
import '../domain/caption_repository.dart';

class CaptionStudioController extends GetxController {
  CaptionStudioController({required CaptionRepository repository, ImagePicker? imagePicker})
    : _repository = repository,
      _imagePicker = imagePicker ?? ImagePicker();

  static const maximumImages = 4;

  final CaptionRepository _repository;
  final ImagePicker _imagePicker;

  final selectedImages = <String>[].obs;
  final selectedTone = CaptionTone.meme.obs;
  final selectedPlatform = SocialPlatform.instagram.obs;
  final isLoading = false.obs;
  final isPickingImage = false.obs;
  final activeVariantIndex = 0.obs;
  final result = Rxn<CaptionGenerationResult>();
  final errorMessage = RxnString();
  int _inputVersion = 0;
  bool _disposed = false;

  bool get canAddImage =>
      !_disposed && !isLoading.value && !isPickingImage.value && selectedImages.length < maximumImages;
  bool get canGenerate => !_disposed && !isLoading.value && !isPickingImage.value && selectedImages.isNotEmpty;

  @override
  void onClose() {
    _disposed = true;
    _inputVersion++;
    super.onClose();
  }

  CaptionVariant? get currentVariant {
    final current = result.value;
    if (current == null || current.variants.isEmpty) return null;
    final index = activeVariantIndex.value.clamp(0, current.variants.length - 1);
    return current.variants[index];
  }

  @override
  void onInit() {
    super.onInit();
    final arguments = Get.arguments;
    final paths = switch (arguments) {
      List<String>() => arguments,
      String() when arguments.isNotEmpty => [arguments],
      _ => const <String>[],
    };
    selectedImages.assignAll(paths.where((path) => path.isNotEmpty).toSet().take(maximumImages));
  }

  Future<void> pickImageFromGallery() => _pickImage(ImageSource.gallery);

  Future<void> takePhotoWithCamera() => _pickImage(ImageSource.camera);

  Future<void> _pickImage(ImageSource source) async {
    if (!canAddImage) return;
    isPickingImage.value = true;
    errorMessage.value = null;
    try {
      final file = await _imagePicker.pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 90);
      if (_disposed || file == null || selectedImages.contains(file.path)) return;
      selectedImages.add(file.path);
      _markInputsChanged();
    } on PlatformException {
      if (_disposed) return;
      errorMessage.value = source == ImageSource.camera
          ? 'Không thể mở camera. Hãy kiểm tra quyền camera trong Cài đặt.'
          : 'Không thể mở thư viện ảnh. Hãy kiểm tra quyền truy cập trong Cài đặt.';
    } catch (_) {
      if (_disposed) return;
      errorMessage.value = 'Không thể đọc ảnh này. Vui lòng thử ảnh khác.';
    } finally {
      if (!_disposed) isPickingImage.value = false;
    }
  }

  void removeImageAt(int index) {
    if (isLoading.value || index < 0 || index >= selectedImages.length) return;
    selectedImages.removeAt(index);
    _markInputsChanged();
  }

  void selectTone(CaptionTone tone) {
    if (isLoading.value || selectedTone.value == tone) return;
    selectedTone.value = tone;
    _markInputsChanged();
  }

  void selectPlatform(SocialPlatform platform) {
    if (isLoading.value || selectedPlatform.value == platform) return;
    selectedPlatform.value = platform;
    _markInputsChanged();
  }

  void selectVariantIndex(int index) {
    final variants = result.value?.variants;
    if (variants == null || index < 0 || index >= variants.length || activeVariantIndex.value == index) return;
    activeVariantIndex.value = index;
    HapticFeedback.selectionClick();
  }

  Future<void> generateCaptions({String? contextHint}) async {
    if (_disposed || isLoading.value || isPickingImage.value) return;
    if (selectedImages.isEmpty) {
      errorMessage.value = 'Vui lòng chọn ít nhất một ảnh.';
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;
    final requestVersion = _inputVersion;
    try {
      final generated = await _repository.generateCaptions(
        imagePaths: selectedImages.toList(growable: false),
        tone: selectedTone.value,
        platform: selectedPlatform.value,
        contextHint: contextHint,
      );
      if (_disposed || requestVersion != _inputVersion) return;
      result.value = generated;
      activeVariantIndex.value = 0;
      HapticFeedback.mediumImpact();
    } on CaptionFailure catch (failure) {
      if (_disposed || requestVersion != _inputVersion) return;
      errorMessage.value = failure.message;
    } catch (_) {
      if (_disposed || requestVersion != _inputVersion) return;
      errorMessage.value = const CaptionUnexpectedFailure().message;
    } finally {
      if (!_disposed) isLoading.value = false;
    }
  }

  Future<bool> copyCurrentCaption() async {
    final variant = currentVariant;
    if (variant == null) return false;

    final tags = result.value?.hashtags.asFormattedString ?? '';
    final fullText = '${variant.body}\n\n$tags'.trim();
    try {
      await Clipboard.setData(ClipboardData(text: fullText));
      HapticFeedback.lightImpact();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> copyHashtags() async {
    final tags = result.value?.hashtags.asFormattedString;
    if (tags == null || tags.isEmpty) return false;
    try {
      await Clipboard.setData(ClipboardData(text: tags));
      HapticFeedback.lightImpact();
      return true;
    } catch (_) {
      return false;
    }
  }

  void _markInputsChanged() {
    _inputVersion += 1;
    result.value = null;
    activeVariantIndex.value = 0;
    errorMessage.value = null;
  }
}

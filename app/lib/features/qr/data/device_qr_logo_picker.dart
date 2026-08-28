import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

class PickedQrLogo {
  const PickedQrLogo(this.bytes);
  final Uint8List bytes;
}

abstract interface class QrLogoPicker {
  Future<PickedQrLogo?> pick();
}

class DeviceQrLogoPicker implements QrLogoPicker {
  DeviceQrLogoPicker([ImagePicker? imagePicker]) : _imagePicker = imagePicker ?? ImagePicker();

  static const _maximumBytes = 1024 * 1024;
  final ImagePicker _imagePicker;

  @override
  Future<PickedQrLogo?> pick() async {
    final file = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 88,
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    if (bytes.lengthInBytes > _maximumBytes) {
      throw const QrLogoTooLargeException();
    }
    return PickedQrLogo(bytes);
  }
}

class QrLogoTooLargeException implements Exception {
  const QrLogoTooLargeException();
}

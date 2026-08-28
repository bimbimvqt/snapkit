import 'dart:typed_data';

abstract interface class QrGallerySaver {
  Future<void> savePng(Uint8List bytes);
}

class QrGalleryPermissionException implements Exception {
  const QrGalleryPermissionException();
}

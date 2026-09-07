import 'dart:typed_data';

import 'package:photo_manager/photo_manager.dart';

import '../domain/qr_gallery_saver.dart';

class DeviceQrGallerySaver implements QrGallerySaver {
  @override
  Future<void> savePng(Uint8List bytes) async {
    final permission = await PhotoManager.requestPermissionExtend(
      requestOption: const PermissionRequestOption(
        iosAccessLevel: IosAccessLevel.addOnly,
        androidPermission: AndroidPermission(type: RequestType.image, mediaLocation: false),
      ),
    );
    if (!permission.hasAccess) throw const QrGalleryPermissionException();

    final timestamp = DateTime.now().toUtc().millisecondsSinceEpoch;
    await PhotoManager.editor.saveImage(
      bytes,
      filename: 'snapkit_qr_$timestamp.png',
      title: 'Snapkit QR',
      relativePath: 'Pictures/Snapkit',
      creationDate: DateTime.now(),
    );
  }
}

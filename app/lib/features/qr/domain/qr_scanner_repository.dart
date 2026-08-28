abstract interface class QrScannerRepository {
  Future<void> trackScanned(String format);
}

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../application/qr_scanner_controller.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late final QrScannerController _flowController = Get.find<QrScannerController>();
  final _cameraController = MobileScannerController(
    formats: const [
      BarcodeFormat.qrCode,
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.code128,
      BarcodeFormat.upcA,
    ],
  );

  Future<void> _detect(BarcodeCapture capture) async {
    final barcode = capture.barcodes.firstOrNull;
    final value = barcode?.rawValue;
    if (barcode == null || value == null || !_flowController.beginScan()) return;

    try {
      await _runCameraAction(_cameraController.stop);
      if (!mounted) return;
      unawaited(_flowController.trackScanned(barcode.format.name));
      await _showScannedValue(value);
    } finally {
      _flowController.finishScan();
      if (mounted) await _runCameraAction(_cameraController.start);
    }
  }

  Future<void> _runCameraAction(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể điều khiển camera. Hãy kiểm tra quyền camera và thử mở lại trình quét.'),
        ),
      );
    }
  }

  Future<void> _showScannedValue(String value) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .8),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(AppDimensions.space24, 18.h, AppDimensions.space24, AppDimensions.space28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42.w,
                  height: 4.h,
                  margin: EdgeInsets.only(bottom: AppDimensions.space24),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(9.r),
                  ),
                ),
              ),
              Icon(Icons.check_circle_rounded, size: 42.sp, color: Theme.of(context).colorScheme.primary),
              SizedBox(height: AppDimensions.space16),
              Text('Đã đọc mã', textAlign: TextAlign.center, style: AppTextStyles.titleLarge),
              SizedBox(height: AppDimensions.space12),
              SelectableText(
                value,
                textAlign: TextAlign.center,
                style: AppTextStyles.body.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              SizedBox(height: 22.h),
              FilledButton(onPressed: Get.back, child: const Text('Quét tiếp')),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.black,
    appBar: AppBar(
      backgroundColor: AppColors.black,
      foregroundColor: AppColors.white,
      title: const Text('Quét QR / Barcode'),
      actions: [
        IconButton(
          onPressed: () => _runCameraAction(_cameraController.toggleTorch),
          tooltip: 'Bật đèn pin',
          icon: const Icon(Icons.flashlight_on_outlined),
        ),
        IconButton(
          onPressed: () => _runCameraAction(_cameraController.switchCamera),
          tooltip: 'Đổi camera',
          icon: const Icon(Icons.cameraswitch_outlined),
        ),
      ],
    ),
    body: LayoutBuilder(
      builder: (context, constraints) {
        final scanDimension = (math.min(constraints.maxWidth, constraints.maxHeight) * .68).clamp(200.0, 300.0);
        return Stack(
          fit: StackFit.expand,
          children: [
            MobileScanner(controller: _cameraController, onDetect: _detect),
            ColorFiltered(
              colorFilter: ColorFilter.mode(AppColors.black.withValues(alpha: .54), BlendMode.srcOut),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const DecoratedBox(
                    decoration: BoxDecoration(color: AppColors.black, backgroundBlendMode: BlendMode.dstOut),
                  ),
                  Center(
                    child: Container(
                      width: scanDimension,
                      height: scanDimension,
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(AppDimensions.radius28),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Center(
              child: Container(
                width: scanDimension,
                height: scanDimension,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppDimensions.radius28),
                  border: Border.all(color: Theme.of(context).colorScheme.secondary, width: 3.w),
                ),
              ),
            ),
            Positioned(
              left: AppDimensions.space24,
              right: AppDimensions.space24,
              bottom: 34.h,
              child: Text(
                'Đặt mã vào trong khung · dữ liệu chỉ được xử lý trên máy',
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyStrong.copyWith(color: AppColors.white.withValues(alpha: .72)),
              ),
            ),
          ],
        );
      },
    ),
  );
}

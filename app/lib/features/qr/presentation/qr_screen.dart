import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../../../shared/widgets/snapkit_widgets.dart';
import '../application/qr_editor_controller.dart';
import '../domain/qr_design.dart';
import 'widgets/qr_color_picker_sheet.dart';
import 'widgets/qr_design_preview.dart';

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  late final QrEditorController _controller = Get.find<QrEditorController>();
  final GlobalKey _exportBoundaryKey = GlobalKey();
  bool _obscureWifiPassword = true;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final horizontalPadding = AppDimensions.pageHorizontal(constraints.maxWidth);
          final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.5);
          final previewExtent = 164.0 * textScale;
          return GetBuilder<QrEditorController>(
            builder: (controller) => CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(horizontalPadding, 24.h, horizontalPadding, 18.h),
                  sliver: SliverToBoxAdapter(
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const PageHeader(
                              eyebrow: 'Create & scan',
                              title: 'QR Studio',
                              description:
                                  'Chọn mẫu nhanh rồi tinh chỉnh màu, khung, hoa văn và logo. Preview cập nhật tức thì, ảnh logo chỉ xử lý trên thiết bị.',
                            ),
                            SizedBox(height: AppDimensions.space20),
                            FilledButton.icon(
                              onPressed: () => Get.toNamed(AppRoutes.scanner),
                              icon: const Icon(Icons.center_focus_strong_rounded),
                              label: const Text('Mở máy quét QR / Barcode'),
                            ),
                            SizedBox(height: AppDimensions.space28),
                            _ContentEditor(controller: controller, obscureWifiPassword: _obscureWifiPassword),
                            if (controller.kind == QrContentKind.wifi)
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  onPressed: () => setState(() => _obscureWifiPassword = !_obscureWifiPassword),
                                  icon: Icon(
                                    _obscureWifiPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                  ),
                                  label: Text(_obscureWifiPassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'),
                                ),
                              ),
                            SizedBox(height: 26.h),
                            _PresetPicker(controller: controller),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _QrPreviewHeaderDelegate(
                    extent: previewExtent,
                    horizontalPadding: horizontalPadding,
                    controller: controller,
                    exportBoundaryKey: _exportBoundaryKey,
                    onSaveToGallery: _saveToGallery,
                    onSaveHistory: _save,
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(horizontalPadding, 20.h, horizontalPadding, 40.h),
                  sliver: SliverToBoxAdapter(
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: AppDimensions.maxContentWidth),
                        child: _CustomizationPanel(controller: controller, chooseColor: _chooseColor),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );

  Future<void> _save() async {
    final result = await _controller.save();
    if (!mounted) return;
    final message = switch (result) {
      QrSaveResult.saved => 'Đã lưu nội dung và thông số thiết kế QR vào lịch sử.',
      QrSaveResult.unavailable => 'QR Studio đang tạm bảo trì. Vui lòng thử lại sau.',
      QrSaveResult.invalid =>
        _controller.design.isScannable
            ? 'Hãy nhập nội dung trước khi lưu.'
            : 'Hãy tăng độ tương phản giữa mã QR và nền trước khi lưu.',
      QrSaveResult.failed => 'Chưa thể lưu QR vào lịch sử. Kiểm tra mạng rồi thử lại.',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _chooseColor({
    required String title,
    required Color current,
    required ValueChanged<Color> onChanged,
  }) async {
    final selected = await showQrColorPickerSheet(context: context, title: title, current: current);
    if (selected != null && mounted) onChanged(selected);
  }

  Future<void> _saveToGallery() async {
    if (!_controller.canExport) return;
    final renderObject = _exportBoundaryKey.currentContext?.findRenderObject();
    if (renderObject is! RenderRepaintBoundary) {
      _showMessage('Preview chưa sẵn sàng. Hãy thử lại sau một chút.');
      return;
    }

    try {
      await WidgetsBinding.instance.endOfFrame;
      final image = await renderObject.toImage(pixelRatio: 3);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (byteData == null) {
        _showMessage('Không thể tạo ảnh PNG. Hãy thử lại.');
        return;
      }
      final result = await _controller.saveToGallery(byteData.buffer.asUint8List());
      if (!mounted) return;
      final message = switch (result) {
        QrGallerySaveResult.saved => 'Đã lưu ảnh QR vào thư viện Snapkit.',
        QrGallerySaveResult.permissionDenied => 'Cần quyền thêm ảnh để lưu QR vào thư viện.',
        QrGallerySaveResult.invalid => 'Hãy nhập nội dung và chọn màu QR đủ tương phản trước khi lưu.',
        QrGallerySaveResult.failed => 'Chưa thể lưu ảnh QR. Hãy kiểm tra quyền thư viện rồi thử lại.',
      };
      _showMessage(message);
    } catch (_) {
      if (mounted) _showMessage('Không thể tạo ảnh QR lúc này. Hãy thử lại.');
    }
  }

  void _showMessage(String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

class _ContentEditor extends StatelessWidget {
  const _ContentEditor({required this.controller, required this.obscureWifiPassword});

  final QrEditorController controller;
  final bool obscureWifiPassword;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const _SectionHeading(
        index: '1',
        title: 'Nội dung',
        description: 'Chọn loại dữ liệu và nhập nội dung cần mã hóa.',
      ),
      const SizedBox(height: 12),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SegmentedButton<QrContentKind>(
          segments: const [
            ButtonSegment(value: QrContentKind.text, label: Text('Văn bản'), icon: Icon(Icons.text_fields_rounded)),
            ButtonSegment(value: QrContentKind.url, label: Text('URL'), icon: Icon(Icons.link_rounded)),
            ButtonSegment(value: QrContentKind.wifi, label: Text('Wi-Fi'), icon: Icon(Icons.wifi_rounded)),
          ],
          selected: {controller.kind},
          onSelectionChanged: (value) => controller.setKind(value.first),
          showSelectedIcon: false,
        ),
      ),
      const SizedBox(height: 12),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              TextFormField(
                initialValue: controller.content,
                keyboardType: controller.kind == QrContentKind.url ? TextInputType.url : TextInputType.text,
                autocorrect: controller.kind != QrContentKind.url,
                decoration: InputDecoration(
                  labelText: switch (controller.kind) {
                    QrContentKind.wifi => 'Tên mạng (SSID)',
                    QrContentKind.url => 'Đường dẫn website',
                    QrContentKind.text => 'Nội dung',
                  },
                  hintText: controller.kind == QrContentKind.url
                      ? 'https://example.com'
                      : 'Nhập nội dung để xem preview',
                ),
                onChanged: controller.setContent,
              ),
              if (controller.kind == QrContentKind.wifi) ...[
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: controller.wifiPassword,
                  obscureText: obscureWifiPassword,
                  decoration: const InputDecoration(labelText: 'Mật khẩu Wi-Fi'),
                  onChanged: controller.setWifiPassword,
                ),
              ],
              const SizedBox(height: 12),
              Text(
                controller.kind == QrContentKind.wifi
                    ? 'Lưu lịch sử sẽ gửi tên mạng và mật khẩu Wi-Fi lên máy chủ Snapkit. Lưu ảnh chỉ lưu QR trên thiết bị.'
                    : 'Lưu lịch sử sẽ gửi nội dung QR lên máy chủ Snapkit. Lưu ảnh chỉ lưu QR trên thiết bị.',
                style: AppTextStyles.caption.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _PresetPicker extends StatelessWidget {
  const _PresetPicker({required this.controller});

  final QrEditorController controller;

  static const _presets = [
    (QrDesignPreset.classic, 'Classic', 'Gọn, dễ quét', Icons.qr_code_2_rounded),
    (QrDesignPreset.rainbow, 'Cầu vồng', 'Nổi bật đa sắc', Icons.gradient_rounded),
    (QrDesignPreset.floral, 'Vườn hoa', 'Hoa văn mềm mại', Icons.local_florist_rounded),
    (QrDesignPreset.creator, 'Creator', 'Ticket cá tính', Icons.auto_awesome_rounded),
    (QrDesignPreset.business, 'Business', 'Chỉn chu, tin cậy', Icons.business_center_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 2.0).toDouble();
    final pickerHeight = 112 * textScale;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionHeading(
          index: '2',
          title: 'Chọn phong cách nhanh',
          description: 'Bắt đầu bằng một preset, sau đó chỉnh từng chi tiết nếu muốn.',
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: pickerHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _presets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final preset = _presets[index];
              return _SelectionCard(
                width: 148,
                selected: controller.activePreset == preset.$1,
                icon: preset.$4,
                title: preset.$2,
                subtitle: preset.$3,
                onTap: () => controller.applyPreset(preset.$1),
              );
            },
          ),
        ),
      ],
    );
  }
}

typedef _ChooseColor =
    Future<void> Function({required String title, required Color current, required ValueChanged<Color> onChanged});

class _CustomizationPanel extends StatelessWidget {
  const _CustomizationPanel({required this.controller, required this.chooseColor});

  final QrEditorController controller;
  final _ChooseColor chooseColor;

  @override
  Widget build(BuildContext context) {
    final design = controller.design;
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: _SectionHeading(
                index: '3',
                title: 'Tùy chỉnh chi tiết',
                description: 'Các nhóm nâng cao được thu gọn để bạn không bị rối.',
              ),
            ),
            TextButton.icon(
              onPressed: controller.resetDesign,
              icon: const Icon(Icons.restart_alt_rounded),
              label: const Text('Đặt lại'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              ExpansionTile(
                initiallyExpanded: true,
                leading: Icon(Icons.palette_outlined, color: scheme.primary),
                title: Text('Màu sắc', style: AppTextStyles.bodyStrong),
                subtitle: Text(
                  'Mã QR, nền và toàn bộ khung',
                  style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
                children: [
                  _AdaptiveControlGrid(
                    children: [
                      _ColorControl(
                        label: 'Màu QR',
                        color: design.foreground,
                        onTap: () => chooseColor(
                          title: 'Màu QR',
                          current: design.foreground,
                          onChanged: (value) => controller.updateDesign(design.copyWith(foreground: value)),
                        ),
                      ),
                      _ColorControl(
                        label: 'Nền QR',
                        color: design.background,
                        onTap: () => chooseColor(
                          title: 'Nền QR',
                          current: design.background,
                          onChanged: (value) => controller.updateDesign(design.copyWith(background: value)),
                        ),
                      ),
                      _ColorControl(
                        label: 'Viền chính',
                        color: design.frameColor,
                        onTap: () => chooseColor(
                          title: 'Màu viền chính',
                          current: design.frameColor,
                          onChanged: (value) => controller.updateDesign(design.copyWith(frameColor: value)),
                        ),
                      ),
                      _ColorControl(
                        label: 'Viền phụ',
                        color: design.frameSecondaryColor,
                        onTap: () => chooseColor(
                          title: 'Màu viền phụ',
                          current: design.frameSecondaryColor,
                          onChanged: (value) => controller.updateDesign(design.copyWith(frameSecondaryColor: value)),
                        ),
                      ),
                      _ColorControl(
                        label: 'Nền khung',
                        color: design.frameBackground,
                        onTap: () => chooseColor(
                          title: 'Màu nền khung',
                          current: design.frameBackground,
                          onChanged: (value) => controller.updateDesign(design.copyWith(frameBackground: value)),
                        ),
                      ),
                    ],
                  ),
                  if (!design.isScannable)
                    _InlineNotice(
                      icon: Icons.warning_amber_rounded,
                      color: scheme.error,
                      text: 'Màu QR và nền quá gần nhau. Tăng độ tương phản để máy ảnh nhận mã ổn định.',
                    ),
                ],
              ),
              const Divider(height: 1),
              ExpansionTile(
                leading: Icon(Icons.grid_view_rounded, color: scheme.primary),
                title: Text('Hình QR', style: AppTextStyles.bodyStrong),
                subtitle: Text(
                  'Mắt và module của mã',
                  style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
                children: [
                  const _ControlLabel('Hình mắt QR'),
                  _OptionWrap(
                    children: [
                      _OptionChip(
                        label: 'Vuông',
                        selected: design.eyeStyle == QrEyeStyle.square,
                        onTap: () => controller.updateDesign(design.copyWith(eyeStyle: QrEyeStyle.square)),
                      ),
                      _OptionChip(
                        label: 'Tròn',
                        selected: design.eyeStyle == QrEyeStyle.circle,
                        onTap: () => controller.updateDesign(design.copyWith(eyeStyle: QrEyeStyle.circle)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const _ControlLabel('Hình module'),
                  _OptionWrap(
                    children: [
                      _OptionChip(
                        label: 'Vuông',
                        selected: design.moduleStyle == QrModuleStyle.square,
                        onTap: () => controller.updateDesign(design.copyWith(moduleStyle: QrModuleStyle.square)),
                      ),
                      _OptionChip(
                        label: 'Tròn',
                        selected: design.moduleStyle == QrModuleStyle.circle,
                        onTap: () => controller.updateDesign(design.copyWith(moduleStyle: QrModuleStyle.circle)),
                      ),
                    ],
                  ),
                ],
              ),
              const Divider(height: 1),
              _FrameEditor(controller: controller),
              const Divider(height: 1),
              _LogoEditor(controller: controller, chooseColor: chooseColor),
            ],
          ),
        ),
      ],
    );
  }
}

class _FrameEditor extends StatelessWidget {
  const _FrameEditor({required this.controller});

  final QrEditorController controller;

  @override
  Widget build(BuildContext context) {
    final design = controller.design;
    final scheme = Theme.of(context).colorScheme;
    return ExpansionTile(
      leading: Icon(Icons.crop_free_rounded, color: scheme.primary),
      title: Text('Khung & hoa văn', style: AppTextStyles.bodyStrong),
      subtitle: Text(
        'Viền hoa, cầu vồng, hình dạng và nhãn',
        style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
      ),
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
      children: [
        const _ControlLabel('Kiểu viền'),
        _OptionWrap(
          children: [
            for (final option in const [
              (QrFrameStyle.none, 'Không viền', Icons.block_rounded),
              (QrFrameStyle.rounded, 'Tối giản', Icons.rounded_corner_rounded),
              (QrFrameStyle.badge, 'Có nhãn', Icons.label_outline_rounded),
              (QrFrameStyle.rainbow, 'Cầu vồng', Icons.gradient_rounded),
              (QrFrameStyle.floral, 'Viền hoa', Icons.local_florist_rounded),
            ])
              _VisualOption(
                label: option.$2,
                icon: option.$3,
                selected: design.frameStyle == option.$1,
                onTap: () => controller.updateDesign(design.copyWith(frameStyle: option.$1)),
              ),
          ],
        ),
        if (design.frameStyle != QrFrameStyle.none) ...[
          const SizedBox(height: 18),
          const _ControlLabel('Hình dáng khung'),
          _OptionWrap(
            children: [
              _OptionChip(
                label: 'Bo tròn',
                selected: design.frameShape == QrFrameShape.rounded,
                onTap: () => controller.updateDesign(design.copyWith(frameShape: QrFrameShape.rounded)),
              ),
              _OptionChip(
                label: 'Vuông',
                selected: design.frameShape == QrFrameShape.square,
                onTap: () => controller.updateDesign(design.copyWith(frameShape: QrFrameShape.square)),
              ),
              _OptionChip(
                label: 'Ticket',
                selected: design.frameShape == QrFrameShape.ticket,
                onTap: () => controller.updateDesign(design.copyWith(frameShape: QrFrameShape.ticket)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextFormField(
            key: ValueKey('frame-label-${controller.activePreset}'),
            initialValue: design.frameLabel,
            maxLength: 32,
            decoration: const InputDecoration(
              labelText: 'Nhãn dưới QR',
              hintText: 'Ví dụ: SCAN ME',
              helperText: 'Để trống nếu không muốn hiển thị nhãn.',
            ),
            onChanged: (value) => controller.updateDesign(design.copyWith(frameLabel: value)),
          ),
          const SizedBox(height: 8),
          _SliderControl(
            label: 'Độ dày viền',
            value: design.borderWidth,
            min: 1,
            max: 12,
            suffix: 'px',
            onChanged: (value) => controller.updateDesign(design.copyWith(borderWidth: value)),
          ),
          _SliderControl(
            label: 'Khoảng thở của khung',
            value: design.framePadding,
            min: 12,
            max: 36,
            suffix: 'px',
            onChanged: (value) => controller.updateDesign(design.copyWith(framePadding: value)),
          ),
          if (design.frameShape == QrFrameShape.rounded)
            _SliderControl(
              label: 'Độ bo góc',
              value: design.cornerRadius,
              min: 8,
              max: 40,
              suffix: 'px',
              onChanged: (value) => controller.updateDesign(design.copyWith(cornerRadius: value)),
            ),
          const SizedBox(height: 4),
          const _ControlLabel('Hiệu ứng khung'),
          _OptionWrap(
            children: [
              for (final option in const [
                (QrFrameShadow.none, 'Phẳng'),
                (QrFrameShadow.soft, 'Bóng mềm'),
                (QrFrameShadow.glow, 'Glow'),
              ])
                _OptionChip(
                  label: option.$2,
                  selected: design.frameShadow == option.$1,
                  onTap: () => controller.updateDesign(design.copyWith(frameShadow: option.$1)),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _LogoEditor extends StatelessWidget {
  const _LogoEditor({required this.controller, required this.chooseColor});

  final QrEditorController controller;
  final _ChooseColor chooseColor;

  @override
  Widget build(BuildContext context) {
    final design = controller.design;
    final scheme = Theme.of(context).colorScheme;
    return ExpansionTile(
      leading: Icon(Icons.add_photo_alternate_outlined, color: scheme.primary),
      title: Text('Logo trung tâm', style: AppTextStyles.bodyStrong),
      subtitle: Text(
        'Icon có sẵn hoặc ảnh riêng từ thư viện',
        style: AppTextStyles.body.copyWith(color: scheme.onSurfaceVariant),
      ),
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
      children: [
        _OptionWrap(
          children: [
            for (final option in const [
              (QrLogoKind.none, 'Không logo', Icons.block_rounded),
              (QrLogoKind.shield, 'Bảo mật', Icons.shield_rounded),
              (QrLogoKind.link, 'Liên kết', Icons.link_rounded),
              (QrLogoKind.wifi, 'Wi-Fi', Icons.wifi_rounded),
              (QrLogoKind.heart, 'Yêu thích', Icons.favorite_rounded),
              (QrLogoKind.business, 'Doanh nghiệp', Icons.business_rounded),
            ])
              _VisualOption(
                label: option.$2,
                icon: option.$3,
                selected: design.logoKind == option.$1,
                onTap: () => controller.updateDesign(
                  design.copyWith(logoKind: option.$1, clearCustomLogo: option.$1 != QrLogoKind.custom),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        _CustomLogoPicker(controller: controller),
        if (controller.logoError != null)
          _InlineNotice(icon: Icons.error_outline_rounded, color: scheme.error, text: controller.logoError ?? ''),
        const SizedBox(height: 10),
        _InlineNotice(
          icon: Icons.shield_outlined,
          color: scheme.primary,
          text: 'Ảnh logo chỉ được ghép vào QR trên thiết bị. Snapkit không tải bytes ảnh hoặc tên file lên máy chủ.',
        ),
        if (design.logoKind != QrLogoKind.none) ...[
          const SizedBox(height: 18),
          const _ControlLabel('Hình nền logo'),
          _OptionWrap(
            children: [
              _OptionChip(
                label: 'Bo tròn',
                selected: design.logoShape == QrLogoShape.rounded,
                onTap: () => controller.updateDesign(design.copyWith(logoShape: QrLogoShape.rounded)),
              ),
              _OptionChip(
                label: 'Tròn',
                selected: design.logoShape == QrLogoShape.circle,
                onTap: () => controller.updateDesign(design.copyWith(logoShape: QrLogoShape.circle)),
              ),
              _OptionChip(
                label: 'Vuông',
                selected: design.logoShape == QrLogoShape.square,
                onTap: () => controller.updateDesign(design.copyWith(logoShape: QrLogoShape.square)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _AdaptiveControlGrid(
            children: [
              _ColorControl(
                label: 'Màu icon',
                color: design.logoColor,
                onTap: () => chooseColor(
                  title: 'Màu icon',
                  current: design.logoColor,
                  onChanged: (value) => controller.updateDesign(design.copyWith(logoColor: value)),
                ),
              ),
              _ColorControl(
                label: 'Nền logo',
                color: design.logoBackground,
                onTap: () => chooseColor(
                  title: 'Màu nền logo',
                  current: design.logoBackground,
                  onChanged: (value) => controller.updateDesign(design.copyWith(logoBackground: value)),
                ),
              ),
            ],
          ),
          _SliderControl(
            label: 'Kích thước logo',
            value: design.logoScale * 100,
            min: 16,
            max: 26,
            suffix: '%',
            onChanged: (value) => controller.updateDesign(design.copyWith(logoScale: value / 100)),
          ),
        ],
      ],
    );
  }
}

class _CustomLogoPicker extends StatelessWidget {
  const _CustomLogoPicker({required this.controller});

  final QrEditorController controller;

  @override
  Widget build(BuildContext context) {
    final design = controller.design;
    if (design.hasCustomLogo) {
      final bytes = design.customLogoBytes;
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: bytes == null
                  ? const SizedBox.square(dimension: 56)
                  : Image.memory(bytes, width: 56, height: 56, fit: BoxFit.cover),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Logo ảnh riêng', style: AppTextStyles.bodyStrong),
                  SizedBox(height: 3.h),
                  Text('Đã tối ưu tối đa 512×512', style: AppTextStyles.caption),
                ],
              ),
            ),
            IconButton(
              onPressed: controller.isPickingLogo ? null : controller.pickCustomLogo,
              tooltip: 'Thay ảnh logo',
              icon: const Icon(Icons.sync_rounded),
            ),
            IconButton(
              onPressed: controller.removeCustomLogo,
              tooltip: 'Xóa ảnh logo',
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          ],
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: controller.isPickingLogo ? null : controller.pickCustomLogo,
      icon: controller.isPickingLogo
          ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
          : const Icon(Icons.upload_file_rounded),
      label: Text(controller.isPickingLogo ? 'Đang tối ưu ảnh…' : 'Chọn logo ảnh từ thư viện'),
    );
  }
}

class _QrPreviewHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _QrPreviewHeaderDelegate({
    required this.extent,
    required this.horizontalPadding,
    required this.controller,
    required this.exportBoundaryKey,
    required this.onSaveToGallery,
    required this.onSaveHistory,
  });

  final double extent;
  final double horizontalPadding;
  final QrEditorController controller;
  final GlobalKey exportBoundaryKey;
  final VoidCallback onSaveToGallery;
  final VoidCallback onSaveHistory;

  @override
  double get minExtent => extent;

  @override
  double get maxExtent => extent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final scheme = Theme.of(context).colorScheme;
    return ColoredBox(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Padding(
        padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 8),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1080),
            child: Material(
              elevation: overlapsContent ? 6 : 1,
              color: scheme.surface,
              shadowColor: AppColors.black.withValues(alpha: .18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: scheme.outlineVariant),
              ),
              clipBehavior: Clip.antiAlias,
              child: _StickyPreviewCard(
                controller: controller,
                exportBoundaryKey: exportBoundaryKey,
                onSaveToGallery: onSaveToGallery,
                onSaveHistory: onSaveHistory,
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _QrPreviewHeaderDelegate oldDelegate) => true;
}

class _StickyPreviewCard extends StatelessWidget {
  const _StickyPreviewCard({
    required this.controller,
    required this.exportBoundaryKey,
    required this.onSaveToGallery,
    required this.onSaveHistory,
  });

  final QrEditorController controller;
  final GlobalKey exportBoundaryKey;
  final VoidCallback onSaveToGallery;
  final VoidCallback onSaveHistory;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final preview = controller.encodedContent;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final dimension = constraints.biggest.shortestSide;
                return Center(
                  child: SizedBox.square(
                    dimension: dimension,
                    child: preview.isEmpty
                        ? DecoratedBox(
                            decoration: BoxDecoration(
                              color: scheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(Icons.qr_code_2_rounded, size: 42, color: scheme.onSurfaceVariant),
                          )
                        : FittedBox(
                            fit: BoxFit.contain,
                            child: RepaintBoundary(
                              key: exportBoundaryKey,
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: QrDesignPreview(data: preview, design: controller.design),
                              ),
                            ),
                          ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 6,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Preview luôn hiển thị', maxLines: 1, style: AppTextStyles.bodyStrong),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      controller.design.isScannable ? Icons.verified_rounded : Icons.warning_amber_rounded,
                      color: controller.design.isScannable ? scheme.primary : scheme.error,
                      size: 18,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        preview.isEmpty
                            ? 'Nhập nội dung để tạo QR'
                            : controller.design.isScannable
                            ? 'Tương phản ${controller.design.contrastRatio.toStringAsFixed(1)}:1 · sẵn sàng quét'
                            : 'Tương phản thấp · cần chỉnh màu',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(
                          color: controller.design.isScannable ? scheme.onSurfaceVariant : scheme.error,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: controller.canExport ? onSaveToGallery : null,
                        icon: controller.isExporting
                            ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.download_rounded),
                        label: Text(controller.isExporting ? 'Đang lưu…' : 'Lưu ảnh'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox.square(
                      dimension: 48,
                      child: IconButton.outlined(
                        onPressed: controller.canSave ? onSaveHistory : null,
                        tooltip: controller.isSaved ? 'Đã lưu lịch sử trên máy chủ' : 'Lưu lịch sử QR trên máy chủ',
                        icon: controller.isSaving
                            ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : Icon(controller.isSaved ? Icons.cloud_done_rounded : Icons.cloud_upload_outlined),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.index, required this.title, required this.description});

  final String index;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: .14),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Text(index, style: AppTextStyles.bodyStrong.copyWith(color: Theme.of(context).colorScheme.primary)),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AppTextStyles.sectionTitle),
            const SizedBox(height: 3),
            Text(
              description,
              style: AppTextStyles.body.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    ],
  );
}

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.width,
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final double width;
  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: width,
      child: Material(
        color: selected ? scheme.secondary.withValues(alpha: .16) : scheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: selected ? scheme.secondary : scheme.outlineVariant, width: selected ? 2 : 1),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 22, color: selected ? scheme.secondary : scheme.onSurfaceVariant),
                const SizedBox(height: 8),
                Text(title, style: AppTextStyles.bodyStrong),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AdaptiveControlGrid extends StatelessWidget {
  const _AdaptiveControlGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final itemWidth = constraints.maxWidth >= 480 ? (constraints.maxWidth - 8) / 2 : constraints.maxWidth;
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [for (final child in children) SizedBox(width: itemWidth, child: child)],
      );
    },
  );
}

class _ColorControl extends StatelessWidget {
  const _ColorControl({required this.label, required this.color, required this.onTap});

  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        constraints: const BoxConstraints(minHeight: 54),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Theme.of(context).colorScheme.outline),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: AppTextStyles.label)),
            Text(
              colorToHex(color),
              style: AppTextStyles.navigation.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _OptionWrap extends StatelessWidget {
  const _OptionWrap({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Wrap(spacing: 8, runSpacing: 8, children: children),
  );
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: true,
      labelStyle: AppTextStyles.caption.copyWith(
        color: selected ? scheme.onSecondary : scheme.onSurface,
        fontWeight: FontWeight.w700,
      ),
      selectedColor: scheme.secondary,
      side: BorderSide(color: selected ? scheme.secondary : scheme.outlineVariant),
    );
  }
}

class _VisualOption extends StatelessWidget {
  const _VisualOption({required this.label, required this.icon, required this.selected, required this.onTap});

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 92,
      height: 78,
      child: Material(
        color: selected ? scheme.secondary.withValues(alpha: .16) : scheme.surfaceContainerHighest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: selected ? scheme.secondary : scheme.outlineVariant, width: selected ? 2 : 1),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: selected ? scheme.secondary : scheme.onSurfaceVariant),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.navigation.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ControlLabel extends StatelessWidget {
  const _ControlLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 9),
    child: Align(
      alignment: Alignment.centerLeft,
      child: Text(label, style: AppTextStyles.label),
    ),
  );
}

class _SliderControl extends StatelessWidget {
  const _SliderControl({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.suffix,
    required this.onChanged,
  });

  final String label;
  final String suffix;
  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTextStyles.label),
          Text(
            '${value.round()}$suffix',
            style: AppTextStyles.label.copyWith(color: Theme.of(context).colorScheme.primary),
          ),
        ],
      ),
      Slider(value: value, min: min, max: max, onChanged: onChanged),
    ],
  );
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: color.withValues(alpha: .1), borderRadius: BorderRadius.circular(14)),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 9),
        Expanded(
          child: Text(text, style: AppTextStyles.caption.copyWith(color: color)),
        ),
      ],
    ),
  );
}

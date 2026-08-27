import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/config/remote_config.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/toolbox_widgets.dart';

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});
  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  static const _swatches = [
    Color(0xFF102019),
    Color(0xFF0B5E44),
    Color(0xFF0369A1),
    Color(0xFF6D28D9),
    Color(0xFFBE123C),
    Color(0xFFB45309),
    Color(0xFFF2F8F5),
    Color(0xFFFFFFFF),
  ];

  final _content = TextEditingController();
  final _password = TextEditingController();
  String _kind = 'text';
  bool _saving = false;
  bool _saved = false;
  Color _foreground = const Color(0xFF102019);
  Color _background = const Color(0xFFF2F8F5);
  Color _frameColor = const Color(0xFF55D6A7);
  Color _iconColor = const Color(0xFF102019);
  double _borderWidth = 3;
  double _cornerRadius = 24;
  QrEyeShape _eyeShape = QrEyeShape.square;
  QrDataModuleShape _moduleShape = QrDataModuleShape.square;
  String _frameStyle = 'rounded';
  String _icon = 'none';

  String _buildContent() {
    final value = _content.text.trim();
    if (_kind == 'wifi') {
      return value.isEmpty
          ? ''
          : 'WIFI:T:WPA;S:${_escape(value)};P:${_escape(_password.text)};;';
    }
    return value;
  }

  String _escape(String value) => value
      .replaceAll(r'\', r'\\')
      .replaceAll(';', r'\;')
      .replaceAll(',', r'\,')
      .replaceAll(':', r'\:');

  Map<String, Object> get _stylePayload => {
    'foreground': _hex(_foreground),
    'background': _hex(_background),
    'frameColor': _hex(_frameColor),
    'iconColor': _hex(_iconColor),
    'borderWidth': _borderWidth,
    'cornerRadius': _cornerRadius,
    'eyeShape': _eyeShape == QrEyeShape.circle ? 'circle' : 'square',
    'moduleShape': _moduleShape == QrDataModuleShape.circle
        ? 'circle'
        : 'square',
    'frameStyle': _frameStyle,
    'icon': _icon,
  };

  double get _contrast => _contrastRatio(_foreground, _background);

  Future<void> _save() async {
    if (!RemoteConfig.instance.enabled('qr_studio')) return;
    final value = _buildContent();
    if (value.isEmpty || _contrast < 3) return;
    setState(() {
      _saving = true;
      _saved = false;
    });
    final saved = await ApiClient.instance.saveQr(
      kind: _kind,
      content: value,
      style: _stylePayload,
    );
    if (saved) {
      await ApiClient.instance.event('qr_created', {
        'kind': _kind,
        'frameStyle': _frameStyle,
        'icon': _icon,
      });
    }
    if (!mounted) return;
    setState(() {
      _saving = false;
      _saved = saved;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          saved
              ? 'Đã lưu QR và phong cách vào lịch sử.'
              : 'Chưa thể đồng bộ QR. Kiểm tra mạng rồi thử lại.',
        ),
      ),
    );
  }

  void _resetStyle() => setState(() {
    _foreground = const Color(0xFF102019);
    _background = const Color(0xFFF2F8F5);
    _frameColor = const Color(0xFF55D6A7);
    _iconColor = const Color(0xFF102019);
    _borderWidth = 3;
    _cornerRadius = 24;
    _eyeShape = QrEyeShape.square;
    _moduleShape = QrDataModuleShape.square;
    _frameStyle = 'rounded';
    _icon = 'none';
    _saved = false;
  });

  @override
  void dispose() {
    _content.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final preview = _buildContent();
    final canSave = preview.isNotEmpty && _contrast >= 3 && !_saving;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            const PageHeader(
              eyebrow: 'Create & scan',
              title: 'QR Studio',
              description:
                  'Tạo QR theo phong cách riêng với màu, hình khối, khung và biểu tượng. Nội dung đã quét không gửi lên server.',
            ),
            const SizedBox(height: 22),
            FilledButton.icon(
              onPressed: () => context.push('/qr/scanner'),
              icon: const Icon(Icons.center_focus_strong_rounded),
              label: const Text('Mở máy quét QR / Barcode'),
            ),
            const SizedBox(height: 26),
            const _SectionLabel('1 · NỘI DUNG'),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'text',
                    label: Text('Văn bản'),
                    icon: Icon(Icons.text_fields_rounded),
                  ),
                  ButtonSegment(
                    value: 'url',
                    label: Text('URL'),
                    icon: Icon(Icons.link_rounded),
                  ),
                  ButtonSegment(
                    value: 'wifi',
                    label: Text('Wi-Fi'),
                    icon: Icon(Icons.wifi_rounded),
                  ),
                ],
                selected: {_kind},
                onSelectionChanged: (value) => setState(() {
                  _kind = value.first;
                  _saved = false;
                }),
                showSelectedIcon: false,
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    TextField(
                      controller: _content,
                      keyboardType: _kind == 'url'
                          ? TextInputType.url
                          : TextInputType.text,
                      autocorrect: _kind != 'url',
                      decoration: InputDecoration(
                        labelText: _kind == 'wifi'
                            ? 'Tên mạng (SSID)'
                            : _kind == 'url'
                            ? 'Đường dẫn website'
                            : 'Nội dung',
                        hintText: _kind == 'url'
                            ? 'https://example.com'
                            : 'Nhập nội dung để xem preview',
                      ),
                      onChanged: (_) => setState(() => _saved = false),
                    ),
                    if (_kind == 'wifi') ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Mật khẩu Wi-Fi',
                        ),
                        onChanged: (_) => setState(() => _saved = false),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            const _SectionLabel('2 · PHONG CÁCH'),
            const SizedBox(height: 12),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  ExpansionTile(
                    initiallyExpanded: true,
                    leading: Icon(
                      Icons.palette_outlined,
                      color: scheme.primary,
                    ),
                    title: const Text(
                      'Màu sắc',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      'Nền, mã QR, khung và icon',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                    children: [
                      _ColorControl(
                        label: 'Màu QR',
                        color: _foreground,
                        onTap: () => _chooseColor(
                          title: 'Màu QR',
                          current: _foreground,
                          onChanged: (color) => _foreground = color,
                        ),
                      ),
                      _ColorControl(
                        label: 'Màu nền',
                        color: _background,
                        onTap: () => _chooseColor(
                          title: 'Màu nền',
                          current: _background,
                          onChanged: (color) => _background = color,
                        ),
                      ),
                      _ColorControl(
                        label: 'Màu khung',
                        color: _frameColor,
                        onTap: () => _chooseColor(
                          title: 'Màu khung',
                          current: _frameColor,
                          onChanged: (color) => _frameColor = color,
                        ),
                      ),
                      _ColorControl(
                        label: 'Màu icon',
                        color: _iconColor,
                        onTap: () => _chooseColor(
                          title: 'Màu icon',
                          current: _iconColor,
                          onChanged: (color) => _iconColor = color,
                        ),
                      ),
                      if (_contrast < 3)
                        Container(
                          margin: const EdgeInsets.only(top: 10),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: scheme.errorContainer,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.warning_amber_rounded,
                                color: scheme.onErrorContainer,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Màu QR và màu nền quá gần nhau. Hãy tăng độ tương phản để mã quét ổn định.',
                                  style: TextStyle(
                                    color: scheme.onErrorContainer,
                                    fontSize: 12,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const Divider(height: 1),
                  ExpansionTile(
                    leading: Icon(
                      Icons.category_outlined,
                      color: scheme.primary,
                    ),
                    title: const Text(
                      'Hình khối & khung',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      'Mắt QR, module, border và độ bo',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                    children: [
                      const _ControlLabel('Hình mắt QR'),
                      Wrap(
                        spacing: 8,
                        children: [
                          _OptionChip(
                            label: 'Vuông',
                            selected: _eyeShape == QrEyeShape.square,
                            onTap: () =>
                                setState(() => _eyeShape = QrEyeShape.square),
                          ),
                          _OptionChip(
                            label: 'Tròn',
                            selected: _eyeShape == QrEyeShape.circle,
                            onTap: () =>
                                setState(() => _eyeShape = QrEyeShape.circle),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      const _ControlLabel('Hình module'),
                      Wrap(
                        spacing: 8,
                        children: [
                          _OptionChip(
                            label: 'Vuông',
                            selected: _moduleShape == QrDataModuleShape.square,
                            onTap: () => setState(
                              () => _moduleShape = QrDataModuleShape.square,
                            ),
                          ),
                          _OptionChip(
                            label: 'Tròn',
                            selected: _moduleShape == QrDataModuleShape.circle,
                            onTap: () => setState(
                              () => _moduleShape = QrDataModuleShape.circle,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      const _ControlLabel('Kiểu khung'),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final option in const [
                            ('none', 'Không khung'),
                            ('simple', 'Mảnh'),
                            ('rounded', 'Bo tròn'),
                            ('badge', 'Nhãn Scan me'),
                          ])
                            _OptionChip(
                              label: option.$2,
                              selected: _frameStyle == option.$1,
                              onTap: () =>
                                  setState(() => _frameStyle = option.$1),
                            ),
                        ],
                      ),
                      if (_frameStyle != 'none') ...[
                        const SizedBox(height: 18),
                        _SliderControl(
                          label: 'Độ dày border',
                          value: _borderWidth,
                          min: 1,
                          max: 12,
                          suffix: 'px',
                          onChanged: (value) =>
                              setState(() => _borderWidth = value),
                        ),
                        _SliderControl(
                          label: 'Độ bo góc',
                          value: _cornerRadius,
                          min: 0,
                          max: 36,
                          suffix: 'px',
                          onChanged: (value) =>
                              setState(() => _cornerRadius = value),
                        ),
                      ],
                    ],
                  ),
                  const Divider(height: 1),
                  ExpansionTile(
                    leading: Icon(
                      Icons.add_reaction_outlined,
                      color: scheme.primary,
                    ),
                    title: const Text(
                      'Icon trung tâm',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      'Tự động dùng mức sửa lỗi cao',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final option in const [
                            ('none', 'Không icon', Icons.block_rounded),
                            ('shield', 'Bảo mật', Icons.shield_rounded),
                            ('link', 'Liên kết', Icons.link_rounded),
                            ('wifi', 'Wi-Fi', Icons.wifi_rounded),
                            ('heart', 'Yêu thích', Icons.favorite_rounded),
                            (
                              'business',
                              'Doanh nghiệp',
                              Icons.business_rounded,
                            ),
                          ])
                            _IconOption(
                              label: option.$2,
                              icon: option.$3,
                              selected: _icon == option.$1,
                              onTap: () => setState(() => _icon = option.$1),
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const _SectionLabel('3 · PREVIEW'),
                TextButton.icon(
                  onPressed: _resetStyle,
                  icon: const Icon(Icons.restart_alt_rounded, size: 18),
                  label: const Text('Đặt lại'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: preview.isEmpty
                          ? Container(
                              key: const ValueKey('empty'),
                              height: 260,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: scheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(22),
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.qr_code_2_rounded,
                                    size: 54,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Nhập nội dung để xem QR trực tiếp',
                                    style: TextStyle(
                                      color: scheme.onSurfaceVariant,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : _QrPreview(
                              key: ValueKey(
                                '$preview-${_stylePayload.hashCode}',
                              ),
                              data: preview,
                              foreground: _foreground,
                              background: _background,
                              frameColor: _frameColor,
                              iconColor: _iconColor,
                              borderWidth: _borderWidth,
                              cornerRadius: _cornerRadius,
                              eyeShape: _eyeShape,
                              moduleShape: _moduleShape,
                              frameStyle: _frameStyle,
                              icon: _icon,
                            ),
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: canSave ? _save : null,
                      icon: _saving
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.cloud_upload_outlined),
                      label: Text(_saved ? 'Đã lưu QR' : 'Lưu QR vào lịch sử'),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Mẹo: luôn thử quét QR sau khi dùng màu hoặc icon tùy chỉnh.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: scheme.onSurfaceVariant,
                        fontSize: 11.5,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _chooseColor({
    required String title,
    required Color current,
    required ValueChanged<Color> onChanged,
  }) async {
    final controller = TextEditingController(text: _hex(current));
    Color draft = current;
    String? error;
    final selected = await showModalBottomSheet<Color>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            20 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final color in _swatches)
                    Semantics(
                      button: true,
                      selected: color == draft,
                      label: 'Màu ${_hex(color)}',
                      child: InkWell(
                        onTap: () => setSheetState(() {
                          draft = color;
                          controller.text = _hex(color);
                          error = null;
                        }),
                        borderRadius: BorderRadius.circular(99),
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: color == draft
                                  ? Theme.of(context).colorScheme.primary
                                  : Theme.of(context).colorScheme.outline,
                              width: color == draft ? 4 : 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              TextField(
                controller: controller,
                textCapitalization: TextCapitalization.characters,
                maxLength: 7,
                decoration: InputDecoration(
                  labelText: 'Mã HEX tùy chọn',
                  hintText: '#102019',
                  errorText: error,
                  prefixIcon: Container(
                    margin: const EdgeInsets.all(11),
                    decoration: BoxDecoration(
                      color: draft,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                  ),
                ),
                onChanged: (value) {
                  final parsed = _parseHex(value);
                  setSheetState(() {
                    if (parsed == null) {
                      error = 'Nhập đủ 6 ký tự màu, ví dụ #55D6A7';
                    } else {
                      draft = parsed;
                      error = null;
                    }
                  });
                },
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: error == null
                    ? () => Navigator.of(context).pop(draft)
                    : null,
                child: const Text('Áp dụng màu'),
              ),
            ],
          ),
        ),
      ),
    );
    controller.dispose();
    if (selected != null && mounted) {
      setState(() {
        onChanged(selected);
        _saved = false;
      });
    }
  }
}

class _QrPreview extends StatelessWidget {
  const _QrPreview({
    required this.data,
    required this.foreground,
    required this.background,
    required this.frameColor,
    required this.iconColor,
    required this.borderWidth,
    required this.cornerRadius,
    required this.eyeShape,
    required this.moduleShape,
    required this.frameStyle,
    required this.icon,
    super.key,
  });
  final String data, frameStyle, icon;
  final Color foreground, background, frameColor, iconColor;
  final double borderWidth, cornerRadius;
  final QrEyeShape eyeShape;
  final QrDataModuleShape moduleShape;

  @override
  Widget build(BuildContext context) {
    final hasFrame = frameStyle != 'none';
    final rounded = frameStyle == 'rounded' || frameStyle == 'badge';
    final radius = rounded ? cornerRadius : math.min(cornerRadius, 8.0);
    return Center(
      child: Container(
        padding: EdgeInsets.all(hasFrame ? 14 : 8),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(radius),
          border: hasFrame
              ? Border.all(color: frameColor, width: borderWidth)
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox.square(
              dimension: 226,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  QrImageView(
                    data: data,
                    version: QrVersions.auto,
                    errorCorrectionLevel: icon == 'none'
                        ? QrErrorCorrectLevel.M
                        : QrErrorCorrectLevel.H,
                    size: 226,
                    padding: const EdgeInsets.all(8),
                    backgroundColor: background,
                    eyeStyle: QrEyeStyle(eyeShape: eyeShape, color: foreground),
                    dataModuleStyle: QrDataModuleStyle(
                      dataModuleShape: moduleShape,
                      color: foreground,
                    ),
                  ),
                  if (icon != 'none')
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: background,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: frameColor.withValues(alpha: .35),
                        ),
                      ),
                      child: Icon(_iconData(icon), color: iconColor, size: 25),
                    ),
                ],
              ),
            ),
            if (frameStyle == 'badge') ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: frameColor,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  'SCAN ME',
                  style: TextStyle(
                    color:
                        ThemeData.estimateBrightnessForColor(frameColor) ==
                            Brightness.dark
                        ? Colors.white
                        : const Color(0xFF102019),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Text(
    label,
    style: Theme.of(context).textTheme.labelSmall?.copyWith(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w800,
      letterSpacing: 1,
    ),
  );
}

class _ControlLabel extends StatelessWidget {
  const _ControlLabel(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 9),
    child: Align(
      alignment: Alignment.centerLeft,
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
      ),
    ),
  );
}

class _ColorControl extends StatelessWidget {
  const _ColorControl({
    required this.label,
    required this.color,
    required this.onTap,
  });
  final String label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: Container(
      constraints: const BoxConstraints(minHeight: 52),
      margin: const EdgeInsets.only(top: 8),
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
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
          Text(
            _hex(color),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontFamily: 'monospace',
              fontSize: 12,
            ),
          ),
          const SizedBox(width: 6),
          const Icon(Icons.chevron_right_rounded, size: 20),
        ],
      ),
    ),
  );
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? scheme.secondary : scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(
              color: selected ? scheme.secondary : scheme.outlineVariant,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                Icon(Icons.check_rounded, size: 16, color: scheme.onSecondary),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TextStyle(
                  color: selected ? scheme.onSecondary : scheme.onSurface,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconOption extends StatelessWidget {
  const _IconOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 88,
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: selected
                ? scheme.secondary.withValues(alpha: .18)
                : scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? scheme.secondary : scheme.outlineVariant,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: selected ? scheme.secondary : null),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
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
  final String label, suffix;
  final double value, min, max;
  final ValueChanged<double> onChanged;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
          ),
          Text(
            '${value.round()}$suffix',
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
      Slider(value: value, min: min, max: max, onChanged: onChanged),
    ],
  );
}

IconData _iconData(String value) => switch (value) {
  'shield' => Icons.shield_rounded,
  'link' => Icons.link_rounded,
  'wifi' => Icons.wifi_rounded,
  'heart' => Icons.favorite_rounded,
  'business' => Icons.business_rounded,
  _ => Icons.qr_code_2_rounded,
};

String _hex(Color color) {
  final value = color.toARGB32() & 0xFFFFFF;
  return '#${value.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

Color? _parseHex(String input) {
  final normalized = input.trim().replaceFirst('#', '');
  if (!RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(normalized)) return null;
  return Color(0xFF000000 | int.parse(normalized, radix: 16));
}

double _contrastRatio(Color first, Color second) {
  final firstLuminance = first.computeLuminance();
  final secondLuminance = second.computeLuminance();
  final lighter = math.max(firstLuminance, secondLuminance);
  final darker = math.min(firstLuminance, secondLuminance);
  return (lighter + .05) / (darker + .05);
}

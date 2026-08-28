import 'package:flutter/material.dart';

import '../../domain/qr_design.dart';

Future<Color?> showQrColorPickerSheet({required BuildContext context, required String title, required Color current}) =>
    showModalBottomSheet<Color>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => _QrColorPickerSheet(title: title, current: current),
    );

class _QrColorPickerSheet extends StatefulWidget {
  const _QrColorPickerSheet({required this.title, required this.current});

  final String title;
  final Color current;

  @override
  State<_QrColorPickerSheet> createState() => _QrColorPickerSheetState();
}

class _QrColorPickerSheetState extends State<_QrColorPickerSheet> {
  late HSVColor _hsv;
  late final TextEditingController _hexController;
  String? _hexError;

  @override
  void initState() {
    super.initState();
    _hsv = HSVColor.fromColor(widget.current);
    _hexController = TextEditingController(text: colorToHex(widget.current));
  }

  @override
  void dispose() {
    _hexController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = _hsv.toColor();
    final maxHeight = MediaQuery.sizeOf(context).height * .88;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Chạm vào bảng màu hoặc tinh chỉnh HSV bên dưới.',
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: scheme.outline),
                    boxShadow: [BoxShadow(color: color.withValues(alpha: .24), blurRadius: 16)],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            AspectRatio(
              aspectRatio: 1.65,
              child: _SaturationValuePicker(hsv: _hsv, onChanged: (value) => _setHsv(value)),
            ),
            const SizedBox(height: 16),
            _HsvSlider(
              label: 'Sắc độ',
              value: _hsv.hue,
              max: 360,
              suffix: '°',
              activeColor: HSVColor.fromAHSV(1, _hsv.hue, 1, 1).toColor(),
              onChanged: (value) => _setHsv(_hsv.withHue(value)),
            ),
            _HsvSlider(
              label: 'Độ rực',
              value: _hsv.saturation * 100,
              max: 100,
              suffix: '%',
              activeColor: color,
              onChanged: (value) => _setHsv(_hsv.withSaturation(value / 100)),
            ),
            _HsvSlider(
              label: 'Độ sáng',
              value: _hsv.value * 100,
              max: 100,
              suffix: '%',
              activeColor: color,
              onChanged: (value) => _setHsv(_hsv.withValue(value / 100)),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _hexController,
              textCapitalization: TextCapitalization.characters,
              maxLength: 7,
              decoration: InputDecoration(
                labelText: 'Mã HEX',
                hintText: '#55D6A7',
                helperText: 'Bạn có thể dán trực tiếp mã màu gồm 6 ký tự.',
                errorText: _hexError,
                prefixIcon: const Icon(Icons.tag_rounded),
              ),
              onChanged: _setHex,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Hủy')),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _hexError == null ? () => Navigator.of(context).pop(color) : null,
                    icon: const Icon(Icons.check_rounded),
                    label: const Text('Áp dụng'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _setHsv(HSVColor value) {
    setState(() {
      _hsv = value;
      _hexError = null;
      final hex = colorToHex(value.toColor());
      _hexController.value = TextEditingValue(
        text: hex,
        selection: TextSelection.collapsed(offset: hex.length),
      );
    });
  }

  void _setHex(String value) {
    final parsed = colorFromHex(value);
    setState(() {
      if (parsed == null) {
        _hexError = 'Nhập đủ 6 ký tự, ví dụ #55D6A7';
        return;
      }
      _hsv = HSVColor.fromColor(parsed);
      _hexError = null;
    });
  }
}

class _SaturationValuePicker extends StatelessWidget {
  const _SaturationValuePicker({required this.hsv, required this.onChanged});

  final HSVColor hsv;
  final ValueChanged<HSVColor> onChanged;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      void update(Offset position) {
        final saturation = (position.dx / constraints.maxWidth).clamp(0.0, 1.0);
        final value = 1 - (position.dy / constraints.maxHeight).clamp(0.0, 1.0);
        onChanged(hsv.withSaturation(saturation).withValue(value));
      }

      return GestureDetector(
        onTapDown: (details) => update(details.localPosition),
        onPanStart: (details) => update(details.localPosition),
        onPanUpdate: (details) => update(details.localPosition),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: CustomPaint(
            painter: _SaturationValuePainter(hsv),
            child: Stack(
              children: [
                Positioned(
                  left: hsv.saturation * constraints.maxWidth - 12,
                  top: (1 - hsv.value) * constraints.maxHeight - 12,
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hsv.toColor(),
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 5)],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _SaturationValuePainter extends CustomPainter {
  const _SaturationValuePainter(this.hsv);

  final HSVColor hsv;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final hueColor = HSVColor.fromAHSV(1, hsv.hue, 1, 1).toColor();
    canvas.drawRect(rect, Paint()..shader = LinearGradient(colors: [Colors.white, hueColor]).createShader(rect));
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant _SaturationValuePainter oldDelegate) => oldDelegate.hsv.hue != hsv.hue;
}

class _HsvSlider extends StatelessWidget {
  const _HsvSlider({
    required this.label,
    required this.value,
    required this.max,
    required this.suffix,
    required this.activeColor,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double max;
  final String suffix;
  final Color activeColor;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 76,
        child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
      ),
      Expanded(
        child: Slider(
          value: value.clamp(0, max),
          max: max,
          activeColor: activeColor,
          label: '${value.round()}$suffix',
          onChanged: onChanged,
        ),
      ),
      SizedBox(
        width: 48,
        child: Text('${value.round()}$suffix', textAlign: TextAlign.end, style: const TextStyle(fontSize: 12)),
      ),
    ],
  );
}

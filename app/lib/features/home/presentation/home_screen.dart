import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/remote_config.dart';
import '../../../core/ads/ad_service.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/snapkit_widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    ApiClient.instance.bootstrap().then((_) => ApiClient.instance.event('app_open'));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: scheme.secondary, borderRadius: BorderRadius.circular(16)),
                  child: const Icon(Icons.shield_rounded, color: Color(0xFF102019)),
                ),
                const PrivacyPill(),
              ],
            ),
            const SizedBox(height: 32),
            const PageHeader(
              eyebrow: 'Snapkit',
              title: 'Nhẹ máy. Gọn việc.',
              description:
                  'Bộ công cụ thiết yếu, được thiết kế để dữ liệu riêng tư luôn ở lại trên điện thoại của bạn.',
            ),
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color.alphaBlend(scheme.primary.withValues(alpha: .2), scheme.surface), scheme.surface],
                ),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.bolt_rounded, color: scheme.secondary, size: 28),
                  const SizedBox(height: 28),
                  const Text(
                    '2 công cụ sẵn sàng',
                    style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800, letterSpacing: -.6),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Dọn media thông minh và QR Studio đa năng.',
                    style: TextStyle(color: scheme.onSurfaceVariant, height: 1.45),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ToolCard(
              icon: Icons.auto_delete_rounded,
              title: 'Smart Media Cleaner',
              subtitle: 'Tìm ảnh tương tự, screenshot và video lớn.',
              onTap: () => _open(context, 'media_cleaner', '/cleaner'),
            ),
            const SizedBox(height: 12),
            ToolCard(
              icon: Icons.qr_code_2_rounded,
              title: 'QR Studio',
              subtitle: 'Quét, tạo Wi-Fi, URL và mã cá nhân hóa.',
              color: scheme.secondary,
              onTap: () => _open(context, 'qr_studio', '/qr'),
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(
                  child: _Stat(value: '0 B', label: 'Media tải lên'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _Stat(value: '100%', label: 'Xử lý local'),
                ),
              ],
            ),
            const SizedBox(height: 22),
            const SnapkitBannerAd(),
          ],
        ),
      ),
    );
  }

  void _open(BuildContext context, String flag, String route) {
    if (RemoteConfig.instance.enabled(flag)) {
      context.go(route);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tính năng đang được bảo trì.')));
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value, label;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ),
    ),
  );
}

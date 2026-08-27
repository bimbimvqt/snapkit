import 'package:flutter/material.dart';
import '../../../core/config/app_environment.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/toolbox_widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 36),
        children: [
          const PageHeader(
            eyebrow: 'Preferences',
            title: 'Cài đặt',
            description: 'Quyền riêng tư, gói sử dụng và thông tin môi trường.',
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFB7F34D), Color(0xFF78DFAF)],
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.workspace_premium_rounded,
                  color: Color(0xFF102019),
                ),
                const SizedBox(height: 22),
                const Text(
                  'Toolbox Pro',
                  style: TextStyle(
                    color: Color(0xFF102019),
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 7),
                const Text(
                  'Không quảng cáo, quét thư viện lớn và QR style premium.',
                  style: TextStyle(color: Color(0xCC102019), height: 1.4),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: () => ApiClient.instance.event('paywall_view'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF102019),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Xem gói nâng cấp'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Card(
            child: Column(
              children: [
                _Tile(
                  icon: Icons.shield_outlined,
                  title: 'Privacy by default',
                  subtitle: 'Media không rời khỏi thiết bị',
                ),
                _Divider(),
                _Tile(
                  icon: Icons.ads_click_outlined,
                  title: 'Quảng cáo có kiểm soát',
                  subtitle: 'Không hiển thị trong lúc chọn/xóa media',
                ),
                _Divider(),
                _Tile(
                  icon: Icons.cloud_outlined,
                  title: 'API backend',
                  subtitle: AppEnvironment.apiBaseUrl,
                ),
                _Divider(),
                _Tile(
                  icon: Icons.science_outlined,
                  title: 'Môi trường',
                  subtitle: AppEnvironment.isProduction
                      ? 'Production'
                      : 'Development',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const PrivacyPill(),
          const SizedBox(height: 12),
          Text(
            'Toolbox One 1.0.0 · Build privacy-first',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontSize: 12,
            ),
          ),
        ],
      ),
    ),
  );
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => ListTile(
    minTileHeight: 72,
    leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
    subtitle: Text(
      subtitle,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        fontSize: 12,
      ),
    ),
  );
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const Divider(height: 1, indent: 64);
}

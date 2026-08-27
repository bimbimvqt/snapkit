import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';
import '../../../core/config/remote_config.dart';
import '../../../core/ads/ad_service.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/toolbox_widgets.dart';
import '../data/media_scanner.dart';
import '../domain/media_scan_result.dart';

class CleanerScreen extends StatefulWidget {
  const CleanerScreen({super.key});
  @override
  State<CleanerScreen> createState() => _CleanerScreenState();
}

class _CleanerScreenState extends State<CleanerScreen> {
  final _scanner = MediaScanner();
  MediaScanResult? _result;
  bool _scanning = false, _deleting = false;
  String? _error;
  final _selected = <String>{};
  Future<void> _scan() async {
    if (!RemoteConfig.instance.enabled('media_cleaner')) {
      setState(() => _error = 'Tính năng đang được bảo trì từ hệ thống.');
      return;
    }
    setState(() {
      _scanning = true;
      _error = null;
      _result = null;
      _selected.clear();
    });
    try {
      final result = await _scanner.scan();
      for (final group in result.groups.where(
        (g) => g.type == MediaGroupType.similar,
      )) {
        _selected.addAll(group.assets.skip(1).map((a) => a.id));
      }
      setState(() => _result = result);
      await ApiClient.instance.event('media_scan', {
        'scanned': result.scanned,
        'groups': result.groups.length,
      });
    } on MediaPermissionException {
      setState(
        () => _error = 'Cần quyền truy cập thư viện để phân tích media.',
      );
    } catch (_) {
      setState(() => _error = 'Không thể hoàn tất quét. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _delete() async {
    if (_selected.isEmpty) return;
    final approved =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Xóa media đã chọn?'),
            content: Text(
              '${_selected.length} mục sẽ được chuyển vào thùng rác hệ thống nếu thiết bị hỗ trợ.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Xem lại'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Xóa an toàn'),
              ),
            ],
          ),
        ) ??
        false;
    if (!approved) return;
    setState(() => _deleting = true);
    var bytes = 0;
    final assets =
        _result?.groups
            .expand((g) => g.assets)
            .where((a) => _selected.contains(a.id)) ??
        const <AssetEntity>[];
    for (final asset in assets) {
      bytes += await (await asset.file)?.length() ?? 0;
    }
    final deleted = await _scanner.delete(_selected.toList());
    await ApiClient.instance.reportCleanup(
      scanned: _result?.scanned ?? 0,
      removed: deleted.length,
      bytesFreed: bytes,
      durationMs: _result?.duration.inMilliseconds ?? 0,
    );
    await AdService.showAfterCleanup();
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Đã xóa ${deleted.length} mục.')));
      setState(() => _deleting = false);
      await _scan();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const PageHeader(
                    eyebrow: 'Private media lab',
                    title: 'Dọn bộ nhớ thông minh',
                    description:
                        'Phân tích thumbnail độ phân giải thấp ngay trên máy. Không upload ảnh/video.',
                  ),
                  const SizedBox(height: 22),
                  if (_result == null && !_scanning) _HeroScan(onScan: _scan),
                  if (_scanning) _ScanningCard(),
                  if (_error != null)
                    _ErrorCard(message: _error!, onRetry: _scan),
                  if (_result case final result?)
                    _Summary(
                      result: result,
                      selected: _selected.length,
                      onScan: _scan,
                    ),
                ],
              ),
            ),
          ),
          if (_result case final result?)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
              sliver: SliverList.separated(
                itemCount: result.groups.length,
                itemBuilder: (context, index) => _GroupCard(
                  group: result.groups[index],
                  selected: _selected,
                  onChanged: (id, value) => setState(
                    () => value ? _selected.add(id) : _selected.remove(id),
                  ),
                ),
                separatorBuilder: (_, _) => const SizedBox(height: 12),
              ),
            ),
        ],
      ),
    ),
    bottomNavigationBar: _selected.isEmpty
        ? null
        : SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: FilledButton.icon(
                onPressed: _deleting ? null : _delete,
                icon: _deleting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.delete_outline_rounded),
                label: Text('Dọn ${_selected.length} mục đã chọn'),
              ),
            ),
          ),
  );
}

class _HeroScan extends StatelessWidget {
  const _HeroScan({required this.onScan});
  final VoidCallback onScan;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 130,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                Icons.photo_library_outlined,
                size: 48,
                color: scheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Bắt đầu với thư viện của bạn',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Tìm ảnh gần giống bằng perceptual hash, screenshot cũ và video trên 100 MB.',
              style: TextStyle(color: scheme.onSurfaceVariant, height: 1.45),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.radar_rounded),
              label: const Text('Quét thư viện'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanningCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        children: [
          CircularProgressIndicator(
            color: Theme.of(context).colorScheme.secondary,
          ),
          const SizedBox(height: 18),
          const Text(
            'Đang phân tích an toàn…',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'Có thể mất một lúc với thư viện lớn',
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

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Icon(Icons.lock_outline, color: Theme.of(context).colorScheme.error),
          const SizedBox(width: 14),
          Expanded(child: Text(message)),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.result,
    required this.selected,
    required this.onScan,
  });
  final MediaScanResult result;
  final int selected;
  final VoidCallback onScan;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${result.groups.length} nhóm cần xem lại',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'Đã quét ${result.scanned} mục · chọn $selected',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onScan,
            tooltip: 'Quét lại',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
    ),
  );
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({
    required this.group,
    required this.selected,
    required this.onChanged,
  });
  final MediaGroup group;
  final Set<String> selected;
  final void Function(String, bool) onChanged;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        leading: Icon(
          group.type == MediaGroupType.similar
              ? Icons.filter_none_rounded
              : group.type == MediaGroupType.screenshots
              ? Icons.screenshot_rounded
              : Icons.movie_filter_outlined,
          color: scheme.primary,
        ),
        title: Text(
          group.title,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${group.assets.length} mục · ${_bytes(group.bytes)}',
          style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
        ),
        children: [
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: group.assets.length,
            itemBuilder: (context, index) {
              final asset = group.assets[index];
              final checked = selected.contains(asset.id);
              return GestureDetector(
                onTap: () => onChanged(asset.id, !checked),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: _Thumbnail(asset: asset),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: checked
                              ? scheme.secondary
                              : Colors.transparent,
                          width: 3,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        width: 25,
                        height: 25,
                        decoration: BoxDecoration(
                          color: checked ? scheme.secondary : Colors.black54,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          checked ? Icons.check_rounded : Icons.add_rounded,
                          size: 17,
                          color: checked
                              ? const Color(0xFF102019)
                              : Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

String _bytes(int value) => value >= 1073741824
    ? '${(value / 1073741824).toStringAsFixed(1)} GB'
    : '${(value / 1048576).toStringAsFixed(0)} MB';

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.asset});
  final AssetEntity asset;
  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List?>(
    future: asset.thumbnailDataWithSize(const ThumbnailSize.square(220)),
    builder: (context, snapshot) => snapshot.hasData
        ? Image.memory(snapshot.data!, fit: BoxFit.cover)
        : Container(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
  );
}

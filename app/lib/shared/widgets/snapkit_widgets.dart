import 'package:flutter/material.dart';

class PageHeader extends StatelessWidget {
  const PageHeader({required this.eyebrow, required this.title, this.description, super.key});
  final String eyebrow, title;
  final String? description;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        eyebrow.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        title,
        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1),
      ),
      if (description != null) ...[
        const SizedBox(height: 10),
        Text(
          description!,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.5),
        ),
      ],
    ],
  );
}

class ToolCard extends StatelessWidget {
  const ToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.color,
    super.key,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: resolvedColor.withValues(alpha: .14),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(icon, color: resolvedColor),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.35),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_rounded, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class PrivacyPill extends StatelessWidget {
  const PrivacyPill({super.key});
  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: primary.withValues(alpha: .12), borderRadius: BorderRadius.circular(99)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: primary),
          const SizedBox(width: 7),
          Text(
            'Xử lý trên thiết bị',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primary),
          ),
        ],
      ),
    );
  }
}

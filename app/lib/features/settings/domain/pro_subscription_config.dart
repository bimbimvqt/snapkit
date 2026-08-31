class ProSubscriptionConfig {
  const ProSubscriptionConfig({required this.title, required this.subtitle, required this.footer, required this.plans});

  final String title;
  final String subtitle;
  final String footer;
  final List<ProPlan> plans;

  List<ProPlan> get enabledPlans =>
      plans.where((plan) => plan.enabled).toList()
        ..sort((first, second) => first.sortOrder.compareTo(second.sortOrder));

  factory ProSubscriptionConfig.fromMobile(Map<String, Object?> mobile) {
    final raw = mobile['pro'];
    final map = raw is Map ? Map<String, Object?>.from(raw) : const <String, Object?>{};
    final rawPlans = map['plans'];
    final plans = rawPlans is List
        ? rawPlans.whereType<Map>().map((plan) => ProPlan.fromMap(Map<String, Object?>.from(plan))).toList()
        : defaultProSubscriptionConfig.plans;
    return ProSubscriptionConfig(
      title: _string(map['title'], defaultProSubscriptionConfig.title),
      subtitle: _string(map['subtitle'], defaultProSubscriptionConfig.subtitle),
      footer: _string(map['footer'], defaultProSubscriptionConfig.footer),
      plans: plans.isEmpty ? defaultProSubscriptionConfig.plans : plans,
    );
  }
}

class ProPlan {
  const ProPlan({
    required this.id,
    required this.productId,
    required this.name,
    required this.badge,
    required this.price,
    required this.currency,
    required this.priceLabel,
    required this.periodLabel,
    required this.trialDays,
    required this.ctaLabel,
    required this.description,
    required this.features,
    required this.benefits,
    required this.highlighted,
    required this.enabled,
    required this.sortOrder,
  });

  final String id;
  final String productId;
  final String name;
  final String badge;
  final int price;
  final String currency;
  final String priceLabel;
  final String periodLabel;
  final int trialDays;
  final String ctaLabel;
  final String description;
  final List<String> features;
  final List<String> benefits;
  final bool highlighted;
  final bool enabled;
  final int sortOrder;

  factory ProPlan.fromMap(Map<String, Object?> map) => ProPlan(
    id: _string(map['id'], 'pro'),
    productId: _string(map['productId'], ''),
    name: _string(map['name'], 'Snapkit Pro'),
    badge: _string(map['badge'], ''),
    price: _integer(map['price']),
    currency: _string(map['currency'], 'VND'),
    priceLabel: _string(map['priceLabel'], '—'),
    periodLabel: _string(map['periodLabel'], ''),
    trialDays: _integer(map['trialDays']),
    ctaLabel: _string(map['ctaLabel'], 'Chọn gói'),
    description: _string(map['description'], 'Mở khoá toàn bộ tính năng Pro.'),
    features: _strings(map['features']),
    benefits: _strings(map['benefits']),
    highlighted: map['highlighted'] == true,
    enabled: map['enabled'] != false,
    sortOrder: _integer(map['sortOrder']),
  );
}

String _string(Object? value, String fallback) => value is String && value.trim().isNotEmpty ? value.trim() : fallback;
int _integer(Object? value) => value is num ? value.round() : 0;
List<String> _strings(Object? value) => value is List
    ? value.whereType<String>().map((item) => item.trim()).where((item) => item.isNotEmpty).toList()
    : const [];

const defaultProSubscriptionConfig = ProSubscriptionConfig(
  title: 'Nâng cấp Snapkit Pro',
  subtitle: 'Mở khoá toàn bộ công cụ, dọn thư viện nhanh hơn và sử dụng Snapkit không quảng cáo.',
  footer: 'Thanh toán an toàn qua App Store hoặc Google Play. Bạn có thể huỷ bất kỳ lúc nào.',
  plans: [
    ProPlan(
      id: 'monthly',
      productId: 'snapkit_pro_monthly',
      name: 'Pro hàng tháng',
      badge: 'Phổ biến',
      price: 79000,
      currency: 'VND',
      priceLabel: '79.000đ',
      periodLabel: '/ tháng',
      trialDays: 7,
      ctaLabel: 'Dùng thử 7 ngày',
      description: 'Linh hoạt, đầy đủ tính năng Pro và có thể huỷ bất kỳ lúc nào.',
      features: ['Không quảng cáo', 'Quét thư viện lớn', 'QR style premium', 'Ưu tiên tính năng mới'],
      benefits: ['Khôi phục giao dịch', 'Thanh toán bảo mật'],
      highlighted: true,
      enabled: true,
      sortOrder: 0,
    ),
  ],
);

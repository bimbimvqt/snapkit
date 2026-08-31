import 'package:flutter_test/flutter_test.dart';
import 'package:snapkit/features/settings/domain/pro_subscription_config.dart';

void main() {
  test('parses, filters and sorts remote Pro plans', () {
    final config = ProSubscriptionConfig.fromMobile({
      'pro': {
        'title': 'Snapkit Premium',
        'subtitle': 'Mở khoá mọi công cụ',
        'footer': 'Huỷ bất kỳ lúc nào',
        'plans': [
          {
            'id': 'yearly',
            'productId': 'pro_yearly',
            'name': 'Gói năm',
            'badge': 'Tiết kiệm',
            'price': 599000,
            'currency': 'VND',
            'priceLabel': '599.000đ',
            'periodLabel': '/ năm',
            'trialDays': 7,
            'ctaLabel': 'Chọn gói năm',
            'description': 'Tiết kiệm hơn',
            'features': ['Không quảng cáo'],
            'benefits': ['Khôi phục giao dịch'],
            'highlighted': true,
            'enabled': true,
            'sortOrder': 0,
          },
          {
            'id': 'hidden',
            'productId': 'hidden',
            'name': 'Ẩn',
            'priceLabel': '0đ',
            'periodLabel': '/ tháng',
            'description': 'Không hiển thị',
            'ctaLabel': 'Chọn',
            'features': ['A'],
            'enabled': false,
            'sortOrder': 1,
          },
        ],
      },
    });

    expect(config.title, 'Snapkit Premium');
    expect(config.enabledPlans, hasLength(1));
    expect(config.enabledPlans.single.productId, 'pro_yearly');
    expect(config.enabledPlans.single.highlighted, isTrue);
  });

  test('uses safe defaults for missing config', () {
    final config = ProSubscriptionConfig.fromMobile(const {});
    expect(config.enabledPlans, isNotEmpty);
    expect(config.enabledPlans.first.features, contains('Không quảng cáo'));
  });
}

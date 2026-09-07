class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.avatarUrl,
    this.isPro = false,
    this.planId = 'free',
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final email = json['email'];
    if (id is! String || id.isEmpty || email is! String || email.isEmpty) {
      throw const FormatException('User response is missing required fields');
    }
    return AuthUser(
      id: id,
      email: email,
      role: json['role'] is String ? json['role'] as String : 'USER',
      name: json['name'] is String ? json['name'] as String : null,
      avatarUrl: json['avatarUrl'] is String ? json['avatarUrl'] as String : null,
      isPro: json['isPro'] == true,
      planId: json['planId'] is String ? json['planId'] as String : 'free',
    );
  }

  final String id;
  final String email;
  final String role;
  final String? name;
  final String? avatarUrl;
  final bool isPro;
  final String planId;

  String get displayName {
    final normalizedName = name?.trim();
    return normalizedName != null && normalizedName.isNotEmpty ? normalizedName : email;
  }
}

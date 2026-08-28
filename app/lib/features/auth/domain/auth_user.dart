class AuthUser {
  const AuthUser({required this.id, required this.email, required this.role, this.name, this.avatarUrl});

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
    );
  }

  final String id;
  final String email;
  final String role;
  final String? name;
  final String? avatarUrl;

  String get displayName {
    final normalizedName = name?.trim();
    return normalizedName != null && normalizedName.isNotEmpty ? normalizedName : email;
  }
}

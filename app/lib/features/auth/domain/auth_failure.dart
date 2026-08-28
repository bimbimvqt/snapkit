sealed class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
}

class AuthCanceledFailure extends AuthFailure {
  const AuthCanceledFailure() : super('Bạn đã đóng cửa sổ đăng nhập.');
}

class AuthConfigurationFailure extends AuthFailure {
  const AuthConfigurationFailure()
    : super('Google Sign-In chưa được cấu hình cho bản build này. Vui lòng liên hệ quản trị viên.');
}

class AuthNetworkFailure extends AuthFailure {
  const AuthNetworkFailure() : super('Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.');
}

class AuthServerFailure extends AuthFailure {
  const AuthServerFailure(super.message);
}

class AuthUnexpectedFailure extends AuthFailure {
  const AuthUnexpectedFailure() : super('Không thể đăng nhập lúc này. Vui lòng thử lại sau.');
}

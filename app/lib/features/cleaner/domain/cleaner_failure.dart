sealed class CleanerFailure implements Exception {
  const CleanerFailure(this.message);
  final String message;
}

class CleanerPermissionFailure extends CleanerFailure {
  const CleanerPermissionFailure() : super('Cần quyền truy cập thư viện để phân tích media.');
}

class CleanerUnexpectedFailure extends CleanerFailure {
  const CleanerUnexpectedFailure() : super('Không thể hoàn tất thao tác. Vui lòng thử lại.');
}

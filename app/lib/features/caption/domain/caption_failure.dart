sealed class CaptionFailure implements Exception {
  const CaptionFailure(this.message);

  final String message;
}

class CaptionInvalidImageFailure extends CaptionFailure {
  const CaptionInvalidImageFailure() : super('Một hoặc nhiều ảnh không còn khả dụng. Hãy chọn lại ảnh.');
}

class CaptionUnauthorizedFailure extends CaptionFailure {
  const CaptionUnauthorizedFailure() : super('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
}

class CaptionDailyLimitFailure extends CaptionFailure {
  const CaptionDailyLimitFailure() : super('Bạn đã dùng hết lượt AI hôm nay. Lượt mới sẽ mở vào ngày mai.');
}

class CaptionUnavailableFailure extends CaptionFailure {
  const CaptionUnavailableFailure() : super('AI Studio đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
}

class CaptionNetworkFailure extends CaptionFailure {
  const CaptionNetworkFailure() : super('Không thể kết nối dịch vụ AI. Hãy kiểm tra mạng rồi thử lại.');
}

class CaptionUnexpectedFailure extends CaptionFailure {
  const CaptionUnexpectedFailure() : super('Chưa thể tạo nội dung lúc này. Vui lòng thử lại.');
}

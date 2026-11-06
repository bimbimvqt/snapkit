# Support / Hỗ trợ

- [Website / Trang chủ](https://snapkit.vn/)
- [Downloads / Tải phiên bản mới](https://github.com/bimbimvqt/snapkit/releases)
- [Report an issue / Báo lỗi](https://github.com/bimbimvqt/snapkit/issues)
- [English guide](README.md) · [Hướng dẫn tiếng Việt](README.vi.md) · [Changelog](CHANGELOG.md)

Before reporting, check the installed extension version in the editor’s Extensions view, reload the editor after updating the VSIX and reproduce with a new debug session. Snapkit’s Stop debug control needs Debug Sync 1.3+ and a connected device session.

Include:

1. OS, CPU architecture, editor name/version, Flutter version and Snapkit Desktop/extension versions.
2. Whether the device is an iOS Simulator, Android Emulator or physical phone.
3. Steps to reproduce, expected behavior and actual behavior.
4. Relevant **Output → Snapkit Debug Sync** messages and a screenshot if useful.

Review logs and screenshots before attaching them: omit tokens, defines file contents, credentials and private project paths. A small reproducible Flutter example is enough; a private source repository is not required.

Khi báo lỗi, vui lòng ghi phiên bản hệ điều hành, IDE, Flutter, Snapkit và extension; loại thiết bị; bước tái hiện; kết quả mong muốn và thực tế. Log tích hợp ở **Output → Snapkit Debug Sync**. Kiểm tra và bỏ thông tin riêng tư trước khi đính kèm. Không cần chia sẻ toàn bộ source dự án.

Cursor and Antigravity support is beta. Include the exact editor build when reporting compatibility problems. Android Studio/IntelliJ, React Native/Metro and remote extension hosts do not have verified group-debug integration in this release.

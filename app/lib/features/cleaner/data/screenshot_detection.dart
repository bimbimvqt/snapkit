/// Utility for identifying screenshot media assets and folders across iOS,
/// Android, and desktop platforms.
///
/// Combines Darwin PhotoKit subtype bitmask verification, regex boundary
/// matching for standard naming conventions, and localized album/file markers
/// for major global languages and OEM vendors (Samsung, Xiaomi, Oppo, Apple, etc.).
abstract final class ScreenshotDetection {
  /// Darwin PhotoKit media subtype flag for screenshots:
  /// `PHAssetMediaSubtypePhotoScreenshot` = `1 << 2` (value 4).
  static const int darwinPhotoScreenshotSubtype = 1 << 2;
  static const int _darwinPhotoScreenshotSubtype = darwinPhotoScreenshotSubtype;

  /// Regex pattern matching common English screenshot naming conventions in
  /// filenames, album titles, and folder paths.
  ///
  /// Matches variants like:
  /// - `Screenshot_20260904.png`
  /// - `Screen Shot 2026-09-04 at 12.34.56.png`
  /// - `screen_capture_20260904.jpg`
  /// - `screencap_20260904.png`
  /// - `Screenshot20260904.png`
  /// - `Screenshots/`
  ///
  /// Prevents false positives such as `screenshotting-guide.jpg`.
  static final RegExp _englishMarker = RegExp(
    r'(^|[\\/._\-\s])screen(?:[ ._\-]?)(?:shot|capture|cap)s?(?=$|[\\/._\-\s(\d])',
    caseSensitive: false,
  );

  /// Localized screenshot markers across languages and OEM distributions:
  ///
  /// - Vietnamese: 'ảnh chụp màn hình', 'chụp màn hình'
  /// - French: "capture d'écran", "capture d’écran"
  /// - Spanish: 'captura de pantalla', 'capturas de pantalla'
  /// - Portuguese: 'captura de tela', 'captura de ecrã'
  /// - German: 'bildschirmfoto', 'bildschirmaufnahme'
  /// - Italian: 'istantanea', 'istantanee', 'cattura schermo'
  /// - Russian: 'скриншот', 'снимок экрана', 'снимки экрана'
  /// - Chinese: '屏幕快照' (iOS), '螢幕快照', '截图', '截屏'
  /// - Japanese: 'スクリーンショット', '画面キャプチャ'
  /// - Korean: '스크린샷', '화면 캡처'
  /// - Turkish: 'ekran görüntüsü', 'ekran görüntüleri'
  /// - Polish: 'zrzut ekranu'
  /// - Indonesian / Malay: 'tangkapan layar'
  /// - Thai: 'ภาพหน้าจอ'
  /// - Arabic: 'لقطة شاشة', 'لقطات الشاشة'
  static const List<String> _localizedMarkers = <String>[
    // Vietnamese
    'ảnh chụp màn hình',
    'chụp màn hình',

    // French
    'capture d’écran',
    "capture d'écran",
    'captures d’écran',
    "captures d'écran",

    // Spanish
    'captura de pantalla',
    'capturas de pantalla',

    // Portuguese
    'captura de tela',
    'capturas de tela',
    'captura de ecrã',
    'capturas de ecrã',

    // German
    'bildschirmfoto',
    'bildschirmfotos',
    'bildschirmaufnahme',

    // Italian (iOS default album is "Istantanee")
    'istantanea',
    'istantanee',
    'cattura schermo',

    // Russian (iOS default album is "Снимки экрана")
    'скриншот',
    'скриншоты',
    'снимок экрана',
    'снимки экрана',

    // Chinese (iOS default album is "屏幕快照" / "螢幕快照")
    '屏幕快照',
    '螢幕快照',
    '截图',
    '截屏',

    // Japanese
    'スクリーンショット',
    '画面キャプチャ',

    // Korean
    '스크린샷',
    '화면 캡처',
    '화면 캡쳐',

    // Turkish
    'ekran görüntüsü',
    'ekran görüntüleri',

    // Polish
    'zrzut ekranu',
    'zrzuty ekranu',

    // Indonesian / Malay
    'tangkapan layar',

    // Thai
    'ภาพหน้าจอ',

    // Arabic
    'لقطة شاشة',
    'لقطات الشاشة',
  ];

  /// Checks whether [value] (such as an asset title, relative path, or album name)
  /// represents a screenshot based on English regex patterns or localized keywords.
  static bool matches(String? value) {
    if (value == null || value.isEmpty) return false;
    if (_englishMarker.hasMatch(value)) return true;
    final normalized = value.toLowerCase();
    return _localizedMarkers.any(normalized.contains);
  }

  /// Checks whether [subtype] matches the Darwin PhotoKit screenshot bitmask.
  static bool matchesDarwinSubtype(int subtype) =>
      subtype & _darwinPhotoScreenshotSubtype == _darwinPhotoScreenshotSubtype;
}

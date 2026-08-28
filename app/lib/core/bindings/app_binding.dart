import 'package:get/get.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/data/google_auth_repository.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/cleaner/application/cleaner_controller.dart';
import '../../features/cleaner/data/device_cleaner_repository.dart';
import '../../features/cleaner/domain/cleaner_repository.dart';
import '../../features/home/application/home_controller.dart';
import '../../features/home/data/api_home_repository.dart';
import '../../features/home/domain/home_repository.dart';
import '../../features/qr/application/qr_editor_controller.dart';
import '../../features/qr/data/api_qr_repository.dart';
import '../../features/qr/data/device_qr_gallery_saver.dart';
import '../../features/qr/data/device_qr_logo_picker.dart';
import '../../features/qr/domain/qr_gallery_saver.dart';
import '../../features/qr/domain/qr_repository.dart';
import '../../features/settings/application/settings_controller.dart';
import '../../features/settings/data/api_settings_repository.dart';
import '../../features/settings/domain/settings_repository.dart';
import '../../shared/application/app_shell_controller.dart';
import '../config/remote_config.dart';
import '../network/api_client.dart';

class AppBinding extends Bindings {
  AppBinding({this.authRepository});

  final AuthRepository? authRepository;

  @override
  void dependencies() {
    Get.put<AuthRepository>(authRepository ?? GoogleAuthRepository(), permanent: true);
    Get.put(AuthController(Get.find<AuthRepository>()), permanent: true);
    Get.put(AppShellController(), permanent: true);

    Get.put<SettingsRepository>(ApiSettingsRepository(ApiClient.instance), permanent: true);
    Get.put(
      SettingsController(repository: Get.find<SettingsRepository>(), authController: Get.find<AuthController>()),
      permanent: true,
    );

    Get.put<HomeRepository>(ApiHomeRepository(ApiClient.instance), permanent: true);
    Get.put(
      HomeController(
        repository: Get.find<HomeRepository>(),
        shellController: Get.find<AppShellController>(),
        isFeatureEnabled: RemoteConfig.instance.enabled,
      ),
      permanent: true,
    );

    Get.put<CleanerRepository>(DeviceCleanerRepository(), permanent: true);
    Get.put(
      CleanerController(
        repository: Get.find<CleanerRepository>(),
        isFeatureEnabled: () => RemoteConfig.instance.enabled('media_cleaner'),
        scanSettings: () => RemoteConfig.instance.cleaner,
      ),
      permanent: true,
    );

    Get.put<QrRepository>(ApiQrRepository(ApiClient.instance), permanent: true);
    Get.put<QrLogoPicker>(DeviceQrLogoPicker(), permanent: true);
    Get.put<QrGallerySaver>(DeviceQrGallerySaver(), permanent: true);
    Get.put(
      QrEditorController(
        repository: Get.find<QrRepository>(),
        logoPicker: Get.find<QrLogoPicker>(),
        gallerySaver: Get.find<QrGallerySaver>(),
        isFeatureEnabled: () => RemoteConfig.instance.enabled('qr_studio'),
      ),
      permanent: true,
    );
  }
}

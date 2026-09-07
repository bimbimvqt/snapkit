import 'package:get/get.dart';

import '../../features/caption/application/caption_studio_controller.dart';
import '../../features/caption/data/api_caption_repository.dart';
import '../../features/caption/data/caption_remote_datasource.dart';
import '../../features/caption/domain/caption_repository.dart';
import '../network/api_client.dart';

class CaptionStudioBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CaptionDataSource>(() => CaptionRemoteDataSource(apiClient: ApiClient.instance));
    Get.lazyPut<CaptionRepository>(() => ApiCaptionRepository(remoteDataSource: Get.find<CaptionDataSource>()));
    Get.lazyPut(() => CaptionStudioController(repository: Get.find<CaptionRepository>()));
  }
}

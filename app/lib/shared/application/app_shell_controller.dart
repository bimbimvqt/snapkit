import 'package:get/get.dart';

enum AppTab { home, cleaner, qr, settings }

class AppShellController extends GetxController {
  final _currentTab = AppTab.home.obs;

  AppTab get currentTab => _currentTab.value;
  int get currentIndex => currentTab.index;

  void selectTab(AppTab tab) {
    if (_currentTab.value == tab) return;
    _currentTab.value = tab;
  }

  void selectIndex(int index) {
    if (index < 0 || index >= AppTab.values.length) return;
    selectTab(AppTab.values[index]);
  }
}

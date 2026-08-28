abstract interface class QrRepository {
  Future<bool> save({required String kind, required String content, required Map<String, Object> style});

  Future<void> trackCreated({required String kind, required String frameStyle, required String icon});
}

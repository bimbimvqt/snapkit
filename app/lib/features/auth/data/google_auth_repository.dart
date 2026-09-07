import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/config/app_environment.dart';
import '../../../core/network/api_client.dart';
import '../domain/auth_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/auth_user.dart';

class GoogleAuthRepository implements AuthRepository {
  GoogleAuthRepository({ApiClient? apiClient, FirebaseAuth? firebaseAuth, GoogleSignIn? googleSignIn})
    : _apiClient = apiClient ?? ApiClient.instance,
      _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
      _googleSignIn = googleSignIn ?? GoogleSignIn.instance;

  final ApiClient _apiClient;
  final FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;
  bool _googleInitialized = false;

  @override
  Future<AuthUser?> restoreSession() async {
    if (!await _apiClient.hasSession()) return null;
    try {
      final user = AuthUser.fromJson(await _apiClient.currentUser());
      return user.email.isEmpty ? null : user;
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 || error.response?.statusCode == 403) {
        return null;
      }
      throw _failureFromDio(error);
    } on FormatException {
      await _apiClient.clearSession();
      return null;
    }
  }

  @override
  Future<AuthUser> signInWithGoogle() async {
    try {
      await _initializeGoogle();
      if (!_googleSignIn.supportsAuthenticate()) throw const AuthConfigurationFailure();
      final account = await _googleSignIn.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) throw const AuthConfigurationFailure();
      final credential = GoogleAuthProvider.credential(idToken: idToken);
      await _firebaseAuth.signInWithCredential(credential);
      try {
        return AuthUser.fromJson(await _apiClient.authenticateWithGoogle(idToken));
      } catch (_) {
        try {
          await _firebaseAuth.signOut();
        } catch (_) {
          // The Snapkit backend session is still the authentication source of truth.
        }
        rethrow;
      }
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled || error.code == GoogleSignInExceptionCode.interrupted) {
        throw const AuthCanceledFailure();
      }
      if (error.code == GoogleSignInExceptionCode.clientConfigurationError ||
          error.code == GoogleSignInExceptionCode.providerConfigurationError) {
        throw const AuthConfigurationFailure();
      }
      throw const AuthUnexpectedFailure();
    } on FirebaseAuthException catch (error) {
      if (error.code == 'network-request-failed') throw const AuthNetworkFailure();
      if (error.code == 'invalid-credential' ||
          error.code == 'operation-not-allowed' ||
          error.code == 'app-not-authorized') {
        throw const AuthConfigurationFailure();
      }
      throw const AuthUnexpectedFailure();
    } on DioException catch (error) {
      throw _failureFromDio(error);
    } on AuthFailure {
      rethrow;
    } on FormatException {
      throw const AuthUnexpectedFailure();
    }
  }

  @override
  Future<void> signOut() async {
    await _apiClient.logout();
    try {
      await _initializeGoogle();
      await _googleSignIn.signOut();
    } catch (_) {
      // Backend and local tokens are already cleared; provider cleanup is best effort.
    }
    try {
      await _firebaseAuth.signOut();
    } catch (_) {
      // Backend and local tokens are already cleared; Firebase cleanup is best effort.
    }
  }

  Future<void> _initializeGoogle() async {
    if (_googleInitialized) return;
    if (AppEnvironment.googleServerClientId.isEmpty) throw const AuthConfigurationFailure();
    final isApplePlatform =
        defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS;
    if (isApplePlatform && AppEnvironment.googleIosClientId.isEmpty) throw const AuthConfigurationFailure();
    await _googleSignIn.initialize(
      clientId: isApplePlatform ? AppEnvironment.googleIosClientId : null,
      serverClientId: AppEnvironment.googleServerClientId,
    );
    _googleInitialized = true;
  }

  AuthFailure _failureFromDio(DioException error) {
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const AuthNetworkFailure();
    }

    final body = error.response?.data;
    if (body is Map) {
      final apiError = body['error'];
      if (apiError is Map && apiError['message'] is String) {
        return AuthServerFailure(apiError['message'] as String);
      }
    }
    return const AuthUnexpectedFailure();
  }
}

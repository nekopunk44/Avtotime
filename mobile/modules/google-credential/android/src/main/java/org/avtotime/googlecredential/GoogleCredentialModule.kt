package org.avtotime.googlecredential

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private class SignInCancelledException :
  CodedException("ERR_CANCELLED", "Вход отменён", null)

private class NoGoogleAccountException(cause: Throwable?) :
  CodedException("ERR_NO_CREDENTIAL", "На устройстве нет аккаунта Google", cause)

private class SignInFailedException(message: String?, cause: Throwable?) :
  CodedException("ERR_SIGNIN", message ?: "Не удалось войти через Google", cause)

/**
 * Вход через Google системной шторкой Android Credential Manager — тот самый
 * нижний лист, который рисует сама система. Бесплатная версия
 * react-native-google-signin умеет только старый полноэкранный диалог,
 * поэтому шторка живёт в этом локальном модуле. idToken выписывается на
 * web-клиент (serverClientId) — бэкенд проверяет его как и раньше.
 */
class GoogleCredentialModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoogleCredential")

    AsyncFunction("signIn") Coroutine { webClientId: String, onlyAuthorized: Boolean ->
      val activity = appContext.currentActivity
        ?: throw SignInFailedException("Экран ещё не готов", null)

      val option = GetGoogleIdOption.Builder()
        .setServerClientId(webClientId)
        // false — показать все аккаунты устройства, а не только уже входившие.
        .setFilterByAuthorizedAccounts(onlyAuthorized)
        .setAutoSelectEnabled(false)
        .build()
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(option)
        .build()

      try {
        val result = CredentialManager.create(activity).getCredential(activity, request)
        val credential = result.credential
        if (credential is CustomCredential &&
          credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
          val google = GoogleIdTokenCredential.createFrom(credential.data)
          mapOf(
            "idToken" to google.idToken,
            "email" to google.id,
            "name" to (google.displayName ?: ""),
            "photo" to (google.profilePictureUri?.toString() ?: ""),
          )
        } else {
          throw SignInFailedException("Google вернул неожиданный тип учётных данных", null)
        }
      } catch (e: GetCredentialCancellationException) {
        throw SignInCancelledException()
      } catch (e: NoCredentialException) {
        throw NoGoogleAccountException(e)
      }
    }
  }
}

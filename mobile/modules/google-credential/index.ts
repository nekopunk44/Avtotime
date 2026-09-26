import { requireOptionalNativeModule } from 'expo-modules-core';

export interface GoogleCredentialResult {
  idToken: string;
  email: string;
  name: string;
  photo: string;
}

interface GoogleCredentialNative {
  signIn(webClientId: string, onlyAuthorized: boolean): Promise<GoogleCredentialResult>;
}

// Модуль вшивается только нативной сборкой: в Expo Go и в клиенте, собранном
// до его появления, его нет — тогда экран входа падает в старый диалог.
const native = requireOptionalNativeModule<GoogleCredentialNative>('GoogleCredential');

export const googleSheetAvailable = !!native;

/**
 * Системная шторка входа Google (Credential Manager). Реджекты с кодами:
 * ERR_CANCELLED — пользователь закрыл шторку, ERR_NO_CREDENTIAL — на
 * устройстве нет аккаунтов Google, ERR_SIGNIN — остальное.
 */
export function signInWithGoogleSheet(
  webClientId: string,
  onlyAuthorized = false,
): Promise<GoogleCredentialResult> {
  if (!native) return Promise.reject(new Error('Модуль GoogleCredential не собран'));
  return native.signIn(webClientId, onlyAuthorized);
}

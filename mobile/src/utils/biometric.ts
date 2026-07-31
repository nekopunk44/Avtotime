import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY = 'biometric_lock';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export type BiometricInfo = { label: string; icon: 'scan-outline' | 'finger-print' | 'eye-outline' | 'lock-open-outline' };

// Detects which biometric the device actually offers so the UI can show the
// right method (Face ID / отпечаток / радужка), not just "Face ID".
export async function getBiometricInfo(): Promise<BiometricInfo> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return { label: 'Face ID', icon: 'scan-outline' };
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return { label: 'отпечаток пальца', icon: 'finger-print' };
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return { label: 'сканер радужки', icon: 'eye-outline' };
    return { label: 'биометрию', icon: 'lock-open-outline' };
  } catch {
    return { label: 'биометрию', icon: 'lock-open-outline' };
  }
}

export async function getBiometricLabel(): Promise<string> {
  return (await getBiometricInfo()).label;
}

export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Отмена',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function isLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) === 'true';
}

export async function persistLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY, enabled ? 'true' : 'false');
}

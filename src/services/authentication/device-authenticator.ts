import * as LocalAuthentication from 'expo-local-authentication';

import type { Authenticator } from '@/core';

/** Fingerprint, face or the phone's screen lock, whichever the device has set up. */
export const deviceAuthenticator: Authenticator = {
  async isAvailable(): Promise<boolean> {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  },

  async authenticate(reason: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      // Lets the screen-lock PIN, pattern or password stand in when biometrics fail.
      disableDeviceFallback: false,
    });
    return result.success;
  },
};

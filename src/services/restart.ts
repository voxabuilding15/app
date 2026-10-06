import * as Updates from 'expo-updates';

/** Reloads the app from scratch, as needed for a new layout direction. False when it cannot. */
export async function restartApp(): Promise<boolean> {
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

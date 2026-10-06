import RNRestart from 'react-native-restart';

/** Reloads the app from scratch, as needed for a new layout direction. False when it cannot. */
export async function restartApp(): Promise<boolean> {
  try {
    RNRestart.restart();
    return true;
  } catch {
    return false;
  }
}

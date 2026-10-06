import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import type { AmbientSound } from '../domain/settings';

import { SOUND_LABEL } from './format';
import { AMBIENT_SOURCES, TICK_SOURCE } from './sound-assets';

const AMBIENT_VOLUME = 0.6;
const TICK_VOLUME = 0.35;

function loop(source: number, volume: number): AudioPlayer {
  const player = createAudioPlayer(source);
  player.loop = true;
  player.volume = volume;
  return player;
}

/**
 * Plays the chosen ambient loop and the optional tick while a focus session runs. The ambient
 * sound is registered for the lock screen so it keeps playing, and can be paused, with the screen
 * off. Audio is a nicety, so a device that cannot play it never interrupts the timer.
 */
export function useFocusAudio(ambient: AmbientSound, tick: boolean, active: boolean): void {
  useEffect(() => {
    if (!active || ambient === 'none') {
      return undefined;
    }
    let player: AudioPlayer | null = null;
    try {
      player = loop(AMBIENT_SOURCES[ambient], AMBIENT_VOLUME);
      void setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch(() => undefined);
      player.setActiveForLockScreen(true, { title: SOUND_LABEL[ambient], artist: 'FocusFlow' });
      player.play();
    } catch {
      player = null;
    }
    return () => {
      try {
        player?.clearLockScreenControls();
        player?.remove();
      } catch {
        // Already released with the app going away.
      }
    };
  }, [ambient, active]);

  useEffect(() => {
    if (!active || !tick) {
      return undefined;
    }
    let player: AudioPlayer | null = null;
    try {
      player = loop(TICK_SOURCE, TICK_VOLUME);
      player.play();
    } catch {
      player = null;
    }
    return () => {
      try {
        player?.remove();
      } catch {
        // Already released with the app going away.
      }
    };
  }, [tick, active]);
}

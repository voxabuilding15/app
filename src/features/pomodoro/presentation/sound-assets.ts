import coffeeShop from '../../../../assets/sounds/coffee-shop.ogg';
import forest from '../../../../assets/sounds/forest.ogg';
import rain from '../../../../assets/sounds/rain.ogg';
import tick from '../../../../assets/sounds/tick.ogg';
import whiteNoise from '../../../../assets/sounds/white-noise.ogg';
import type { AmbientSound } from '../domain/settings';

/** The bundled loops, in their own module so tests can stand in for the audio files. */
export const AMBIENT_SOURCES: Record<Exclude<AmbientSound, 'none'>, number> = {
  'white-noise': whiteNoise,
  rain,
  forest,
  'coffee-shop': coffeeShop,
};

/** One second long with a click at the start, so looping it ticks once a second. */
export const TICK_SOURCE: number = tick;

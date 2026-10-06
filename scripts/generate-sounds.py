"""Generates the Pomodoro ambient sounds (assets/sounds/*.ogg) from synthetic noise.

Run: python3 scripts/generate-sounds.py   (needs numpy and ffmpeg)
The loops are short, mono and heavily compressed to keep the app small; each one fades its end
into its start so it repeats without a click.
"""
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

RATE = 22050
SECONDS = 12
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"
rng = np.random.default_rng(7)


def noise(n):
    return rng.standard_normal(n)


def band(signal, low, high):
    """Brick-wall band-pass in the frequency domain."""
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / RATE)
    spectrum[(freqs < low) | (freqs > high)] = 0
    return np.fft.irfft(spectrum, len(signal))


def pink(n):
    spectrum = np.fft.rfft(noise(n))
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    freqs[0] = 1
    return np.fft.irfft(spectrum / np.sqrt(freqs), n)


def seamless(signal, fade=RATE // 2):
    """Cross-fades the tail into the head so the loop has no seam."""
    head, tail = signal[:fade].copy(), signal[-fade:].copy()
    ramp = np.linspace(0, 1, fade)
    mixed = head * np.sqrt(ramp) + tail * np.sqrt(1 - ramp)
    return np.concatenate([mixed, signal[fade:-fade]])


def normalise(signal, peak=0.8):
    return signal / np.max(np.abs(signal)) * peak


def white():
    return normalise(seamless(noise(RATE * SECONDS + RATE)))


def rain():
    n = RATE * SECONDS + RATE
    bed = band(pink(n), 400, 9000)
    drops = np.zeros(n)
    drops[rng.integers(0, n, n // 90)] = rng.uniform(0.5, 2.5, n // 90)
    drops = band(np.convolve(drops, np.exp(-np.arange(200) / 25), "same"), 2500, 10000)
    return normalise(seamless(bed * 0.8 + drops * 1.2))


def forest():
    n = RATE * SECONDS + RATE
    t = np.arange(n) / RATE
    wind = band(pink(n), 60, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 5.5))
    birds = np.zeros(n)
    for start in rng.uniform(0.5, SECONDS, 9):
        for note in range(rng.integers(2, 5)):
            begin = int((start + note * 0.16) * RATE)
            length = int(0.11 * RATE)
            if begin + length >= n:
                continue
            tt = np.arange(length) / RATE
            base = rng.uniform(2200, 4200)
            chirp = np.sin(2 * np.pi * (base * tt + 6000 * tt**2))
            birds[begin : begin + length] += chirp * np.hanning(length) * 0.35
    return normalise(seamless(wind + birds))


def coffee_shop():
    n = RATE * SECONDS + RATE
    t = np.arange(n) / RATE
    murmur = band(pink(n), 250, 1800) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * t / 1.7)))
    clinks = np.zeros(n)
    for start in rng.uniform(0.5, SECONDS, 7):
        begin = int(start * RATE)
        length = int(0.18 * RATE)
        tt = np.arange(length) / RATE
        tone = np.sin(2 * np.pi * rng.uniform(2800, 4200) * tt) * np.exp(-tt * 28)
        if begin + length < n:
            clinks[begin : begin + length] += tone * 0.5
    return normalise(seamless(murmur + clinks))


def tick():
    """One second with a short click at the start, so looping it ticks once per second."""
    out = np.zeros(RATE)
    length = int(0.03 * RATE)
    tt = np.arange(length) / RATE
    out[:length] = np.sin(2 * np.pi * 1500 * tt) * np.exp(-tt * 140)
    return normalise(out, 0.7)


def write(name, signal, quality):
    OUT.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(signal, -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as folder:
        wav_path = Path(folder) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm.tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", "libvorbis", "-q:a", str(quality), str(OUT / f"{name}.ogg")],
            check=True,
        )


if __name__ == "__main__":
    for sound_name, make, q in [("white-noise", white, 0), ("rain", rain, 0), ("forest", forest, 0), ("coffee-shop", coffee_shop, 0), ("tick", tick, 0)]:
        write(sound_name, make(), q)

#!/usr/bin/env python3
"""Synthesize original SVG Performance unlock / win stingers.

No third-party samples. Run from repo root:

    python3 scripts/synth-unlock-sfx.py
"""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np

SR = 48_000
OUT_DIR = Path("public/sfx")


def time_axis(seconds: float) -> np.ndarray:
    n = int(round(seconds * SR))
    return np.arange(n, dtype=np.float64) / SR


def exp_env(t: np.ndarray, tau: float) -> np.ndarray:
    return np.exp(-t / max(tau, 1e-5))


def adsr(n: int, attack: float, decay: float, sustain: float, release: float, hold: float = 0.0) -> np.ndarray:
    a = int(attack * SR)
    d = int(decay * SR)
    h = int(hold * SR)
    r = int(release * SR)
    env = np.zeros(n, dtype=np.float64)
    i = 0
    if a:
        env[i : i + a] = np.linspace(0.0, 1.0, a, endpoint=False)
        i += a
    if d:
        env[i : i + d] = np.linspace(1.0, sustain, d, endpoint=False)
        i += d
    hold_end = min(n - r, i + max(h, 0))
    if hold_end > i:
        env[i:hold_end] = sustain
        i = hold_end
    if r and i < n:
        env[i : i + r] = np.linspace(env[i - 1] if i else sustain, 0.0, min(r, n - i), endpoint=True)
    return env


def one_pole_lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    if cutoff <= 0:
        return np.zeros_like(x)
    rc = 1.0 / (2.0 * math.pi * cutoff)
    a = 1.0 / (rc * SR + 1.0)
    y = np.empty_like(x)
    acc = 0.0
    for i, sample in enumerate(x):
        acc += a * (sample - acc)
        y[i] = acc
    return y


def one_pole_hp(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - one_pole_lp(x, cutoff)


def sweep_lp(x: np.ndarray, start: float, end: float) -> np.ndarray:
    n = len(x)
    cut = np.geomspace(start, end, n)
    y = np.empty_like(x)
    acc = 0.0
    for i, sample in enumerate(x):
        rc = 1.0 / (2.0 * math.pi * cut[i])
        a = 1.0 / (rc * SR + 1.0)
        acc += a * (sample - acc)
        y[i] = acc
    return y


def noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, n)


def pinkish(n: int, rng: np.random.Generator) -> np.ndarray:
    white = noise(n, rng)
    b0 = b1 = b2 = 0.0
    out = np.empty(n)
    for i, w in enumerate(white):
        b0 = 0.99765 * b0 + w * 0.0990460
        b1 = 0.96300 * b1 + w * 0.2965164
        b2 = 0.57000 * b2 + w * 1.0526913
        out[i] = b0 + b1 + b2 + w * 0.1848
    peak = np.max(np.abs(out)) or 1.0
    return out / peak


def sine_partial(t: np.ndarray, freq: float, tau: float, amp: float, phase: float = 0.0) -> np.ndarray:
    return amp * np.sin(2 * math.pi * freq * t + phase) * exp_env(t, tau)


def chirp(t: np.ndarray, f0: float, f1: float, tau: float, amp: float) -> np.ndarray:
    k = (f1 - f0) / max(t[-1], 1e-6)
    phase = 2 * math.pi * (f0 * t + 0.5 * k * t * t)
    return amp * np.sin(phase) * exp_env(t, tau)


def place(dest: np.ndarray, src: np.ndarray, at: float) -> None:
    start = int(round(at * SR))
    if start >= dest.shape[0]:
        return
    end = min(dest.shape[0], start + src.shape[0])
    dest[start:end] += src[: end - start]


def stereo_width(mono: np.ndarray, rng: np.random.Generator, delay_ms: float = 7.0) -> np.ndarray:
    delay = int(delay_ms * SR / 1000)
    right = np.zeros_like(mono)
    if delay > 0:
        right[delay:] = mono[:-delay]
        right[:delay] = mono[:delay] * 0.2
    else:
        right = mono.copy()
    # tiny detune shimmer via a delayed inverted sliver
    haze = one_pole_hp(mono * 0.12, 1800) * rng.choice([-1.0, 1.0])
    left = mono + haze * 0.15
    right = right - haze * 0.18
    return np.stack([left, right], axis=1)


def soft_limit(x: np.ndarray, ceiling: float = 0.89) -> np.ndarray:
    peak = np.max(np.abs(x)) or 1.0
    y = np.tanh(x / peak * 1.35) * (ceiling / math.tanh(1.35))
    return y


def fade(x: np.ndarray, in_ms: float = 4.0, out_ms: float = 40.0) -> np.ndarray:
    n = x.shape[0]
    fade_in = min(n, int(in_ms * SR / 1000))
    fade_out = min(n, int(out_ms * SR / 1000))
    y = x.copy()
    if fade_in:
        ramp = np.linspace(0.0, 1.0, fade_in)
        y[:fade_in] *= ramp.reshape(-1, *([1] * (y.ndim - 1)))
    if fade_out:
        ramp = np.linspace(1.0, 0.0, fade_out)
        y[-fade_out:] *= ramp.reshape(-1, *([1] * (y.ndim - 1)))
    return y


def write_wav(path: Path, stereo: np.ndarray) -> None:
    import wave
    import struct

    pcm = np.clip(stereo, -1.0, 1.0)
    ints = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(ints.tobytes() if False else struct.pack("<" + "h" * ints.size, *ints.reshape(-1)))


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    # WAVs are already peak-limited to -1 dBFS. Encode with a true-peak cap
    # so MPEG transients cannot clip.
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-af",
            "volume=-1.2dB,alimiter=limit=0.84:attack=1:release=8",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(mp3_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def metal(duration: float, short: bool, seed: int = 11) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = time_axis(duration)
    n = len(t)
    mix = np.zeros(n)

    # Deep brushed plate body.
    mix += chirp(t, 118, 46, 0.22 if short else 0.28, 0.95)
    mix += sine_partial(t, 62, 0.34, 0.42)
    # Inharmonic clang stack.
    partials = [
        (187, 0.18, 0.38),
        (311, 0.16, 0.28),
        (523, 0.22, 0.22),
        (787, 0.28, 0.16),
        (1049, 0.20, 0.12),
        (1571, 0.16, 0.09),
        (2347, 0.12, 0.07),
        (3521, 0.10, 0.05),
        (4980, 0.07, 0.035),
    ]
    for freq, tau, amp in partials:
        tau = tau * (0.45 if short else 1.0)
        mix += sine_partial(t, freq, tau, amp, phase=float(rng.uniform(0, math.pi)))
        # brushed beating
        mix += sine_partial(t, freq * 1.007, tau * 0.9, amp * 0.22)

    scrape = sweep_lp(one_pole_hp(noise(n, rng), 900), 4200, 900)
    scrape *= exp_env(t, 0.055 if short else 0.07) * 0.42
    mix += scrape

    crackle = np.zeros(n)
    density = 90 if short else 160
    for _ in range(density):
        at = rng.integers(int(0.02 * SR), n)
        width = int(rng.uniform(6, 28))
        burst = rng.uniform(-1, 1, width)
        burst *= np.hanning(width)
        end = min(n, at + width)
        crackle[at:end] += burst[: end - at]
    crackle = one_pole_hp(crackle, 2800)
    crackle *= (exp_env(t, 0.18 if short else 0.55) * (0.55 if short else 0.7))
    mix += crackle

    sizzle = one_pole_hp(pinkish(n, rng), 6500) * exp_env(t, 0.22 if short else 0.85) * 0.22
    mix += sizzle

    click = one_pole_hp(noise(int(0.008 * SR), rng), 2000) * np.hanning(int(0.008 * SR)) * 0.55
    place(mix, click, 0.0)

    stereo = stereo_width(mix, rng, delay_ms=5.5)
    return fade(soft_limit(stereo), out_ms=30 if short else 90)


def cinematic(duration: float, short: bool, seed: int = 22) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = time_axis(duration)
    n = len(t)
    mix = np.zeros(n)
    hit = 0.0 if short else 0.36

    if not short:
        whoosh_n = int(hit * SR)
        wt = np.arange(whoosh_n) / SR
        whoosh = sweep_lp(pinkish(whoosh_n, rng), 280, 3800)
        whoosh = one_pole_hp(whoosh, 180)
        rise = (wt / hit) ** 1.6
        mix[:whoosh_n] += whoosh * rise * 0.55
        mix[:whoosh_n] += chirp(wt, 90, 420, 0.22, 0.18) * rise

    body = np.zeros(n)
    ht = t  # we'll place the hit
    thump = chirp(time_axis(0.55), 78, 32, 0.26, 1.0)
    punch = chirp(time_axis(0.18), 210, 92, 0.09, 0.55)
    snap = one_pole_hp(noise(int(0.012 * SR), rng), 1500) * np.hanning(int(0.012 * SR)) * 0.7
    place(body, thump, hit)
    place(body, punch, hit)
    place(body, snap, hit)
    mix += body

    shimmer_t = time_axis(duration - hit)
    shimmer = np.zeros_like(shimmer_t)
    tones = [1568, 1865, 2093, 2349, 2637, 3136, 3729]
    for i, freq in enumerate(tones):
        tau = 0.18 if short else 0.62 + i * 0.03
        shimmer += sine_partial(shimmer_t, freq, tau, 0.08 + (i % 3) * 0.012, phase=i)
        shimmer += sine_partial(shimmer_t, freq * 1.004, tau * 1.1, 0.04)
    sparkle = one_pole_hp(pinkish(len(shimmer_t), rng), 7000) * exp_env(shimmer_t, 0.16 if short else 0.7) * 0.12
    place(mix, shimmer + sparkle, hit)

    stereo = stereo_width(mix, rng, delay_ms=9.0)
    return fade(soft_limit(stereo), in_ms=8 if not short else 2, out_ms=35 if short else 110)


def fightnight(duration: float, short: bool, seed: int = 33) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = time_axis(duration)
    n = len(t)
    mix = np.zeros(n)

    mix += chirp(t, 86, 36, 0.16, 0.95)
    slap = sweep_lp(one_pole_hp(noise(int(0.05 * SR), rng), 250), 2400, 400)
    slap *= np.hanning(len(slap)) * 0.55
    place(mix, slap, 0.0)
    click = one_pole_hp(noise(int(0.006 * SR), rng), 2500) * np.hanning(int(0.006 * SR)) * 0.65
    place(mix, click, 0.0)

    bell_t = time_axis(min(duration, 1.85 if not short else 0.72))
    # Single boxing-bell family (inharmonic, not a scale).
    bell = np.zeros_like(bell_t)
    for freq, tau, amp in [
        (2489, 0.55, 0.42),
        (3729, 0.38, 0.22),
        (1865, 0.42, 0.16),
        (4978, 0.22, 0.10),
        (1244, 0.28, 0.10),
        (7458, 0.12, 0.05),
    ]:
        tau = tau * (0.35 if short else 1.0)
        bell += sine_partial(bell_t, freq, tau, amp)
        bell += sine_partial(bell_t, freq * 1.002, tau * 0.9, amp * 0.25)
    # slow amplitude shimmer on the ding
    bell *= 0.85 + 0.15 * np.sin(2 * math.pi * 6.5 * bell_t)
    place(mix, bell, 0.055)

    if not short:
        crowd = np.zeros(n)
        grains = 70
        for _ in range(grains):
            start = rng.uniform(0.04, 0.42)
            length = rng.uniform(0.08, 0.28)
            g = pinkish(int(length * SR), rng)
            g = one_pole_lp(one_pole_hp(g, 350), 2600)
            g *= np.hanning(len(g)) * rng.uniform(0.04, 0.11)
            place(crowd, g, start)
        crowd *= adsr(n, 0.04, 0.12, 0.55, 0.35, hold=0.12)
        mix += crowd * 0.85
    else:
        pop = one_pole_lp(one_pole_hp(pinkish(int(0.22 * SR), rng), 400), 2400)
        pop *= np.hanning(len(pop)) * 0.22
        place(mix, pop, 0.03)

    stereo = stereo_width(mix, rng, delay_ms=8.0)
    return fade(soft_limit(stereo), out_ms=28 if short else 80)


def render_pair(name: str, builder, unlock_s: float, win_s: float) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = Path("/tmp/svg-sfx")
    tmp.mkdir(exist_ok=True)
    jobs = [
        (f"unlock_{name}", builder(unlock_s, False)),
        (f"win_{name}", builder(win_s, True)),
    ]
    for stem, audio in jobs:
        wav = tmp / f"{stem}.wav"
        mp3 = OUT_DIR / f"{stem}.mp3"
        write_wav(wav, audio)
        encode_mp3(wav, mp3)
        print(f"wrote {mp3} ({audio.shape[0] / SR:.2f}s)")


def main() -> None:
    render_pair("metal", metal, 2.05, 0.78)
    render_pair("cinematic", cinematic, 2.25, 0.82)
    render_pair("fightnight", fightnight, 2.00, 0.80)


if __name__ == "__main__":
    main()

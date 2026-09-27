#!/usr/bin/env python3
"""Original movie-logo-style unlock stingers for SVG Performance.

Not a copy or parody of any trademarked studio sting.
Run from repo root:

    python3 scripts/synth-studio-stings.py
"""

from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48_000
OUT_DIR = Path("public/sfx")
HIT = 0.70  # badge settle + spark burst
CEILING = 10 ** (-1.35 / 20)  # ~ -1.35 dBFS before encode


def t_axis(seconds: float) -> np.ndarray:
    n = int(round(seconds * SR))
    return np.arange(n, dtype=np.float64) / SR


def exp_env(t: np.ndarray, tau: float) -> np.ndarray:
    return np.exp(-t / max(tau, 1e-5))


def place(dest: np.ndarray, src: np.ndarray, at: float) -> None:
    start = int(round(at * SR))
    if start >= dest.shape[0]:
        return
    end = min(dest.shape[0], start + src.shape[0])
    dest[start:end] += src[: end - start]


def one_pole_lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    if cutoff <= 0:
        return np.zeros_like(x)
    a = 1.0 / ((1.0 / (2.0 * math.pi * cutoff)) * SR + 1.0)
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
    cut = np.geomspace(max(start, 20.0), max(end, 20.0), n)
    y = np.empty_like(x)
    acc = 0.0
    for i, sample in enumerate(x):
        a = 1.0 / ((1.0 / (2.0 * math.pi * cut[i])) * SR + 1.0)
        acc += a * (sample - acc)
        y[i] = acc
    return y


def pink(n: int, rng: np.random.Generator) -> np.ndarray:
    white = rng.uniform(-1.0, 1.0, n)
    b0 = b1 = b2 = 0.0
    out = np.empty(n)
    for i, w in enumerate(white):
        b0 = 0.99765 * b0 + w * 0.0990460
        b1 = 0.96300 * b1 + w * 0.2965164
        b2 = 0.57000 * b2 + w * 1.0526913
        out[i] = b0 + b1 + b2 + w * 0.1848
    peak = np.max(np.abs(out)) or 1.0
    return out / peak


def inst_phase(freq: np.ndarray | float, n: int) -> np.ndarray:
    if np.isscalar(freq):
        f = np.full(n, float(freq))
    else:
        f = np.asarray(freq, dtype=np.float64)
        if len(f) != n:
            f = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(f)), f)
    return 2.0 * math.pi * np.cumsum(f) / SR


def sine_glide(n: int, f0: float, f1: float, tau: float, amp: float) -> np.ndarray:
    t = np.arange(n) / SR
    freq = np.geomspace(f0, f1, n)
    return amp * np.sin(inst_phase(freq, n)) * exp_env(t, tau)


def bl_saw(freq: np.ndarray | float, n: int, harmonics: int = 18) -> np.ndarray:
    phase = inst_phase(freq, n)
    y = np.zeros(n)
    for h in range(1, harmonics + 1):
        y += (1.0 / h) * np.sin(phase * h)
    return y * (2.0 / math.pi)


def bl_pulse(freq: np.ndarray | float, n: int, harmonics: int = 14) -> np.ndarray:
    phase = inst_phase(freq, n)
    y = np.zeros(n)
    for h in range(1, harmonics + 1, 2):
        y += (1.0 / h) * np.sin(phase * h)
    return y * (4.0 / math.pi)


def fft_convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)
    return y[: len(x)]


def hall_ir(seconds: float, rt60: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = t_axis(seconds)
    ir = pink(len(t), rng) * np.exp(-6.91 * t / max(rt60, 0.2))
    ir = one_pole_lp(ir, 6200)
    for delay, amp in ((0.017, 0.55), (0.029, 0.38), (0.043, 0.26), (0.061, 0.16), (0.089, 0.10)):
        i = int(delay * SR)
        if i < len(ir):
            ir[i] += amp
    ir[0] = 0.0
    peak = np.max(np.abs(ir)) or 1.0
    return ir / peak


def apply_reverb(mono: np.ndarray, ir: np.ndarray, wet: float) -> np.ndarray:
    wet_sig = fft_convolve(mono, ir)
    return mono * (1.0 - wet) + wet_sig * wet


def phone_weight(mono: np.ndarray, f0: float, tau: float, amp: float = 0.28) -> np.ndarray:
    """Upper harmonics so a sub hit reads on small speakers."""
    n = len(mono)
    t = np.arange(n) / SR
    extra = np.zeros(n)
    for h, a in ((2, 0.55), (3, 0.32), (4, 0.18), (5, 0.10), (6, 0.06)):
        extra += a * np.sin(2 * math.pi * f0 * h * t + h * 0.2) * exp_env(t, tau * (0.7 + 0.08 * h))
    extra = one_pole_lp(extra, 1800)
    return extra * amp


def fade(x: np.ndarray, in_ms: float = 6.0, out_ms: float = 80.0) -> np.ndarray:
    n = x.shape[0]
    fade_in = min(n, int(in_ms * SR / 1000))
    fade_out = min(n, int(out_ms * SR / 1000))
    y = x.copy()
    shape = (-1,) + (1,) * (y.ndim - 1)
    if fade_in:
        y[:fade_in] *= np.linspace(0.0, 1.0, fade_in).reshape(shape)
    if fade_out:
        y[-fade_out:] *= np.linspace(1.0, 0.0, fade_out).reshape(shape)
    return y


def stereoize(mono: np.ndarray, rng: np.random.Generator, delay_ms: float) -> np.ndarray:
    delay = int(delay_ms * SR / 1000)
    right = np.zeros_like(mono)
    if delay > 0:
        right[delay:] = mono[:-delay] * 0.96
        right[:delay] = mono[:delay] * 0.15
    else:
        right = mono.copy()
    haze = one_pole_hp(mono, 2200) * 0.08
    left = mono + haze
    right = right - haze
    return np.stack([left, right], axis=1)


def limit_stereo(x: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(x)) or 1.0
    y = x / peak
    y = np.tanh(y * 1.15) / math.tanh(1.15)
    peak = np.max(np.abs(y)) or 1.0
    return y * (CEILING / peak)


def write_wav(path: Path, stereo: np.ndarray) -> None:
    pcm = np.clip(stereo, -1.0, 1.0)
    ints = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(struct.pack("<" + "h" * ints.size, *ints.reshape(-1)))


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-af",
            "alimiter=limit=0.84:attack=0.8:release=10,volume=-0.75dB",
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


def braam(n: int, f0: float, f1: float, seed: int, amp: float = 0.7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    env = exp_env(t, 0.55) * (1.0 - np.exp(-t / 0.012))
    mix = np.zeros(n)
    ratios = (1.0, 1.012, 0.988, 1.5, 1.498, 2.0, 2.02, 2.98)
    for i, ratio in enumerate(ratios):
        detune = 1.0 + rng.uniform(-0.004, 0.004)
        freq = np.geomspace(f0 * ratio * detune, f1 * ratio * detune, n)
        voice = bl_saw(freq, n, harmonics=12 + (i % 4))
        mix += voice * (0.22 if ratio < 1.2 else 0.14 if ratio < 2.1 else 0.08)
    mix += bl_pulse(np.geomspace(f0 * 0.5, f1 * 0.5, n), n, 8) * 0.18
    driven = np.tanh(mix * 2.4)
    driven = one_pole_lp(driven, 2400)
    return driven * env * amp


def boom_body(n: int) -> np.ndarray:
    sub = sine_glide(n, 78, 31, 0.38, 1.0)
    mid = sine_glide(min(n, int(0.22 * SR)), 190, 86, 0.10, 0.55)
    out = sub
    out[: len(mid)] += mid
    out += phone_weight(sub, 42, 0.32, 0.34)
    return out


def metal_clang(n: int, seed: int, short: bool) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    mix = sine_glide(n, 118, 46, 0.20 if short else 0.26, 0.7)
    partials = [
        (187, 0.16, 0.32),
        (311, 0.14, 0.24),
        (523, 0.20, 0.18),
        (787, 0.24, 0.13),
        (1049, 0.16, 0.09),
        (1571, 0.12, 0.07),
        (2347, 0.09, 0.05),
        (3521, 0.07, 0.035),
    ]
    for freq, tau, amp in partials:
        tau = tau * (0.4 if short else 1.0)
        mix += amp * np.sin(2 * math.pi * freq * t + rng.uniform(0, math.pi)) * exp_env(t, tau)
        mix += amp * 0.2 * np.sin(2 * math.pi * freq * 1.007 * t) * exp_env(t, tau * 0.9)
    scrape = sweep_lp(one_pole_hp(rng.uniform(-1, 1, n), 900), 4000, 800)
    scrape *= exp_env(t, 0.05 if short else 0.065) * 0.32
    mix += scrape
    click_n = int(0.008 * SR)
    click = one_pole_hp(rng.uniform(-1, 1, click_n), 2000) * np.hanning(click_n) * 0.5
    mix[:click_n] += click
    return mix


def riser(n: int, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    whoosh = sweep_lp(pink(n, rng), 160, 4200)
    whoosh = one_pole_hp(whoosh, 120)
    rise = (t / max(t[-1], 1e-6)) ** 1.55
    tone = sine_glide(n, 48, 160, 0.9, 0.22) * rise
    return whoosh * rise * 1.15 + tone * 1.35


def studio1_boom(duration: float, short: bool, seed: int = 101) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(round(duration * SR))
    mix = np.zeros(n)
    hit = 0.0 if short else HIT

    if not short:
        rise_n = int(hit * SR)
        place(mix, riser(rise_n, rng) * 4.2, 0.0)
        swell = sine_glide(rise_n, 36, 64, 1.2, 1.6)
        swell *= np.linspace(0.4, 1.0, rise_n)
        mix[:rise_n] += swell
        mix[:rise_n] += braam(rise_n, 48, 70, seed + 1, amp=0.85) * np.linspace(0.15, 1.0, rise_n)

    body_n = int((0.95 if short else 2.4) * SR)
    body_n = min(body_n, n - int(hit * SR))
    boom = boom_body(body_n)
    br = braam(body_n, 62, 41, seed + 3, amp=0.62 if short else 0.78)
    click_n = int(0.014 * SR)
    click = one_pole_hp(rng.uniform(-1, 1, click_n), 1800) * np.hanning(click_n) * 0.62
    impact = boom + br
    impact[:click_n] += click
    if not short:
        impact = apply_reverb(impact, hall_ir(2.1, 2.6, seed + 9), wet=0.42)
    else:
        impact = apply_reverb(impact, hall_ir(0.55, 0.7, seed + 9), wet=0.22)
    place(mix, impact, hit)

    stereo = stereoize(mix, rng, 11.0)
    return fade(limit_stereo(stereo), in_ms=10 if not short else 2, out_ms=40 if short else 140)


def brass_chord(n: int, freqs: tuple[float, ...], attack: float, hold: float) -> np.ndarray:
    t = np.arange(n) / SR
    env = np.ones(n)
    a = int(attack * SR)
    if a:
        env[:a] = np.linspace(0.0, 1.0, a)
    env *= exp_env(np.maximum(t - hold, 0), 0.55)
    brass = np.zeros(n)
    strings = np.zeros(n)
    for i, f0 in enumerate(freqs):
        glide = np.linspace(f0 * 0.985, f0, n)
        b = 0.55 * bl_saw(glide, n, 16) + 0.35 * bl_pulse(glide * 1.002, n, 10)
        s = 0.5 * bl_saw(glide * 1.006, n, 20) + 0.5 * bl_saw(glide * 0.994, n, 20)
        brass += b * (0.22 if i else 0.28)
        strings += s * 0.16
    brass = one_pole_lp(brass, 1800)
    strings = one_pole_lp(one_pole_hp(strings, 280), 3200)
    return (brass + strings) * env


def studio2_brass(duration: float, short: bool, seed: int = 202) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(round(duration * SR))
    mix = np.zeros(n)
    hit = 0.0 if short else HIT

    # Original voicing: stacked fifths resolving to a bright triad. Not a fanfare line.
    swell_freqs = (98.0, 146.8, 196.0, 293.7)  # G2 G3 D4
    resolve_freqs = (98.0, 123.5, 196.0, 246.9, 392.0)  # G2 + B2 + G3 + B3 + G4

    if not short:
        swell_n = int(hit * SR)
        swell = brass_chord(swell_n, swell_freqs, attack=0.16, hold=0.55)
        swell *= np.linspace(0.45, 1.0, swell_n)
        mix[:swell_n] += swell * 4.8
        mix[:swell_n] += sine_glide(swell_n, 49, 62, 1.1, 1.1) * np.linspace(0.4, 1.0, swell_n)

    res_n = int((0.9 if short else 2.3) * SR)
    res_n = min(res_n, n - int(hit * SR))
    resolve = brass_chord(res_n, resolve_freqs, attack=0.012, hold=0.18 if short else 0.35)
    resolve += boom_body(res_n) * 0.55
    resolve += phone_weight(resolve, 49, 0.28, 0.22)
    click_n = int(0.011 * SR)
    resolve[:click_n] += one_pole_hp(rng.uniform(-1, 1, click_n), 1600) * np.hanning(click_n) * 0.45
    if not short:
        resolve = apply_reverb(resolve, hall_ir(2.2, 2.8, seed + 4), wet=0.48)
    else:
        resolve = apply_reverb(resolve, hall_ir(0.5, 0.65, seed + 4), wet=0.24)
    place(mix, resolve, hit)

    stereo = stereoize(mix, rng, 13.0)
    return fade(limit_stereo(stereo), in_ms=12 if not short else 2, out_ms=36 if short else 150)


def shimmer(n: int, seed: int, short: bool) -> np.ndarray:
    t = np.arange(n) / SR
    y = np.zeros(n)
    tones = (1865, 2093, 2489, 2794, 3136, 3729, 4186)
    for i, freq in enumerate(tones):
        tau = 0.16 if short else 0.72 + i * 0.03
        y += 0.07 * np.sin(2 * math.pi * freq * t + i) * exp_env(t, tau)
        y += 0.035 * np.sin(2 * math.pi * freq * 1.004 * t) * exp_env(t, tau * 1.1)
    rng = np.random.default_rng(seed)
    y += one_pole_hp(pink(n, rng), 7200) * exp_env(t, 0.18 if short else 0.8) * 0.1
    return y


def studio3_metal_braam(duration: float, short: bool, seed: int = 303) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(round(duration * SR))
    mix = np.zeros(n)
    hit = 0.0 if short else HIT

    if not short:
        rise_n = int(hit * SR)
        place(mix, riser(rise_n, rng) * 4.5, 0.0)
        mix[:rise_n] += sine_glide(rise_n, 40, 58, 1.1, 1.4) * np.linspace(0.35, 1.0, rise_n)
        mix[:rise_n] += braam(rise_n, 46, 62, seed + 5, amp=0.7) * np.linspace(0.1, 0.9, rise_n)

    body_n = int((0.92 if short else 2.5) * SR)
    body_n = min(body_n, n - int(hit * SR))
    clang = metal_clang(body_n, seed + 1, short)
    br = braam(body_n, 58, 38, seed + 7, amp=0.7)
    sub = boom_body(body_n)
    layer = clang * 0.72 + br * 0.7 + sub * 0.85
    layer += shimmer(body_n, seed + 8, short)
    if not short:
        layer = apply_reverb(layer, hall_ir(2.0, 2.4, seed + 2), wet=0.36)
    else:
        layer = apply_reverb(layer, hall_ir(0.48, 0.6, seed + 2), wet=0.2)
    place(mix, layer, hit)

    stereo = stereoize(mix, rng, 9.0)
    return fade(limit_stereo(stereo), in_ms=8 if not short else 2, out_ms=38 if short else 130)


def render(name: str, builder, unlock_s: float, win_s: float) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = Path("/tmp/svg-studio-sfx")
    tmp.mkdir(exist_ok=True)
    for stem, audio in ((f"unlock_{name}", builder(unlock_s, False)), (f"win_{name}", builder(win_s, True))):
        wav = tmp / f"{stem}.wav"
        mp3 = OUT_DIR / f"{stem}.mp3"
        write_wav(wav, audio)
        encode_mp3(wav, mp3)
        print(f"wrote {mp3} ({audio.shape[0] / SR:.2f}s)")


def main() -> None:
    render("studio1_boom", studio1_boom, 3.25, 0.88)
    render("studio2_brass", studio2_brass, 3.20, 0.86)
    render("studio3_metal_braam", studio3_metal_braam, 3.35, 0.90)


if __name__ == "__main__":
    main()

/** Calm, short speech. No-ops when the browser has no speech synthesis. */

export function speakMobilityLine(line: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(line);
  utter.rate = 0.92;
  utter.pitch = 1;
  utter.lang = "en-US";
  const voices = synth.getVoices();
  const voice =
    voices.find((item) => item.lang === "en-US" && /natural|samantha|google/i.test(item.name)) ??
    voices.find((item) => item.lang.toLowerCase().startsWith("en"));
  if (voice) utter.voice = voice;
  synth.speak(utter);
}

export function stopMobilityVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

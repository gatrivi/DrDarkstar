// Frequency bands use Hz, so their meaning survives different sample rates.
export function bandLevel(data, sampleRate, fftSize, low, high) {
  const start = Math.max(1, Math.ceil(low * fftSize / sampleRate));
  const end = Math.min(data.length, Math.ceil(high * fftSize / sampleRate));
  let total = 0;
  for (let i = start; i < end; i++) total += (data[i] / 255) ** 2;
  return end > start ? Math.sqrt(total / (end - start)) : 0;
}

export class AudioField {
  constructor(media) {
    this.media = media;
    this.levels = { bass: 0, mid: 0, treble: 0, effect: 0 };
    this.demoTimer = null;
    this.voices = new Set();
  }

  async enable() {
    if (!this.context) {
      const context = this.context = new AudioContext();
      this.music = context.createGain();
      this.effects = context.createGain();
      this.mix = context.createGain();
      this.mix.gain.value = 0.6;
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.65;
      this.effectAnalyser = context.createAnalyser();
      this.effectAnalyser.fftSize = 256;
      this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
      this.effectWave = new Float32Array(this.effectAnalyser.fftSize);
      context.createMediaElementSource(this.media).connect(this.music);
      this.music.connect(this.mix);
      this.effects.connect(this.effectAnalyser);
      this.effectAnalyser.connect(this.mix);
      this.mix.connect(this.analyser);
      this.analyser.connect(context.destination);
    }
    await this.context.resume();
  }

  // `when` is an absolute AudioContext time for sample-accurate scheduling;
  // omit it to start immediately (existing callers unchanged).
  tone(frequency, duration, volume, bus, type = 'sine', endFrequency = frequency, when = null) {
    const now = when ?? this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope); envelope.connect(bus);
    const voice = { oscillator, envelope, bus };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
    oscillator.start(now); oscillator.stop(now + duration + 0.02);
  }

  async pulse() {
    await this.enable();
    if (this.context.currentTime - (this.lastPulse ?? -1) < 0.12) return;
    this.lastPulse = this.context.currentTime;
    this.tone(170, 0.55, 0.6, this.effects, 'sine', 38);
    this.tone(1800, 0.18, 0.12, this.effects, 'triangle', 260);
  }

  async startDemo() {
    await this.enable();
    if (this.demoTimer !== null) return;
    this.media.pause();
    let step = 0;
    const notes = [220, 261.63, 329.63, 293.66, 220, 196, 164.81, 196];
    const tick = () => {
      this.tone(notes[step % notes.length], 0.65, 0.12, this.music, 'triangle');
      if (step % 2 === 0) this.tone(100, 0.3, 0.45, this.music, 'sine', 45);
      this.tone(2400, 0.06, 0.04, this.music, 'triangle');
      step++;
    };
    tick();
    this.demoTimer = setInterval(tick, 360);
  }

  stopDemo() {
    clearInterval(this.demoTimer);
    this.demoTimer = null;
    for (const voice of this.voices) {
      if (voice.bus === this.music) voice.oscillator.stop();
    }
  }

  update(delta) {
    const target = { bass: 0, mid: 0, treble: 0, effect: 0 };
    if (this.context?.state === 'running') {
      this.analyser.getByteFrequencyData(this.spectrum);
      const rate = this.context.sampleRate;
      target.bass = bandLevel(this.spectrum, rate, 2048, 40, 250);
      target.mid = bandLevel(this.spectrum, rate, 2048, 250, 2000);
      target.treble = bandLevel(this.spectrum, rate, 2048, 2000, 12000);
      this.effectAnalyser.getFloatTimeDomainData(this.effectWave);
      let squares = 0;
      for (const sample of this.effectWave) squares += sample * sample;
      target.effect = Math.min(1, Math.sqrt(squares / this.effectWave.length) * 5);
    }
    for (const key of Object.keys(target)) {
      const rate = target[key] > this.levels[key] ? 24 : 5;
      this.levels[key] += (target[key] - this.levels[key]) * (1 - Math.exp(-delta * rate));
    }
    return this.levels;
  }
}

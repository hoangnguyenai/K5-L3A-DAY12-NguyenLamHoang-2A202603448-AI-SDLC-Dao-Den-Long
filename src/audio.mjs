const effects = {
  mote_picked: [880, 1175],
  lantern_lit: [440, 554, 659, 880],
  pulse: [220, 440, 880],
  player_hit: [165, 110],
  jump: [330, 494],
  dash: [294, 587],
  won: [523, 659, 784, 1047],
  lost: [330, 294, 220],
  shade_spawned: [110, 131],
  countdown: [660],
  wind: [196, 247, 294],
};

export class GameAudio {
  constructor() {
    this.volume = 0.35;
    this.playing = false;
    this.noteIndex = 0;
    this.nextNote = 0;
  }

  unlock() {
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      this.context.resume().catch(() => {});
    } catch {
      // Trò chơi vẫn chạy nếu thiết bị âm thanh không khả dụng.
    }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master) this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.03);
  }

  tone(frequency, delay, duration, amplitude, type = 'sine') {
    if (!this.master || this.context.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(amplitude, start + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  effect(name) {
    for (const [index, frequency] of (effects[name] ?? []).entries()) {
      this.tone(frequency, index * 0.075, 0.3, 0.16, name === 'player_hit' ? 'triangle' : 'sine');
    }
  }

  update(now) {
    if (!this.playing || !this.master || now < this.nextNote) return;
    const melody = [220, 330, 440, 392, 294, 330, 196, 294];
    this.tone(melody[this.noteIndex++ % melody.length], 0, 1.8, 0.09);
    this.nextNote = now + 1300;
  }
}

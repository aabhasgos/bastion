// Advanced Web Audio API Synthesizer for BASTION
// Produces punchy, visceral sci-fi RTS audio with multi-oscillator synthesis and zero asset dependencies.

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  constructor() {
    // AudioContext lazily initialized on user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();

        // Master Compressor to prevent distortion and give huge cinematic punch
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public playSelect() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  public playUnitDeploy() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // Harmonic warp-in resonance
    const freqs = [320, 480, 640];
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.compressor) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 2.2, this.ctx.currentTime + 0.18 + idx * 0.03);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18 + idx * 0.03);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    });
  }

  public playLaserShot(pitch: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // FM Synthesis for snappy laser beam
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const baseFreq = 950 * pitch;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80 * pitch, this.ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  public playSniperShot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // High velocity kinetic crack + whip
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  public playArtilleryShot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // Concussive mortar launch thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  public playHeavyCannon() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // Sub-bass heavy tank cannon with dual blast
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  public playExplosion(intensity: 'small' | 'large' = 'small') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const duration = intensity === 'large' ? 0.7 : 0.35;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Dual-stage filter for concussive shockwave
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(intensity === 'large' ? 600 : 900, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    // Deep sub-bass underlay
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(intensity === 'large' ? 70 : 100, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + duration * 0.8);

    subGain.gain.setValueAtTime(intensity === 'large' ? 0.6 : 0.3, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration * 0.8);

    subOsc.connect(subGain);
    subGain.connect(this.compressor);
    subOsc.start();
    subOsc.stop(this.ctx.currentTime + duration * 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity === 'large' ? 0.6 : 0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start();
  }

  public playAlarm() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, this.ctx.currentTime);
    osc.frequency.setValueAtTime(460, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  public playCountdownTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.07);
  }

  public playBattleStart() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    // Resonant battle start klaxon
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((freq) => {
      if (!this.ctx || !this.compressor) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.7);
    });
  }

  public playVictoryFanfare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(this.ctx.currentTime + i * 0.12);
      osc.stop(this.ctx.currentTime + i * 0.12 + 0.4);
    });
  }

  public playDefeat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.compressor) return;

    const notes = [440, 415.3, 369.99, 311.13];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.16);

      gain.gain.setValueAtTime(0.28, this.ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.16 + 0.45);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(this.ctx.currentTime + i * 0.16);
      osc.stop(this.ctx.currentTime + i * 0.16 + 0.45);
    });
  }
}

export const soundManager = new SoundEffectsService();

// All sound is synthesized with WebAudio — wind, spells, doors, the Dementor drone.
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneGain = null;
    this.muted = false;
  }

  // Must be called from a user gesture (autoplay policy).
  start() {
    if (this.ctx || this.muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.muted = true; return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      this._wind();
      this._drone();
    } catch (e) {
      this.muted = true;
      this.ctx = null;
    }
  }

  get ok() { return !!this.ctx && this.ctx.state === 'running'; }

  _noise(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _wind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(3);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
  }

  _drone() {
    // Dementor proximity drone, silent until fed a level.
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(3);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 110;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 36;
    const oscG = this.ctx.createGain();
    oscG.gain.value = 0.5;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0;
    src.connect(lp).connect(this.droneGain);
    osc.connect(oscG).connect(this.droneGain);
    this.droneGain.connect(this.master);
    src.start();
    osc.start();
  }

  dementor(level) {
    if (!this.ok || !this.droneGain) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(Math.min(1, level) * 0.5, t, 0.25);
  }

  _env(node, t0, attack, peak, decay) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  whoosh() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(0.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.28);
    const g = this.ctx.createGain();
    this._env(g, t, 0.02, 0.22, 0.26);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.4);
  }

  lumos() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [880, 1318, 1760].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.9, t + i * 0.05);
      o.frequency.exponentialRampToValueAtTime(f, t + i * 0.05 + 0.12);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.05, 0.02, 0.1, 0.5);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.05);
      o.stop(t + i * 0.05 + 0.6);
    });
  }

  nox() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    const g = this.ctx.createGain();
    this._env(g, t, 0.01, 0.12, 0.24);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  locked() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 110;
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.3, 0.13);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }

  unlock() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [0, 0.09, 0.19].forEach((dt, i) => { // tumblers
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 1900 + i * 500;
      const g = this.ctx.createGain();
      this._env(g, t + dt, 0.002, 0.08, 0.05);
      o.connect(g).connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 0.07);
    });
    this.creak(0.35);
  }

  creak(delay = 0) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(88, t);
    o.frequency.linearRampToValueAtTime(56, t + 0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    this._env(g, t, 0.06, 0.075, 0.75);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.9);
  }

  sparkle() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1500 + Math.random() * 2500;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.04, 0.005, 0.05, 0.18);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.04);
      o.stop(t + i * 0.04 + 0.2);
    }
  }

  patronus() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => {
      [0, 3].forEach((det) => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = det;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.5);
        g.gain.setValueAtTime(0.045, t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 3.2);
      });
    });
    const src = this.ctx.createBufferSource(); // airy shimmer
    src.buffer = this._noise(3);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 3.1);
  }

  incendio() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    // whoomp of ignition
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(0.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.45);
    const g = this.ctx.createGain();
    this._env(g, t, 0.03, 0.3, 0.5);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.6);
    // crackles
    for (let i = 0; i < 6; i++) {
      const c = this.ctx.createBufferSource();
      c.buffer = this._noise(0.05);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500 + Math.random() * 2500;
      const cg = this.ctx.createGain();
      const dt = 0.15 + Math.random() * 0.55;
      this._env(cg, t + dt, 0.003, 0.08, 0.05);
      c.connect(hp).connect(cg).connect(this.master);
      c.start(t + dt);
      c.stop(t + dt + 0.07);
    }
  }

  aguamenti() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    // water rush
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise(0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.55);
    const g = this.ctx.createGain();
    this._env(g, t, 0.04, 0.26, 0.6);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.7);
    // steam hiss
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this._noise(0.5);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const hg = this.ctx.createGain();
    this._env(hg, t + 0.2, 0.05, 0.12, 0.4);
    hiss.connect(hp).connect(hg).connect(this.master);
    hiss.start(t + 0.2);
    hiss.stop(t + 0.75);
    // drips
    for (let i = 0; i < 4; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const f = 500 + Math.random() * 600;
      const dt = 0.3 + Math.random() * 0.5;
      o.frequency.setValueAtTime(f, t + dt);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dt + 0.08);
      const og = this.ctx.createGain();
      this._env(og, t + dt, 0.004, 0.06, 0.09);
      o.connect(og).connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 0.12);
    }
  }

  banish() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.9);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.03, 0.16, 0.9);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1);
  }

  faint() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 1.4);
    const g = this.ctx.createGain();
    this._env(g, t, 0.05, 0.4, 1.5);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.6);
  }

  chime() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [1046.5, 1318.5].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.12, 0.01, 0.09, 0.7);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.8);
    });
  }
}

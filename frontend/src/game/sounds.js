// Synthetic sound effects via Web Audio API. No external assets.
let audioCtx = null;
let enabled = true;

const ensureCtx = () => {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
};

export const setSoundEnabled = (v) => {
  enabled = !!v;
};

export const isSoundEnabled = () => enabled;

const playTone = ({
  freq = 440,
  type = "sine",
  duration = 0.15,
  volume = 0.15,
  freqEnd = null,
  delay = 0,
}) => {
  if (!enabled) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

const playNoise = ({ duration = 0.2, volume = 0.12, filterFreq = 1200 }) => {
  if (!enabled) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
};

export const sounds = {
  bowDraw: () => playTone({ freq: 180, freqEnd: 90, type: "sawtooth", duration: 0.25, volume: 0.08 }),
  arrowShoot: () => {
    playTone({ freq: 800, freqEnd: 200, type: "triangle", duration: 0.12, volume: 0.12 });
    playNoise({ duration: 0.08, volume: 0.06, filterFreq: 3000 });
  },
  hit: () => {
    playTone({ freq: 600, freqEnd: 900, type: "square", duration: 0.08, volume: 0.1 });
    playTone({ freq: 1200, type: "sine", duration: 0.1, volume: 0.08, delay: 0.04 });
  },
  pop: () => {
    playTone({ freq: 220, freqEnd: 1400, type: "sine", duration: 0.15, volume: 0.14 });
  },
  miss: () => playTone({ freq: 120, freqEnd: 60, type: "sawtooth", duration: 0.2, volume: 0.08 }),
  powerUp: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      playTone({ freq: f, type: "triangle", duration: 0.12, volume: 0.12, delay: i * 0.06 })
    );
  },
  levelUp: () => {
    [392, 523, 659, 784, 988].forEach((f, i) =>
      playTone({ freq: f, type: "square", duration: 0.14, volume: 0.1, delay: i * 0.08 })
    );
  },
  gameOver: () => {
    [440, 349, 277, 220].forEach((f, i) =>
      playTone({ freq: f, type: "sawtooth", duration: 0.25, volume: 0.12, delay: i * 0.15 })
    );
  },
  explosion: () => {
    playNoise({ duration: 0.35, volume: 0.18, filterFreq: 800 });
    playTone({ freq: 80, freqEnd: 40, type: "sawtooth", duration: 0.3, volume: 0.14 });
  },
  click: () => playTone({ freq: 600, type: "square", duration: 0.04, volume: 0.06 }),
  laserCharge: () => {
    // Rising 3-tone whine over ~3 seconds with metallic timbre
    [220, 330, 440, 580, 720, 900, 1100, 1400].forEach((f, i) =>
      playTone({ freq: f, type: "sawtooth", duration: 0.42, volume: 0.06, delay: i * 0.36 })
    );
    [110, 165].forEach((f, i) =>
      playTone({ freq: f, type: "sine", duration: 2.6, volume: 0.04, delay: i * 0.05 })
    );
  },
};

export const initAudio = () => ensureCtx();

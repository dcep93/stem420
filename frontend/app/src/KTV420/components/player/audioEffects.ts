export type AudioEffectType =
  | "wah"
  | "bass-boost"
  | "bright"
  | "warm"
  | "telephone"
  | "lofi"
  | "submerge"
  | "delay-pedal"
  | "chorus"
  | "reverb"
  | "envelope-filter"
  | "flange"
  | "phaser"
  | "tilt-eq"
  | "band-emphasis"
  | "saturation"
  | "formant-filter"
  | "pitch-shift";

export type AudioEffectOption = {
  value: AudioEffectType;
  label: string;
  description: string;
};

export const audioEffectOptions: AudioEffectOption[] = [
  {
    value: "wah",
    label: "Wah",
    description:
      "Expressive filter sweep that pushes mids as you move the control, adding vocal-like resonance. The edges push harder for a dramatic edge, while the center keeps the tone grounded and smooth.",
  },
  {
    value: "bass-boost",
    label: "Bass Boost",
    description:
      "Adds weight and thump by lifting the low shelf without smothering clarity. Use lower intensities for subtle fullness, or push it harder for chesty, club-ready lows and punch.",
  },
  {
    value: "bright",
    label: "Bright",
    description:
      "Opens the top end with a crisp high-shelf lift, adding air and shimmer. Keep it low for clarity, or crank it to spotlight pick attack and sparkle.",
  },
  {
    value: "warm",
    label: "Warm",
    description:
      "Smooths the harsh edges with a gentle low-pass tilt, keeping the body intact. Ideal for taming brittle recordings while preserving midrange presence and depth.",
  },
  {
    value: "telephone",
    label: "Telephone",
    description:
      "Narrow bandpass focus that mimics a telephone mic. It emphasizes the midrange bark, trims lows and highs, and instantly creates a lo-fi, boxy presence.",
  },
  {
    value: "lofi",
    label: "Lo-Fi",
    description:
      "Softens the top end and narrows detail for a nostalgic, tape-like feel. Use the slider to trade clarity for vibe, landing on a cozy, rounded tone.",
  },
  {
    value: "submerge",
    label: "Submerge",
    description:
      "Creates an underwater haze by rolling off highs and thickening the low mids. The effect grows murkier as you turn it up, perfect for dreamy swells.",
  },
  {
    value: "delay-pedal",
    label: "Delay Pedal",
    description:
      "A slapback-style echo that repeats your signal with controllable depth. Dial it in for rhythmic space, or push further for cascading, atmospheric trails behind the dry sound.",
  },
  {
    value: "chorus",
    label: "Chorus",
    description:
      "Wide, detuned doubles that smear into a shimmering ensemble. Keep it near the center for barely-there width, or push the edges for seasick, swirling layers.",
  },
  {
    value: "reverb",
    label: "Reverb",
    description:
      "A roomy, tail-heavy wash that expands depth and space. Subtle settings add ambience, while extreme values bloom into cavernous, cinematic echoes.",
  },
  {
    value: "envelope-filter",
    label: "Envelope Filter",
    description:
      "Auto-wah style sweep that responds to the intensity setting. It highlights a moving mid band, giving funk-style quack and dynamic phrasing without manual pedal movement.",
  },
  {
    value: "flange",
    label: "Flange",
    description:
      "Short delay modulation that adds swirling comb-filter motion. Lower values deliver subtle shimmer, while higher settings exaggerate the whoosh for jet-like, animated textures.",
  },
  {
    value: "phaser",
    label: "Phaser",
    description:
      "Phase-shifted notches sweep across the spectrum for a smooth, liquid pulse. Keep it gentle for movement, or push it for classic psychedelic swoops and swirl.",
  },
  {
    value: "tilt-eq",
    label: "Tilt EQ",
    description:
      "A single-knob tone balance that brightens or darkens across the spectrum. Slide left for warmth and right for clarity, shaping the overall character quickly and musically.",
  },
  {
    value: "band-emphasis",
    label: "Band Emphasis",
    description:
      "Highlights a tunable frequency band with a tight peak. It can spotlight presence, add bite, or carve a signature midrange focus while leaving surrounding frequencies intact.",
  },
  {
    value: "saturation",
    label: "Saturation",
    description:
      "Adds harmonic drive and gentle grit without losing punch. Use it lightly for analog warmth or turn it up for thicker, more aggressive presence with soft clipping.",
  },
  {
    value: "formant-filter",
    label: "Formant Filter",
    description:
      "Vowel-like resonances shape the tone into a vocalized texture. The intensity shifts the formant focus, adding character and a talking quality to synths or guitars.",
  },
  {
    value: "pitch-shift",
    label: "Pitch Shift",
    description:
      "Shifts pitch from low to high without altering chords analysis. Move left for a deeper drop, or push right for brighter, lifted harmonics.",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothAbs = (value: number, epsilon = 1e-4) =>
  Math.sqrt(value * value + epsilon);

const BIPOLAR_EFFECTS = new Set<AudioEffectType>([
  "wah",
  "bass-boost",
  "bright",
  "lofi",
  "tilt-eq",
  "pitch-shift",
]);

export const getDefaultEffectValue = (effect: AudioEffectType) =>
  BIPOLAR_EFFECTS.has(effect) ? 0.5 : 0;

const getEffectShape = (value: number, isBipolar: boolean) => {
  const normalized = clamp(value, 0, 1);
  const centered = normalized - 0.5;

  if (!isBipolar) {
    return {
      normalized,
      centered,
      direction: normalized,
      intensity: normalized,
    };
  }

  const positive = Math.pow(clamp(centered, 0, 0.5) / 0.5, 0.65);
  const negative = Math.pow(clamp(-centered, 0, 0.5) / 0.5, 0.85);
  const direction = centered >= 0 ? positive : -negative;
  const intensity = centered >= 0 ? positive : negative;

  return { normalized, centered, direction, intensity };
};

const getMixFromIntensity = (intensity: number, wetMax = 0.9, dryMin = 0.2) => {
  const wetMix = intensity * wetMax;
  const dryMix = 1 - intensity * (1 - dryMin);

  return { wetMix, dryMix };
};

export type EffectNodes = {
  filter: BiquadFilterNode;
  wetGain: GainNode;
  dryGain: GainNode;
  delay: DelayNode;
  feedbackGain: GainNode;
  shaper: WaveShaperNode;
  convolver: ConvolverNode;
  pitchShifter: PitchShiftNode;
  lfo: OscillatorNode;
  delayLfoGain: GainNode;
  filterLfoGain: GainNode;
};

type EffectParams = {
  context: AudioContext;
  nodes: EffectNodes;
  effect: AudioEffectType;
  value: number;
};

export const PITCH_SHIFT_MAX_SEMITONES = 12;

export const getPitchShiftPlaybackRate = (value: number) => {
  const normalized = clamp(value, 0, 1);
  const centered = normalized - 0.5;
  const semitones = centered * 2 * PITCH_SHIFT_MAX_SEMITONES;
  return Math.pow(2, semitones / 12);
};

const createSaturationCurve = (amount: number) => {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const intensity = clamp(amount, 0, 1) * 8;
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (intensity === 0) {
      curve[i] = x;
    } else {
      curve[i] =
        ((3 + intensity) * x * 20 * deg) / (Math.PI + intensity * Math.abs(x));
    }
  }

  return curve;
};

const createNeutralImpulse = (context: AudioContext) => {
  const buffer = context.createBuffer(2, 1, context.sampleRate);
  buffer.getChannelData(0)[0] = 1;
  buffer.getChannelData(1)[0] = 1;
  return buffer;
};

const createReverbImpulse = (
  context: AudioContext,
  duration: number,
  decay: number
) => {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);

    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const envelope = Math.pow(1 - t, decay);
      const noiseSeed = Math.sin((i + channel * 17) * 12.9898) * 43758.5453;
      const noise = noiseSeed - Math.floor(noiseSeed);
      channelData[i] = (noise * 2 - 1) * envelope;
    }
  }

  return impulse;
};

type PitchShiftNode = ScriptProcessorNode & {
  pitchRatio: number;
  bufferL: Float32Array;
  bufferR: Float32Array;
  ringBufferSize: number;
  writeIndex: number;
  readIndex: number;
};

const createPitchShiftNode = (context: AudioContext): PitchShiftNode => {
  const node = context.createScriptProcessor(1024, 2, 2) as PitchShiftNode;
  const ringBufferSize = 8192;

  node.ringBufferSize = ringBufferSize;
  node.bufferL = new Float32Array(ringBufferSize);
  node.bufferR = new Float32Array(ringBufferSize);
  node.writeIndex = Math.floor(ringBufferSize / 2);
  node.readIndex = 0;
  node.pitchRatio = 1;

  node.onaudioprocess = (event) => {
    const input = event.inputBuffer;
    const output = event.outputBuffer;
    const inputL = input.getChannelData(0);
    const inputR =
      input.numberOfChannels > 1 ? input.getChannelData(1) : inputL;
    const outputL = output.getChannelData(0);
    const outputR =
      output.numberOfChannels > 1 ? output.getChannelData(1) : outputL;

    for (let i = 0; i < inputL.length; i += 1) {
      node.bufferL[node.writeIndex] = inputL[i] ?? 0;
      node.bufferR[node.writeIndex] = inputR[i] ?? inputL[i] ?? 0;

      const readIndexInt = Math.floor(node.readIndex);
      const readIndexNext = (readIndexInt + 1) % node.ringBufferSize;
      const frac = node.readIndex - readIndexInt;
      const sampleL =
        node.bufferL[readIndexInt]! * (1 - frac) +
        node.bufferL[readIndexNext]! * frac;
      const sampleR =
        node.bufferR[readIndexInt]! * (1 - frac) +
        node.bufferR[readIndexNext]! * frac;

      outputL[i] = sampleL;
      outputR[i] = sampleR;

      node.writeIndex = (node.writeIndex + 1) % node.ringBufferSize;
      node.readIndex = (node.readIndex + node.pitchRatio) % node.ringBufferSize;

      if (node.writeIndex === Math.floor(node.readIndex)) {
        node.readIndex =
          (node.writeIndex + node.ringBufferSize / 2) % node.ringBufferSize;
      }
    }
  };

  return node;
};

const setWetRouting = (nodes: EffectNodes, useConvolver: boolean) => {
  nodes.shaper.disconnect();
  nodes.convolver.disconnect();
  nodes.pitchShifter.disconnect();

  if (useConvolver) {
    nodes.shaper.connect(nodes.convolver);
    nodes.convolver.connect(nodes.wetGain);
  } else if (nodes.pitchShifter.pitchRatio !== 1) {
    nodes.shaper.connect(nodes.pitchShifter);
    nodes.pitchShifter.connect(nodes.wetGain);
  } else {
    nodes.shaper.connect(nodes.wetGain);
  }
};

export const createEffectNodes = (context: AudioContext): EffectNodes => {
  const filter = context.createBiquadFilter();
  const wetGain = context.createGain();
  const dryGain = context.createGain();
  const delay = context.createDelay(1);
  const feedbackGain = context.createGain();
  const shaper = context.createWaveShaper();
  const convolver = context.createConvolver();
  const pitchShifter = createPitchShiftNode(context);
  const lfo = context.createOscillator();
  const delayLfoGain = context.createGain();
  const filterLfoGain = context.createGain();

  filter.type = "bandpass";
  filter.Q.value = 3;
  wetGain.gain.value = 0;
  dryGain.gain.value = 1;
  delay.delayTime.value = 0;
  feedbackGain.gain.value = 0;
  shaper.curve = createSaturationCurve(0);
  shaper.oversample = "2x";
  convolver.buffer = createNeutralImpulse(context);
  lfo.frequency.value = 0.4;
  delayLfoGain.gain.value = 0;
  filterLfoGain.gain.value = 0;

  delay.connect(feedbackGain);
  feedbackGain.connect(delay);
  delay.connect(shaper);
  shaper.connect(wetGain);

  lfo.connect(delayLfoGain);
  delayLfoGain.connect(delay.delayTime);
  lfo.connect(filterLfoGain);
  filterLfoGain.connect(filter.frequency);
  lfo.start();

  return {
    filter,
    wetGain,
    dryGain,
    delay,
    feedbackGain,
    shaper,
    convolver,
    pitchShifter,
    lfo,
    delayLfoGain,
    filterLfoGain,
  };
};

export const applyAudioEffect = ({
  context,
  nodes,
  effect,
  value,
}: EffectParams) => {
  const { normalized, direction, intensity, centered } = getEffectShape(
    value,
    BIPOLAR_EFFECTS.has(effect)
  );
  const now = context.currentTime;

  const setMix = (wetMix: number, dryMix: number) => {
    nodes.wetGain.gain.setTargetAtTime(wetMix, now, 0.01);
    nodes.dryGain.gain.setTargetAtTime(dryMix, now, 0.01);
  };

  const resetModulation = () => {
    nodes.delay.delayTime.setTargetAtTime(0, now, 0.01);
    nodes.feedbackGain.gain.setTargetAtTime(0, now, 0.01);
    nodes.delayLfoGain.gain.setTargetAtTime(0, now, 0.01);
    nodes.filterLfoGain.gain.setTargetAtTime(0, now, 0.01);
    nodes.shaper.curve = createSaturationCurve(0);
    nodes.convolver.buffer = createNeutralImpulse(context);
    nodes.pitchShifter.pitchRatio = 1;
    setWetRouting(nodes, false);
  };

  switch (effect) {
    case "wah": {
      resetModulation();
      const LOUDNESS_BOTTOM = 0.5; // [0..1]
      const LOUDNESS_TOP = 0.7; // [0..1]
      const MAX_EDGE_DB = 36;

      const edgeAmount = Math.pow(smoothAbs(direction), 3.5);
      const edgeDb =
        edgeAmount * (LOUDNESS_BOTTOM + LOUDNESS_TOP) * MAX_EDGE_DB;
      const edgeGain = Math.pow(10, edgeDb / 20);

      const wahAmount = intensity;

      const minFrequency = 250;
      const maxFrequency = 2600;
      const sweep =
        0.5 + Math.sign(centered) * Math.pow(Math.abs(centered), 0.7);
      const frequency =
        minFrequency *
        Math.pow(maxFrequency / minFrequency, clamp(sweep, 0, 1));

      const resonance = 3 + wahAmount * 10;

      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(frequency, now, 0.01);
      nodes.filter.Q.setTargetAtTime(resonance, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);

      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.95, 0.2);
      setMix(wetMix * edgeGain, dryMix);
      break;
    }
    case "bass-boost": {
      resetModulation();
      nodes.filter.type = "lowshelf";
      nodes.filter.frequency.setTargetAtTime(180, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(direction * 18, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.2);
      setMix(wetMix, dryMix);
      break;
    }
    case "bright": {
      resetModulation();
      nodes.filter.type = "highshelf";
      nodes.filter.frequency.setTargetAtTime(3500, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(direction * 18, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.85, 0.25);
      setMix(wetMix, dryMix);
      break;
    }
    case "warm": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        20000 - intensity * 16000,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.7 + intensity * 1.4, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.85, 0.2);
      setMix(wetMix, dryMix);
      break;
    }
    case "telephone": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(800 + intensity * 1400, now, 0.01);
      nodes.filter.Q.setTargetAtTime(1.2 + intensity * 9, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.95, 0.1);
      setMix(wetMix, dryMix);
      break;
    }
    case "lofi": {
      resetModulation();
      const isPositive = direction >= 0;
      const cutoff = isPositive
        ? 16000 - intensity * 15000
        : 16000 - intensity * 9000;
      const resonance = isPositive
        ? 0.6 + intensity * 2.4
        : 0.5 + intensity * 1.2;
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(cutoff, now, 0.01);
      nodes.filter.Q.setTargetAtTime(resonance, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(
        intensity,
        isPositive ? 0.95 : 0.75,
        0.15
      );
      setMix(wetMix, dryMix);
      break;
    }
    case "submerge": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        3200 - intensity * 2700,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.9 + intensity * 2.2, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.95, 0.1);
      setMix(wetMix, dryMix);
      break;
    }
    case "delay-pedal": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        7000 - intensity * 2500,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.7 + intensity * 0.6, now, 0.01);
      nodes.delay.delayTime.setTargetAtTime(0.12 + intensity * 0.55, now, 0.01);
      nodes.feedbackGain.gain.setTargetAtTime(
        0.15 + intensity * 0.7,
        now,
        0.01
      );
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.95, 0.1);
      setMix(wetMix, dryMix);
      break;
    }
    case "chorus": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        14000 - intensity * 5000,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.7 + intensity * 0.8, now, 0.01);
      nodes.delay.delayTime.setTargetAtTime(
        0.015 + intensity * 0.04,
        now,
        0.01
      );
      nodes.feedbackGain.gain.setTargetAtTime(
        0.05 + intensity * 0.35,
        now,
        0.01
      );
      nodes.lfo.frequency.setTargetAtTime(0.12 + intensity * 0.9, now, 0.01);
      nodes.delayLfoGain.gain.setTargetAtTime(
        0.002 + intensity * 0.018,
        now,
        0.01
      );
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.85, 0.25);
      setMix(wetMix, dryMix);
      break;
    }
    case "reverb": {
      resetModulation();
      setWetRouting(nodes, true);
      const duration = 0.4 + intensity * 3.2;
      const decay = 2 + intensity * 5;
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        16000 - intensity * 9000,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.6 + intensity * 0.8, now, 0.01);
      nodes.convolver.buffer = createReverbImpulse(context, duration, decay);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.95, 0.15);
      setMix(wetMix, dryMix);
      break;
    }
    case "envelope-filter": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(350 + intensity * 2300, now, 0.01);
      nodes.filter.Q.setTargetAtTime(1.1 + intensity * 9.5, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.15);
      setMix(wetMix, dryMix);
      break;
    }
    case "flange": {
      resetModulation();
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(900, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7 + intensity * 0.9, now, 0.01);
      nodes.delay.delayTime.setTargetAtTime(
        0.002 + intensity * 0.012,
        now,
        0.01
      );
      nodes.feedbackGain.gain.setTargetAtTime(0.1 + intensity * 0.7, now, 0.01);
      nodes.lfo.frequency.setTargetAtTime(0.08 + intensity * 1.2, now, 0.01);
      nodes.delayLfoGain.gain.setTargetAtTime(
        0.0006 + intensity * 0.007,
        now,
        0.01
      );
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.1);
      setMix(wetMix, dryMix);
      break;
    }
    case "phaser": {
      resetModulation();
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(360 + intensity * 1400, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.5 + intensity * 3.5, now, 0.01);
      nodes.lfo.frequency.setTargetAtTime(0.08 + intensity * 1.1, now, 0.01);
      nodes.filterLfoGain.gain.setTargetAtTime(90 + intensity * 900, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.88, 0.15);
      setMix(wetMix, dryMix);
      break;
    }
    case "tilt-eq": {
      resetModulation();
      const tilt = direction;
      nodes.filter.type = "highshelf";
      nodes.filter.frequency.setTargetAtTime(1200, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(tilt * 18, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.85, 0.25);
      setMix(wetMix, dryMix);
      break;
    }
    case "band-emphasis": {
      resetModulation();
      nodes.filter.type = "peaking";
      nodes.filter.frequency.setTargetAtTime(350 + intensity * 2800, now, 0.01);
      nodes.filter.Q.setTargetAtTime(1.2 + intensity * 9, now, 0.01);
      nodes.filter.gain.setTargetAtTime(8 + intensity * 16, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.15);
      setMix(wetMix, dryMix);
      break;
    }
    case "saturation": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(12000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.shaper.curve = createSaturationCurve(intensity);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.25);
      setMix(wetMix, dryMix);
      break;
    }
    case "formant-filter": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(350 + intensity * 1200, now, 0.01);
      nodes.filter.Q.setTargetAtTime(5 + intensity * 12, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      const { wetMix, dryMix } = getMixFromIntensity(intensity, 0.9, 0.15);
      setMix(wetMix, dryMix);
      break;
    }
    case "pitch-shift": {
      resetModulation();
      nodes.pitchShifter.pitchRatio = getPitchShiftPlaybackRate(value);
      setWetRouting(nodes, false);
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(1000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.5, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(1, 0);
      break;
    }
    default: {
      resetModulation();
      setMix(0, 1);
    }
  }
};

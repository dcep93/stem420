export type AudioEffectType =
  | "wah"
  | "bass-boost"
  | "bright"
  | "warm"
  | "telephone"
  | "lofi"
  | "submerge"
  | "delay-pedal"
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
      "Simulates a capo by shifting pitch upward without altering chords analysis. Higher settings move the entire track up in semitones, delivering a brighter, lifted feel.",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export type EffectNodes = {
  filter: BiquadFilterNode;
  wetGain: GainNode;
  dryGain: GainNode;
  delay: DelayNode;
  feedbackGain: GainNode;
  shaper: WaveShaperNode;
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

export const DEFAULT_EFFECT_VALUE = 0.5;
export const PITCH_SHIFT_MAX_SEMITONES = 7;

export const getPitchShiftPlaybackRate = (value: number) => {
  const semitones = clamp(value, 0, 1) * PITCH_SHIFT_MAX_SEMITONES;
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
        ((3 + intensity) * x * 20 * deg) /
        (Math.PI + intensity * Math.abs(x));
    }
  }

  return curve;
};

export const createEffectNodes = (context: AudioContext): EffectNodes => {
  const filter = context.createBiquadFilter();
  const wetGain = context.createGain();
  const dryGain = context.createGain();
  const delay = context.createDelay(1);
  const feedbackGain = context.createGain();
  const shaper = context.createWaveShaper();
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
  const normalized = clamp(value, 0, 1);
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
  };

  switch (effect) {
    case "wah": {
      resetModulation();
      const LOUDNESS_BOTTOM = 0.5; // [0..1]
      const LOUDNESS_TOP = 0.7; // [0..1]
      const MAX_EDGE_DB = 36;

      const bottomEdge = Math.pow(1 - normalized, 3.5);
      const topEdge = Math.pow(normalized, 3.5);

      const bottomDb = bottomEdge * LOUDNESS_BOTTOM * MAX_EDGE_DB;
      const topDb = topEdge * LOUDNESS_TOP * MAX_EDGE_DB;
      const edgeDb = Math.max(bottomDb, topDb);
      const edgeGain = Math.pow(10, edgeDb / 20);

      const offsetFromCenter = normalized - 0.5;
      const wahAmount = Math.abs(offsetFromCenter) * 2;

      const minFrequency = 250;
      const maxFrequency = 2600;
      const frequency =
        minFrequency * Math.pow(maxFrequency / minFrequency, normalized);

      const resonance = 3 + wahAmount * 10;
      const crossfadeAngle = wahAmount * (Math.PI / 2);
      const dryMix = Math.pow(Math.cos(crossfadeAngle), 4);
      const wetMix = Math.sin(crossfadeAngle);

      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(frequency, now, 0.01);
      nodes.filter.Q.setTargetAtTime(resonance, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);

      setMix(wetMix * edgeGain, dryMix);
      break;
    }
    case "bass-boost": {
      resetModulation();
      nodes.filter.type = "lowshelf";
      nodes.filter.frequency.setTargetAtTime(180, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(6 + normalized * 12, now, 0.01);
      setMix(0.35 + normalized * 0.65, 1 - normalized * 0.3);
      break;
    }
    case "bright": {
      resetModulation();
      nodes.filter.type = "highshelf";
      nodes.filter.frequency.setTargetAtTime(3500, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(4 + normalized * 12, now, 0.01);
      setMix(0.3 + normalized * 0.6, 1 - normalized * 0.35);
      break;
    }
    case "warm": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        12000 - normalized * 8000,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.7 + normalized * 0.6, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.25 + normalized * 0.55, 1 - normalized * 0.4);
      break;
    }
    case "telephone": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(1000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.9 + normalized * 6, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.6 + normalized * 0.4, 1 - normalized * 0.6);
      break;
    }
    case "lofi": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        12000 - normalized * 10000,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.5 + normalized * 0.9, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.45 + normalized * 0.45, 1 - normalized * 0.5);
      break;
    }
    case "submerge": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(
        2000 - normalized * 1500,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(0.8 + normalized * 1.2, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.55 + normalized * 0.35, 1 - normalized * 0.5);
      break;
    }
    case "delay-pedal": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(6000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.6, now, 0.01);
      nodes.delay.delayTime.setTargetAtTime(0.18 + normalized * 0.27, now, 0.01);
      nodes.feedbackGain.gain.setTargetAtTime(0.2 + normalized * 0.4, now, 0.01);
      setMix(0.35 + normalized * 0.45, 1 - normalized * 0.4);
      break;
    }
    case "envelope-filter": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(
        400 + normalized * 1800,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(1.2 + normalized * 6, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.5 + normalized * 0.45, 1 - normalized * 0.5);
      break;
    }
    case "flange": {
      resetModulation();
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(800, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.delay.delayTime.setTargetAtTime(0.004 + normalized * 0.008, now, 0.01);
      nodes.feedbackGain.gain.setTargetAtTime(0.15 + normalized * 0.35, now, 0.01);
      nodes.lfo.frequency.setTargetAtTime(0.2 + normalized * 0.8, now, 0.01);
      nodes.delayLfoGain.gain.setTargetAtTime(0.001 + normalized * 0.004, now, 0.01);
      setMix(0.35 + normalized * 0.45, 1 - normalized * 0.4);
      break;
    }
    case "phaser": {
      resetModulation();
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(450 + normalized * 750, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.6 + normalized * 2.4, now, 0.01);
      nodes.lfo.frequency.setTargetAtTime(0.12 + normalized * 0.5, now, 0.01);
      nodes.filterLfoGain.gain.setTargetAtTime(140 + normalized * 460, now, 0.01);
      setMix(0.4 + normalized * 0.45, 1 - normalized * 0.45);
      break;
    }
    case "tilt-eq": {
      resetModulation();
      const tilt = (normalized - 0.5) * 2;
      nodes.filter.type = "highshelf";
      nodes.filter.frequency.setTargetAtTime(1200, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.filter.gain.setTargetAtTime(tilt * 10, now, 0.01);
      setMix(0.4 + Math.abs(tilt) * 0.4, 1 - Math.abs(tilt) * 0.35);
      break;
    }
    case "band-emphasis": {
      resetModulation();
      nodes.filter.type = "peaking";
      nodes.filter.frequency.setTargetAtTime(
        500 + normalized * 2200,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(1.5 + normalized * 4.5, now, 0.01);
      nodes.filter.gain.setTargetAtTime(6 + normalized * 10, now, 0.01);
      setMix(0.45 + normalized * 0.45, 1 - normalized * 0.4);
      break;
    }
    case "saturation": {
      resetModulation();
      nodes.filter.type = "lowpass";
      nodes.filter.frequency.setTargetAtTime(12000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.7, now, 0.01);
      nodes.shaper.curve = createSaturationCurve(normalized);
      setMix(0.4 + normalized * 0.5, 1 - normalized * 0.4);
      break;
    }
    case "formant-filter": {
      resetModulation();
      nodes.filter.type = "bandpass";
      nodes.filter.frequency.setTargetAtTime(
        500 + normalized * 700,
        now,
        0.01
      );
      nodes.filter.Q.setTargetAtTime(6 + normalized * 8, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0.55 + normalized * 0.35, 1 - normalized * 0.5);
      break;
    }
    case "pitch-shift": {
      resetModulation();
      nodes.filter.type = "allpass";
      nodes.filter.frequency.setTargetAtTime(1000, now, 0.01);
      nodes.filter.Q.setTargetAtTime(0.5, now, 0.01);
      nodes.filter.gain.setTargetAtTime(0, now, 0.01);
      setMix(0, 1);
      break;
    }
    default: {
      resetModulation();
      setMix(0, 1);
    }
  }
};

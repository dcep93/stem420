export type ChordSnapshot = {
  time: number
  chord: string
  confidence: number
}

type ChordQuality =
  | "major"
  | "minor"
  | "power"
  | "sus2"
  | "suspended"
  | "dom7"
  | "maj7"
  | "min7"
  | "dim"
  | "aug"
  | "unknown"

type ChordAnalysisOptions = {
  windowSeconds?: number
  hopSeconds?: number
  minimumConfidence?: number
  stableFrameCount?: number
  yieldEveryFrames?: number
}

const NOTE_LABELS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
]

const CHORD_TEMPLATES: Array<{
  quality: ChordQuality
  intervals: number[]
  weight: number
}> = [
  { quality: "major", intervals: [0, 4, 7], weight: 1.12 },
  { quality: "minor", intervals: [0, 3, 7], weight: 1.1 },
  { quality: "dom7", intervals: [0, 4, 7, 10], weight: 1.02 },
  { quality: "maj7", intervals: [0, 4, 7, 11], weight: 0.98 },
  { quality: "min7", intervals: [0, 3, 7, 10], weight: 0.98 },
  { quality: "sus2", intervals: [0, 2, 7], weight: 0.95 },
  { quality: "suspended", intervals: [0, 5, 7], weight: 0.95 },
  { quality: "power", intervals: [0, 7], weight: 0.85 },
  { quality: "dim", intervals: [0, 3, 6], weight: 0.7 },
  { quality: "aug", intervals: [0, 4, 8], weight: 0.7 },
]

const MIN_MIDI_NOTE = 36 // C2
const MAX_MIDI_NOTE = 80 // G#5

const harmonicFrequenciesByPitchClass = (() => {
  const pitchClassBuckets: number[][] = Array.from({ length: 12 }, () => [])

  for (let midi = MIN_MIDI_NOTE; midi <= MAX_MIDI_NOTE; midi++) {
    const pitchClass = midi % 12
    const frequency = 440 * Math.pow(2, (midi - 69) / 12)
    pitchClassBuckets[pitchClass]?.push(frequency)
  }

  return pitchClassBuckets
})()

const createMonoBuffer = (buffer: AudioBuffer): Float32Array => {
  const { length, numberOfChannels } = buffer
  const mono = new Float32Array(length)

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] ?? 0
    }
  }

  // Normalize by channel count to avoid volume inflation.
  const normalization = Math.max(1, numberOfChannels)
  for (let i = 0; i < length; i++) {
    mono[i] /= normalization
  }

  return mono
}

const applyHannWindow = (frame: Float32Array): Float32Array => {
  const length = frame.length
  if (length === 0) {
    return frame
  }

  let mean = 0
  for (let i = 0; i < length; i++) {
    mean += frame[i] ?? 0
  }
  mean /= length

  const windowed = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1))
    windowed[i] = ((frame[i] ?? 0) - mean) * window
  }

  return windowed
}

const computeRms = (frame: Float32Array): number => {
  if (!frame.length) {
    return 0
  }

  let sumSquares = 0
  for (let i = 0; i < frame.length; i++) {
    const sample = frame[i] ?? 0
    sumSquares += sample * sample
  }

  return Math.sqrt(sumSquares / frame.length)
}

const goertzelMagnitude = (
  samples: Float32Array,
  sampleRate: number,
  targetFrequency: number
): number => {
  // Lightweight spectral measurement specialized for a single target frequency.
  const normalizedFrequency = targetFrequency / sampleRate
  const coefficient = 2 * Math.cos(2 * Math.PI * normalizedFrequency)

  let q0 = 0
  let q1 = 0
  let q2 = 0

  for (let i = 0; i < samples.length; i++) {
    q0 = coefficient * q1 - q2 + samples[i]!
    q2 = q1
    q1 = q0
  }

  const real = q1 - q2 * Math.cos(2 * Math.PI * normalizedFrequency)
  const imag = q2 * Math.sin(2 * Math.PI * normalizedFrequency)

  return Math.sqrt(real * real + imag * imag)
}

const computePitchClassEnergies = (
  frame: Float32Array,
  sampleRate: number
): { energies: number[]; bassEnergies: number[] } => {
  const energies: number[] = []
  const bassEnergies: number[] = []

  harmonicFrequenciesByPitchClass.forEach((frequencies, pitchClass) => {
    let energy = 0
    let bassEnergy = 0

    // Aggregate energy from several octaves and reinforce the first harmonics.
    frequencies.forEach((frequency) => {
      const base = goertzelMagnitude(frame, sampleRate, frequency)
      const second = goertzelMagnitude(frame, sampleRate, frequency * 2) * 0.5
      const third = goertzelMagnitude(frame, sampleRate, frequency * 3) * 0.25
      energy += base + second + third

      if (frequency <= 220) {
        bassEnergy += base * 1.2 + second * 0.4
      }
    })

    energies[pitchClass] = Math.log1p(energy)
    bassEnergies[pitchClass] = Math.log1p(bassEnergy)
  })

  return { energies, bassEnergies }
}

const scoreChordTemplate = (
  root: number,
  template: (typeof CHORD_TEMPLATES)[number],
  pitchEnergies: number[],
  energySum: number
): { chord: string; score: number; confidence: number } => {
  const { quality, intervals } = template
  const rootEnergy = pitchEnergies[root] ?? 0

  let score = 0
  intervals.forEach((interval, index) => {
    const weight = index === 0 ? 1.25 : 1
    score += (pitchEnergies[(root + interval) % 12] ?? 0) * weight
  })

  // Reward stable roots so we do not oscillate between enharmonic matches.
  score += rootEnergy * 0.15

  const confidence = energySum > 0 ? score / energySum : 0
  const label = `${NOTE_LABELS[root] ?? "?"} ${quality}`

  return { chord: label, score: score * template.weight, confidence }
}

const pickBestChord = (
  pitchEnergies: number[],
  bassEnergies: number[],
  minimumConfidence: number
): { chord: string; confidence: number } => {
  const energySum = pitchEnergies.reduce((sum, value) => sum + value, 0) + 1e-6

  let best: { chord: string; score: number; confidence: number } = {
    chord: "Unclear",
    score: 0,
    confidence: 0,
  }

  for (let root = 0; root < 12; root++) {
    CHORD_TEMPLATES.forEach((template) => {
      const candidate = scoreChordTemplate(root, template, pitchEnergies, energySum)

      const bassBoost = (bassEnergies[root] ?? 0) * 0.35
      const weightedScore = candidate.score + bassBoost

      if (weightedScore > best.score) {
        best = candidate
        best.score = weightedScore
      }
    })
  }

  if (best.confidence < minimumConfidence) {
    return { chord: "Unclear", confidence: best.confidence }
  }

  return { chord: best.chord, confidence: best.confidence }
}

const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })

const smoothChordFrames = (
  frames: ChordSnapshot[],
  stableFrameCount: number
): ChordSnapshot[] => {
  if (!frames.length) {
    return []
  }

  if (stableFrameCount <= 1) {
    return frames
  }

  const snapshots: ChordSnapshot[] = [frames[0]!]
  let currentChord = frames[0]!.chord
  let pendingChord = ""
  let pendingCount = 0
  let pendingTime = frames[0]!.time
  let pendingConfidence = frames[0]!.confidence

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i]!

    if (frame.chord === currentChord) {
      pendingChord = ""
      pendingCount = 0
      continue
    }

    if (frame.chord === "Unclear") {
      continue
    }

    if (frame.chord !== pendingChord) {
      pendingChord = frame.chord
      pendingCount = 1
      pendingTime = frame.time
      pendingConfidence = frame.confidence
    } else {
      pendingCount += 1
    }

    if (pendingCount >= stableFrameCount) {
      currentChord = pendingChord
      snapshots.push({
        time: pendingTime,
        chord: pendingChord,
        confidence: pendingConfidence,
      })
      pendingChord = ""
      pendingCount = 0
    }
  }

  return snapshots
}

export const analyzeChordTimeline = async (
  buffer: AudioBuffer,
  options: ChordAnalysisOptions = {}
): Promise<ChordSnapshot[]> => {
  const windowSeconds = options.windowSeconds ?? 0.8
  const hopSeconds = options.hopSeconds ?? 0.35
  const minimumConfidence = options.minimumConfidence ?? 0.15
  const stableFrameCount = options.stableFrameCount ?? 3
  const yieldEveryFrames = options.yieldEveryFrames ?? 10
  const silenceThreshold = 0.008

  const mono = createMonoBuffer(buffer)
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * windowSeconds))
  const hopSize = Math.max(1, Math.floor(buffer.sampleRate * hopSeconds))

  const frames: ChordSnapshot[] = []
  let frameIndex = 0

  for (let start = 0; start < mono.length; start += hopSize) {
    const end = Math.min(start + windowSize, mono.length)
    const frame = mono.subarray(start, end)
    const windowed = applyHannWindow(frame)
    const rms = computeRms(windowed)

    if (rms < silenceThreshold) {
      frames.push({
        time: start / buffer.sampleRate,
        chord: "Unclear",
        confidence: 0,
      })
      frameIndex += 1
      if (yieldEveryFrames > 0 && frameIndex % yieldEveryFrames === 0) {
        await yieldToBrowser()
      }
      continue
    }

    const { energies, bassEnergies } = computePitchClassEnergies(
      windowed,
      buffer.sampleRate
    )
    const { chord, confidence } = pickBestChord(
      energies,
      bassEnergies,
      minimumConfidence
    )

    frames.push({
      time: start / buffer.sampleRate,
      chord,
      confidence,
    })

    frameIndex += 1
    if (yieldEveryFrames > 0 && frameIndex % yieldEveryFrames === 0) {
      await yieldToBrowser()
    }
  }

  const smoothedFrames = smoothChordFrames(frames, stableFrameCount)

  return smoothedFrames
}

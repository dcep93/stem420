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
  | "maj9"
  | "min9"
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
  { quality: "major", intervals: [0, 4, 7], weight: 1.15 },
  { quality: "minor", intervals: [0, 3, 7], weight: 1.14 },
  { quality: "dom7", intervals: [0, 4, 7, 10], weight: 0.92 },
  { quality: "maj7", intervals: [0, 4, 7, 11], weight: 0.9 },
  { quality: "min7", intervals: [0, 3, 7, 10], weight: 0.9 },
  { quality: "maj9", intervals: [0, 4, 7, 2], weight: 0.82 },
  { quality: "min9", intervals: [0, 3, 7, 2], weight: 0.82 },
  { quality: "sus2", intervals: [0, 2, 7], weight: 0.98 },
  { quality: "suspended", intervals: [0, 5, 7], weight: 0.98 },
  { quality: "power", intervals: [0, 7], weight: 0.88 },
  { quality: "dim", intervals: [0, 3, 6], weight: 0.72 },
  { quality: "aug", intervals: [0, 4, 8], weight: 0.72 },
]

const MIN_MIDI_NOTE = 33 // A1
const MAX_MIDI_NOTE = 84 // C6
const HARMONIC_WEIGHTS = [1, 0.6, 0.35, 0.2, 0.12, 0.08]

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

const normalizePitchEnergies = (energies: number[]): number[] => {
  const mean =
    energies.reduce((sum, value) => sum + value, 0) / Math.max(1, energies.length)
  const centered = energies.map((value) => Math.max(0, value - mean * 0.6))
  const total = centered.reduce((sum, value) => sum + value, 0) + 1e-6
  return centered.map((value) => value / total)
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

    frequencies.forEach((frequency) => {
      let harmonicSum = 0
      HARMONIC_WEIGHTS.forEach((weight, index) => {
        const harmonic = goertzelMagnitude(
          frame,
          sampleRate,
          frequency * (index + 1)
        )
        harmonicSum += harmonic * weight
      })

      energy += harmonicSum
      if (frequency <= 196) {
        bassEnergy += harmonicSum * 1.3
      }
    })

    energies[pitchClass] = Math.log1p(energy)
    bassEnergies[pitchClass] = Math.log1p(bassEnergy)
  })

  const normalized = normalizePitchEnergies(energies)
  const normalizedBass = normalizePitchEnergies(bassEnergies)

  return { energies: normalized, bassEnergies: normalizedBass }
}

const getBaseIntervals = (quality: ChordQuality): number[] => {
  switch (quality) {
    case "major":
    case "dom7":
    case "maj7":
    case "maj9":
      return [0, 4, 7]
    case "minor":
    case "min7":
    case "min9":
      return [0, 3, 7]
    case "sus2":
      return [0, 2, 7]
    case "suspended":
      return [0, 5, 7]
    case "power":
      return [0, 7]
    case "dim":
      return [0, 3, 6]
    case "aug":
      return [0, 4, 8]
    default:
      return [0, 4, 7]
  }
}

const scoreChordTemplate = (
  root: number,
  template: (typeof CHORD_TEMPLATES)[number],
  pitchEnergies: number[]
): { chord: string; score: number; confidence: number } => {
  const { quality, intervals } = template
  const baseIntervals = getBaseIntervals(quality)
  const baseIntervalSet = new Set(baseIntervals)
  const chordMask = new Array(12).fill(0)

  intervals.forEach((interval, index) => {
    const isRoot = index === 0
    const isBase = baseIntervalSet.has(interval)
    const weight = isRoot ? 1.4 : isBase ? 1.1 : interval === 2 ? 0.55 : 0.7
    chordMask[(root + interval) % 12] = weight
  })

  let matchEnergy = 0
  let baseEnergy = 0
  let offEnergy = 0

  pitchEnergies.forEach((energy, pitchClass) => {
    const weight = chordMask[pitchClass] ?? 0
    if (weight > 0) {
      matchEnergy += energy * weight
      if (weight >= 1) {
        baseEnergy += energy * weight
      }
    } else {
      offEnergy += energy
    }
  })

  const coverage = matchEnergy
  const purity = Math.max(0, 1 - offEnergy * 1.15)
  const stability = baseEnergy * 0.6 + coverage * 0.4
  const score = (coverage * purity + stability) * template.weight
  const confidence = Math.min(1, coverage * 1.2 + stability * 0.3)
  const label = formatChordLabel(root, quality)

  return { chord: label, score, confidence }
}

const formatChordLabel = (root: number, quality: ChordQuality): string => {
  const note = NOTE_LABELS[root] ?? "?"

  switch (quality) {
    case "major":
      return note
    case "minor":
      return `${note}m`
    case "power":
      return `${note}5`
    case "sus2":
      return `${note}sus2`
    case "suspended":
      return `${note}sus4`
    case "dom7":
      return `${note}7`
    case "maj7":
      return `${note}maj7`
    case "min7":
      return `${note}m7`
    case "maj9":
      return `${note}maj9`
    case "min9":
      return `${note}m9`
    case "dim":
      return `${note}dim`
    case "aug":
      return `${note}aug`
    default:
      return `${note} ${quality}`
  }
}

const pickBestChord = (
  pitchEnergies: number[],
  bassEnergies: number[],
  minimumConfidence: number
): { chord: string; confidence: number } => {
  const bassAverage =
    bassEnergies.reduce((sum, value) => sum + value, 0) / bassEnergies.length

  let best: { chord: string; score: number; confidence: number } = {
    chord: "Unclear",
    score: 0,
    confidence: 0,
  }

  for (let root = 0; root < 12; root++) {
    CHORD_TEMPLATES.forEach((template) => {
      const candidate = scoreChordTemplate(root, template, pitchEnergies)
      const bassBoost = Math.max(0, (bassEnergies[root] ?? 0) - bassAverage) * 0.8
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

  const snapshots: ChordSnapshot[] = []
  const window = Math.max(3, stableFrameCount * 2 - 1)

  for (let i = 0; i < frames.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(frames.length, start + window)
    const tally = new Map<string, { count: number; confidence: number }>()

    for (let j = start; j < end; j++) {
      const frame = frames[j]!
      if (frame.chord === "Unclear") {
        continue
      }

      const entry = tally.get(frame.chord) ?? { count: 0, confidence: 0 }
      entry.count += 1
      entry.confidence += frame.confidence
      tally.set(frame.chord, entry)
    }

    let bestChord = "Unclear"
    let bestCount = 0
    let bestConfidence = 0

    tally.forEach((entry, chord) => {
      if (entry.count > bestCount) {
        bestChord = chord
        bestCount = entry.count
        bestConfidence = entry.confidence / entry.count
      }
    })

    const chord = bestCount >= stableFrameCount ? bestChord : "Unclear"
    if (!snapshots.length || snapshots[snapshots.length - 1]!.chord !== chord) {
      snapshots.push({
        time: frames[i]!.time,
        chord,
        confidence: chord === "Unclear" ? 0 : bestConfidence,
      })
    }
  }

  return snapshots
}

export const analyzeChordTimeline = async (
  buffer: AudioBuffer,
  options: ChordAnalysisOptions = {}
): Promise<ChordSnapshot[]> => {
  const windowSeconds = options.windowSeconds ?? 1.1
  const hopSeconds = options.hopSeconds ?? 0.25
  const minimumConfidence = options.minimumConfidence ?? 0.18
  const stableFrameCount = options.stableFrameCount ?? 4
  const yieldEveryFrames = options.yieldEveryFrames ?? 10
  const silenceThreshold = 0.006

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

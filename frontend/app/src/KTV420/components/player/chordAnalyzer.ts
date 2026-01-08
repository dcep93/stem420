export type ChordSnapshot = {
  time: number
  chord: string
  confidence: number
}

type ChordQuality = "major" | "minor" | "power" | "suspended" | "unknown"

type ChordAnalysisOptions = {
  windowSeconds?: number
  hopSeconds?: number
  minimumConfidence?: number
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
}> = [
  { quality: "major", intervals: [0, 4, 7] },
  { quality: "minor", intervals: [0, 3, 7] },
  { quality: "suspended", intervals: [0, 5, 7] },
  { quality: "power", intervals: [0, 7] },
]

const MIN_MIDI_NOTE = 40 // E2
const MAX_MIDI_NOTE = 76 // E5

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
): number[] => {
  const energies: number[] = []

  harmonicFrequenciesByPitchClass.forEach((frequencies, pitchClass) => {
    let energy = 0

    // Aggregate energy from several octaves and reinforce the first harmonics.
    frequencies.forEach((frequency) => {
      energy += goertzelMagnitude(frame, sampleRate, frequency)
      energy += goertzelMagnitude(frame, sampleRate, frequency * 2) * 0.5
      energy += goertzelMagnitude(frame, sampleRate, frequency * 3) * 0.25
    })

    energies[pitchClass] = energy
  })

  return energies
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

  return { chord: label, score, confidence }
}

const pickBestChord = (
  pitchEnergies: number[],
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

      if (candidate.score > best.score) {
        best = candidate
      }
    })
  }

  if (best.confidence < minimumConfidence) {
    return { chord: "Unclear", confidence: best.confidence }
  }

  return { chord: best.chord, confidence: best.confidence }
}

export const analyzeChordTimeline = async (
  buffer: AudioBuffer,
  options: ChordAnalysisOptions = {}
): Promise<ChordSnapshot[]> => {
  const windowSeconds = options.windowSeconds ?? 0.8
  const hopSeconds = options.hopSeconds ?? 0.35
  const minimumConfidence = options.minimumConfidence ?? 0.12

  const mono = createMonoBuffer(buffer)
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * windowSeconds))
  const hopSize = Math.max(1, Math.floor(buffer.sampleRate * hopSeconds))

  const snapshots: ChordSnapshot[] = []

  for (let start = 0; start < mono.length; start += hopSize) {
    const end = Math.min(start + windowSize, mono.length)
    const frame = mono.subarray(start, end)
    const pitchEnergies = computePitchClassEnergies(frame, buffer.sampleRate)
    const { chord, confidence } = pickBestChord(pitchEnergies, minimumConfidence)

    if (!snapshots.length || snapshots[snapshots.length - 1]?.chord !== chord) {
      snapshots.push({
        time: start / buffer.sampleRate,
        chord,
        confidence,
      })
    }
  }

  return snapshots
}

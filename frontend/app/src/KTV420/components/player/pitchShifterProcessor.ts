const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "pitchRatio",
        defaultValue: 1,
        minValue: 0.5,
        maxValue: 2,
        automationRate: "k-rate",
      },
    ];
  }

  private readonly grainSize: number;
  private readonly hopSize: number;
  private readonly inputBufferSize: number;
  private readonly olaSize: number;
  private readonly window: Float32Array;
  private readonly inputL: Float32Array;
  private readonly inputR: Float32Array;
  private readonly olaL: Float32Array;
  private readonly olaR: Float32Array;
  private writeIndex = 0;
  private readIndex = 0;
  private outputIndex = 0;
  private samplesUntilNextGrain = 0;
  private smoothedRatio = 1;

  constructor() {
    super();

    this.grainSize = Math.max(256, Math.floor(sampleRate * 0.04));
    this.hopSize = Math.floor(this.grainSize / 2);
    this.inputBufferSize = this.grainSize * 6;
    this.olaSize = this.grainSize + this.hopSize;

    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i += 1) {
      this.window[i] =
        0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.grainSize - 1));
    }

    this.inputL = new Float32Array(this.inputBufferSize);
    this.inputR = new Float32Array(this.inputBufferSize);
    this.olaL = new Float32Array(this.olaSize);
    this.olaR = new Float32Array(this.olaSize);
  }

  private readSample(buffer: Float32Array, index: number) {
    const wrapped =
      ((index % this.inputBufferSize) + this.inputBufferSize) %
      this.inputBufferSize;
    const i0 = Math.floor(wrapped);
    const i1 = (i0 + 1) % this.inputBufferSize;
    const frac = wrapped - i0;
    return buffer[i0]! * (1 - frac) + buffer[i1]! * frac;
  }

  private addGrain(ratio: number) {
    const clampedRatio = clamp(ratio, 0.5, 2);
    const baseIndex = this.readIndex;
    const outputIndex = this.outputIndex;

    for (let i = 0; i < this.grainSize; i += 1) {
      const readPos = baseIndex + i * clampedRatio;
      const windowValue = this.window[i]!;
      const sampleL = this.readSample(this.inputL, readPos);
      const sampleR = this.readSample(this.inputR, readPos);
      const olaIndex = (outputIndex + i) % this.olaSize;

      this.olaL[olaIndex]! += sampleL * windowValue;
      this.olaR[olaIndex]! += sampleR * windowValue;
    }

    this.readIndex = baseIndex + this.hopSize;
    if (this.readIndex >= this.inputBufferSize) {
      this.readIndex -= this.inputBufferSize;
    }

    const distance =
      (this.writeIndex - this.readIndex + this.inputBufferSize) %
      this.inputBufferSize;
    if (distance < this.grainSize * 2) {
      this.readIndex =
        (this.writeIndex - this.grainSize * 2 + this.inputBufferSize) %
        this.inputBufferSize;
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const input = inputs[0] ?? [];
    const output = outputs[0];

    if (!output || output.length === 0) {
      return true;
    }

    const inputL = input[0];
    const inputR = input[1] ?? inputL;
    const outputL = output[0]!;
    const outputR = output[1] ?? outputL;
    const pitchRatios = parameters.pitchRatio;

    for (let i = 0; i < outputL.length; i += 1) {
      const inSampleL = inputL?.[i] ?? 0;
      const inSampleR = inputR?.[i] ?? inSampleL;

      this.inputL[this.writeIndex] = inSampleL;
      this.inputR[this.writeIndex] = inSampleR;
      this.writeIndex = (this.writeIndex + 1) % this.inputBufferSize;

      outputL[i] = this.olaL[this.outputIndex]!;
      outputR[i] = this.olaR[this.outputIndex]!;
      this.olaL[this.outputIndex] = 0;
      this.olaR[this.outputIndex] = 0;
      this.outputIndex = (this.outputIndex + 1) % this.olaSize;

      const targetRatio =
        pitchRatios.length > 1 ? pitchRatios[i]! : pitchRatios[0]!;
      this.smoothedRatio += (targetRatio - this.smoothedRatio) * 0.01;

      if (this.samplesUntilNextGrain <= 0) {
        this.addGrain(this.smoothedRatio);
        this.samplesUntilNextGrain += this.hopSize;
      }

      this.samplesUntilNextGrain -= 1;
    }

    return true;
  }
}

registerProcessor("pitch-shifter", PitchShifterProcessor);

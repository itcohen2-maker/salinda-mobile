export type SoundCueId =
  | 'cardSelect'
  | 'cardTest'
  | 'acceptedVerdict'
  | 'rejectedVerdict'
  | 'ledgerEntry'
  | 'readyToName'
  | 'namingOpen'
  | 'submitAccepted'
  | 'submitRejected'

type AudioContextLike = AudioContext

type ToneOptions = {
  attack?: number
  duration?: number
  frequency: number
  gain?: number
  release?: number
  start: number
  type?: OscillatorType
}

function scheduleTone(context: AudioContextLike, options: ToneOptions) {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()
  const filter = context.createBiquadFilter()
  const attack = options.attack ?? 0.012
  const duration = options.duration ?? 0.08
  const release = options.release ?? 0.16
  const gain = options.gain ?? 0.018
  const endTime = options.start + attack + duration + release

  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.setValueAtTime(options.frequency, options.start)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, options.start)
  filter.Q.value = 0.9

  gainNode.gain.setValueAtTime(0.0001, options.start)
  gainNode.gain.linearRampToValueAtTime(gain, options.start + attack)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

  oscillator.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.start(options.start)
  oscillator.stop(endTime + 0.01)
}

function scheduleCue(context: AudioContextLike, cue: SoundCueId) {
  const now = context.currentTime + 0.01

  switch (cue) {
    case 'cardSelect':
      scheduleTone(context, { frequency: 392, start: now, duration: 0.04, gain: 0.012, type: 'triangle' })
      scheduleTone(context, { frequency: 523.25, start: now + 0.035, duration: 0.05, gain: 0.009, type: 'sine' })
      return
    case 'cardTest':
      scheduleTone(context, { frequency: 196, start: now, duration: 0.05, gain: 0.012, type: 'square' })
      scheduleTone(context, { frequency: 277.18, start: now + 0.045, duration: 0.05, gain: 0.008, type: 'triangle' })
      return
    case 'acceptedVerdict':
      scheduleTone(context, { frequency: 329.63, start: now, duration: 0.08, gain: 0.014, type: 'triangle' })
      scheduleTone(context, { frequency: 493.88, start: now + 0.06, duration: 0.1, gain: 0.012, type: 'sine' })
      return
    case 'rejectedVerdict':
      scheduleTone(context, { frequency: 246.94, start: now, duration: 0.08, gain: 0.012, type: 'sawtooth' })
      scheduleTone(context, { frequency: 196, start: now + 0.055, duration: 0.09, gain: 0.01, type: 'triangle' })
      return
    case 'ledgerEntry':
      scheduleTone(context, { frequency: 659.25, start: now, duration: 0.03, gain: 0.007, type: 'triangle' })
      scheduleTone(context, { frequency: 880, start: now + 0.045, duration: 0.025, gain: 0.0055, type: 'sine' })
      return
    case 'readyToName':
      scheduleTone(context, { frequency: 261.63, start: now, duration: 0.12, gain: 0.011, type: 'triangle' })
      scheduleTone(context, { frequency: 392, start: now + 0.11, duration: 0.16, gain: 0.011, type: 'sine' })
      scheduleTone(context, { frequency: 523.25, start: now + 0.2, duration: 0.18, gain: 0.01, type: 'triangle' })
      return
    case 'namingOpen':
      scheduleTone(context, { frequency: 220, start: now, duration: 0.08, gain: 0.009, type: 'triangle' })
      scheduleTone(context, { frequency: 293.66, start: now + 0.07, duration: 0.1, gain: 0.008, type: 'sine' })
      return
    case 'submitAccepted':
      scheduleTone(context, { frequency: 329.63, start: now, duration: 0.1, gain: 0.013, type: 'triangle' })
      scheduleTone(context, { frequency: 440, start: now + 0.075, duration: 0.12, gain: 0.011, type: 'sine' })
      scheduleTone(context, { frequency: 587.33, start: now + 0.16, duration: 0.16, gain: 0.0105, type: 'triangle' })
      return
    case 'submitRejected':
      scheduleTone(context, { frequency: 261.63, start: now, duration: 0.09, gain: 0.011, type: 'sawtooth' })
      scheduleTone(context, { frequency: 220, start: now + 0.07, duration: 0.11, gain: 0.009, type: 'triangle' })
      return
  }
}

export function createSoundEngine() {
  let context: AudioContextLike | null = null

  function getAudioContextCtor() {
    if (typeof window === 'undefined') {
      return null
    }

    return window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null
  }

  function ensureContext() {
    const AudioContextCtor = getAudioContextCtor()
    if (!AudioContextCtor) {
      return null
    }

    context ??= new AudioContextCtor()
    return context
  }

  async function arm() {
    const nextContext = ensureContext()
    if (!nextContext) {
      return false
    }

    if (nextContext.state === 'suspended') {
      await nextContext.resume()
    }

    return nextContext.state === 'running'
  }

  function play(cue: SoundCueId) {
    const nextContext = ensureContext()
    if (!nextContext || nextContext.state !== 'running') {
      return
    }

    scheduleCue(nextContext, cue)
  }

  return {
    arm,
    play,
  }
}

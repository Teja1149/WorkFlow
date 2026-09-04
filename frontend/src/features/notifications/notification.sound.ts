import { NotificationType } from './notification.types'

let audioUnlocked = false
let audioCtx: AudioContext | null = null
let cachedConversationWavUri: string | null = null
let cachedWorkWavUri: string | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
    }
  }
  return audioCtx
}

export function unlockNotificationSound() {
  const ctx = getAudioContext()
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    if (!audioUnlocked) {
      try {
        const buffer = ctx.createBuffer(1, 1, 22050)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start(0)
        audioUnlocked = true
      } catch {}
    }
  }
}

/**
 * Synthesizes a 16-bit PCM WAV Data URI from frequency notes
 */
function createWavDataUri(
  notes: Array<{ freq: number; start: number; dur: number; decay: number; harmonicScale?: number }>,
  duration: number,
  masterGain = 0.75,
): string {
  try {
    const sampleRate = 44100
    const numSamples = Math.floor(sampleRate * duration)
    const buffer = new ArrayBuffer(44 + numSamples * 2)
    const view = new DataView(buffer)

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + numSamples * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // Mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, numSamples * 2, true)

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      let sampleVal = 0

      for (const note of notes) {
        if (t >= note.start && t < note.start + note.dur) {
          const noteT = t - note.start
          const env = Math.exp(-note.decay * noteT) * (1 - Math.exp(-240 * noteT))
          const harmonic = note.harmonicScale ?? 0.25
          const tone =
            Math.sin(2 * Math.PI * note.freq * noteT) +
            harmonic * Math.sin(2 * Math.PI * note.freq * 2 * noteT) +
            (harmonic * 0.5) * Math.sin(2 * Math.PI * note.freq * 3 * noteT)
          sampleVal += tone * env
        }
      }

      const clamped = Math.max(-1, Math.min(1, sampleVal * masterGain))
      const s = clamped < 0 ? clamped * 32768 : clamped * 32767
      view.setInt16(44 + i * 2, s, true)
    }

    const bytes = new Uint8Array(buffer)
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return 'data:audio/wav;base64,' + btoa(binary)
  } catch {
    return ''
  }
}

/**
 * 1. Conversation sound: distinct double-tone chat chime (659Hz E5 -> 988Hz B5)
 */
function getConversationWavUri(): string {
  if (!cachedConversationWavUri) {
    cachedConversationWavUri = createWavDataUri(
      [
        { freq: 659.25, start: 0, dur: 0.14, decay: 18, harmonicScale: 0.2 },
        { freq: 987.77, start: 0.075, dur: 0.2, decay: 14, harmonicScale: 0.2 },
      ],
      0.3,
      0.7,
    )
  }
  return cachedConversationWavUri
}

/**
 * 2. Work/system sound: rich ascending chime (880Hz A5 -> 1318.5Hz E6)
 */
function getWorkWavUri(): string {
  if (!cachedWorkWavUri) {
    cachedWorkWavUri = createWavDataUri(
      [
        { freq: 880, start: 0, dur: 0.22, decay: 13, harmonicScale: 0.3 },
        { freq: 1318.51, start: 0.085, dur: 0.28, decay: 11, harmonicScale: 0.25 },
      ],
      0.38,
      0.75,
    )
  }
  return cachedWorkWavUri
}

function triggerWebAudioConversationSynth(ctx: AudioContext) {
  try {
    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(5000, now)

    const notes = [
      { freq: 659.25, delay: 0, dur: 0.14 },
      { freq: 987.77, delay: 0.075, dur: 0.2 },
    ]

    notes.forEach((n) => {
      const startTime = now + n.delay
      const osc = ctx.createOscillator()
      const oscHarmonic = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(n.freq, startTime)

      oscHarmonic.type = 'sine'
      oscHarmonic.frequency.setValueAtTime(n.freq * 2, startTime)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.75, startTime + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.dur)

      const gainHarmonic = ctx.createGain()
      gainHarmonic.gain.setValueAtTime(0.2, startTime)

      osc.connect(gain)
      oscHarmonic.connect(gainHarmonic)
      gainHarmonic.connect(gain)

      gain.connect(filter)

      osc.start(startTime)
      oscHarmonic.start(startTime)
      osc.stop(startTime + n.dur + 0.02)
      oscHarmonic.stop(startTime + n.dur + 0.02)
    })

    filter.connect(ctx.destination)
  } catch (e) {
    console.warn('[WebAudio Conversation Synth warning]:', e)
  }
}

function triggerWebAudioWorkSynth(ctx: AudioContext) {
  try {
    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(4200, now)

    const notes = [
      { freq: 880, delay: 0, dur: 0.2 },
      { freq: 1318.51, delay: 0.085, dur: 0.26 },
    ]

    notes.forEach((n) => {
      const startTime = now + n.delay
      const osc = ctx.createOscillator()
      const oscHarmonic = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(n.freq, startTime)

      oscHarmonic.type = 'sine'
      oscHarmonic.frequency.setValueAtTime(n.freq * 3, startTime)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.dur)

      const gainHarmonic = ctx.createGain()
      gainHarmonic.gain.setValueAtTime(0.25, startTime)

      osc.connect(gain)
      oscHarmonic.connect(gainHarmonic)
      gainHarmonic.connect(gain)

      gain.connect(filter)

      osc.start(startTime)
      oscHarmonic.start(startTime)
      osc.stop(startTime + n.dur + 0.02)
      oscHarmonic.stop(startTime + n.dur + 0.02)
    })

    filter.connect(ctx.destination)
  } catch (e) {
    console.warn('[WebAudio Work Synth warning]:', e)
  }
}

/**
 * Plays the short, distinct Conversation chime (for MESSAGE_RECEIVED)
 */
export function playConversationNotificationSound() {
  unlockNotificationSound()

  const ctx = getAudioContext()
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        triggerWebAudioConversationSynth(ctx)
      })
    } else {
      triggerWebAudioConversationSynth(ctx)
    }
  }

  try {
    const wavUri = getConversationWavUri()
    if (wavUri) {
      const audio = new Audio(wavUri)
      audio.volume = 1.0
      void audio.play().catch(() => {})
    }
  } catch {}
}

/**
 * Plays the Work/System notification chime
 */
export function playWorkNotificationSound() {
  unlockNotificationSound()

  const ctx = getAudioContext()
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        triggerWebAudioWorkSynth(ctx)
      })
    } else {
      triggerWebAudioWorkSynth(ctx)
    }
  }

  try {
    const wavUri = getWorkWavUri()
    if (wavUri) {
      const audio = new Audio(wavUri)
      audio.volume = 1.0
      void audio.play().catch(() => {})
    }
  } catch {}
}

/**
 * Universal notification sound dispatcher based on notification type
 */
export function playNotificationSound(type?: string) {
  if (type === NotificationType.MESSAGE_RECEIVED || type === 'MESSAGE_RECEIVED') {
    return playConversationNotificationSound()
  }
  return playWorkNotificationSound()
}
let audioUnlocked = false
let audioCtx: AudioContext | null = null
let cachedWavUri: string | null = null

export type SoundPresetId = 1 | 2 | 3 | 4 | 5

export function setSoundPreset(_id: SoundPresetId) {
  // Sound is fixed to Pentatonic Marimba
}

export function getActiveSoundPreset(): SoundPresetId {
  return 4 // Pentatonic Marimba
}

/**
 * Synthesizes a crisp Pentatonic Marimba chime 16-bit PCM WAV Data URI
 */
function getMarimbaWavUri(): string {
  if (cachedWavUri) return cachedWavUri

  try {
    const sampleRate = 44100
    const duration = 0.38
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

    // Pentatonic Marimba Notes: A5 (880Hz) at 0s, E6 (1318.5Hz) at 0.085s
    const notes = [
      { freq: 880, start: 0, dur: 0.22 },
      { freq: 1318.51, start: 0.085, dur: 0.26 },
    ]

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      let sampleVal = 0

      for (const note of notes) {
        if (t >= note.start && t < note.start + note.dur) {
          const noteT = t - note.start
          const env = Math.exp(-14 * noteT) * (1 - Math.exp(-220 * noteT))
          const tone = Math.sin(2 * Math.PI * note.freq * noteT) + 0.25 * Math.sin(2 * Math.PI * note.freq * 3 * noteT)
          sampleVal += tone * env
        }
      }

      const clamped = Math.max(-1, Math.min(1, sampleVal * 0.75))
      const s = clamped < 0 ? clamped * 32768 : clamped * 32767
      view.setInt16(44 + i * 2, s, true)
    }

    const bytes = new Uint8Array(buffer)
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    cachedWavUri = 'data:audio/wav;base64,' + btoa(binary)
    return cachedWavUri
  } catch {
    return ''
  }
}

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

function triggerWebAudioSynth(ctx: AudioContext) {
  try {
    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(4200, now)

    const notes = [
      { freq: 880, delay: 0, dur: 0.2 },        // A5
      { freq: 1318.51, delay: 0.085, dur: 0.24 }, // E6
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
    console.warn('WebAudio synth warning:', e)
  }
}

/**
 * Plays the Pentatonic Marimba Notification Sound for all notifications.
 * Uses WebAudio API synthesizer as primary + HTML5 Audio fallback.
 */
export function playNotificationSound() {
  unlockNotificationSound()

  // Primary: Web Audio API Oscillator Synthesizer
  const ctx = getAudioContext()
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        triggerWebAudioSynth(ctx)
      })
    } else {
      triggerWebAudioSynth(ctx)
    }
  }

  // Secondary Fallback: Fresh HTML5 Audio instance
  try {
    const wavUri = getMarimbaWavUri()
    if (wavUri) {
      const audio = new Audio(wavUri)
      audio.volume = 1.0
      void audio.play().catch(() => {
        // Autoplay policy handled by WebAudio API
      })
    }
  } catch {}
}

// Aliases for compatibility
export const playPreset1 = playNotificationSound
export const playPreset2 = playNotificationSound
export const playPreset3 = playNotificationSound
export const playPreset4 = playNotificationSound
export const playPreset5 = playNotificationSound
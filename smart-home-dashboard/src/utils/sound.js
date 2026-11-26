// High-tech synthesized audio feedback using Web Audio API (0 external assets needed)

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function isSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('shd_sound_feedback') !== 'false'
}

export function setSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem('shd_sound_feedback', enabled ? 'true' : 'false')
}

/**
 * Plays a pleasant, subtle futuristic switch sound
 * @param {boolean} isOn - whether turning ON or OFF
 */
export function playSwitchSound(isOn) {
  if (!isSoundEnabled()) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    gain.connect(ctx.destination)
    osc.connect(gain)

    if (isOn) {
      // Ascending sleek chirp: 540Hz -> 820Hz
      osc.frequency.setValueAtTime(540, now)
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.05)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      osc.start(now)
      osc.stop(now + 0.07)
    } else {
      // Descending soft chirp: 750Hz -> 420Hz
      osc.frequency.setValueAtTime(750, now)
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.05)
      gain.gain.setValueAtTime(0.035, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      osc.start(now)
      osc.stop(now + 0.07)
    }
  } catch {
    // AudioContext blocked or not supported - fail silently
  }
}

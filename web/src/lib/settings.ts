export type Mode = 'browser' | 'server'

export interface Settings {
  mode: Mode
  nebiusKey: string
  alphaVantageKey: string
  serperKey: string
  baseUrl: string
  model: string
  serverUrl: string
  remember: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'browser',
  nebiusKey: '',
  alphaVantageKey: '',
  serperKey: '',
  baseUrl: 'https://api.tokenfactory.nebius.com/v1',
  model: 'Qwen/Qwen3-14B',
  serverUrl: '',
  remember: false,
}

const KEY = 'ahf.settings'

/**
 * Keys never leave the browser except to the provider APIs themselves.
 * They live in sessionStorage by default, or localStorage when "remember" is on.
 */
export function loadSettings(): Settings {
  for (const store of [safe(() => localStorage), safe(() => sessionStorage)]) {
    const raw = safe(() => store?.getItem(KEY))
    if (raw) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      } catch {
        /* ignore corrupt settings */
      }
    }
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: Settings) {
  const json = JSON.stringify(settings)
  safe(() => {
    if (settings.remember) {
      localStorage.setItem(KEY, json)
      sessionStorage.removeItem(KEY)
    } else {
      sessionStorage.setItem(KEY, json)
      localStorage.removeItem(KEY)
    }
  })
}

export function isReady(s: Settings): boolean {
  return s.mode === 'server' ? /^https?:\/\//.test(s.serverUrl) : Boolean(s.nebiusKey && s.model && s.baseUrl)
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

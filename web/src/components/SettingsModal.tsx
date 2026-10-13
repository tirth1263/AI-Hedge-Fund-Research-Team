import { useEffect, useState } from 'react'
import { NebiusAIService } from '@services/nebius-ai/NebiusAIService'
import type { Settings } from '../lib/settings'

const SUGGESTED_MODELS = [
  'Qwen/Qwen3-14B',
  'Qwen/Qwen3-32B',
  'Qwen/Qwen3-235B-A22B-Instruct-2507',
  'meta-llama/Llama-3.3-70B-Instruct',
  'deepseek-ai/DeepSeek-V3-0324',
]

interface Props {
  initial: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}

export function SettingsModal({ initial, onSave, onClose }: Props) {
  const [s, setS] = useState<Settings>(initial)
  const [models, setModels] = useState<string[]>(SUGGESTED_MODELS)
  const [modelStatus, setModelStatus] = useState<string | null>(null)
  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loadModels = async () => {
    setModelStatus('Loading…')
    try {
      const list = await new NebiusAIService({ apiKey: s.nebiusKey, baseUrl: s.baseUrl, model: s.model }).listModels()
      setModels(list)
      setModelStatus(`${list.length} models available to your key`)
    } catch (err) {
      setModelStatus(`Could not load models: ${(err as Error).message}`)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="panel-head">
          <h3 id="settings-title">⚙️ Settings &amp; API keys</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <div className="segmented" role="tablist">
            <button className={s.mode === 'browser' ? 'active' : ''} onClick={() => update('mode', 'browser')}>
              🌐 Run in browser
            </button>
            <button className={s.mode === 'server' ? 'active' : ''} onClick={() => update('mode', 'server')}>
              🖥️ Motia server
            </button>
          </div>

          {s.mode === 'browser' ? (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Agents run right here in your browser. Keys go straight from your browser to each provider and never to any other server.
              </p>
              <div className="field">
                <label htmlFor="nebius">
                  Nebius AI Studio key <a href="https://tokenfactory.nebius.com" target="_blank" rel="noreferrer">get a key ↗</a>
                </label>
                <input id="nebius" type="password" autoComplete="off" placeholder="Required" value={s.nebiusKey} onChange={(e) => update('nebiusKey', e.target.value.trim())} />
              </div>
              <div className="field">
                <label htmlFor="model">
                  Model
                  <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px' }} disabled={!s.nebiusKey} onClick={loadModels}>
                    Load my models
                  </button>
                </label>
                <input id="model" list="model-list" value={s.model} onChange={(e) => update('model', e.target.value)} />
                <datalist id="model-list">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {modelStatus && <span className="hint">{modelStatus}</span>}
              </div>
              <div className="field">
                <label htmlFor="av">
                  Alpha Vantage key <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer">free key ↗</a>
                </label>
                <input id="av" type="password" autoComplete="off" placeholder="Optional: real-time quotes & fundamentals" value={s.alphaVantageKey} onChange={(e) => update('alphaVantageKey', e.target.value.trim())} />
              </div>
              <div className="field">
                <label htmlFor="serper">
                  Serper key <a href="https://serper.dev" target="_blank" rel="noreferrer">free key ↗</a>
                </label>
                <input id="serper" type="password" autoComplete="off" placeholder="Optional: Google web & news search" value={s.serperKey} onChange={(e) => update('serperKey', e.target.value.trim())} />
              </div>
              <details>
                <summary className="hint" style={{ cursor: 'pointer', marginBottom: 10 }}>
                  Advanced
                </summary>
                <div className="field">
                  <label htmlFor="base">Nebius base URL</label>
                  <input id="base" value={s.baseUrl} onChange={(e) => update('baseUrl', e.target.value.trim())} />
                </div>
              </details>
            </>
          ) : (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Connect to your own deployed Motia backend (see the Docker guide in the README). Keys stay on the server, and the dashboard calls <code>POST /finance-query</code> and polls <code>GET /finance-result/:traceId</code>.
              </p>
              <div className="field">
                <label htmlFor="server">Motia server URL</label>
                <input id="server" placeholder="https://your-motia-app.example.com" value={s.serverUrl} onChange={(e) => update('serverUrl', e.target.value.trim())} />
              </div>
            </>
          )}

          <label className="check">
            <input type="checkbox" checked={s.remember} onChange={(e) => update('remember', e.target.checked)} />
            Remember on this device (localStorage). Otherwise settings are cleared when you close this tab.
          </label>

          <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => onSave(s)}>
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

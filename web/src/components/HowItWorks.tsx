const AGENTS = [
  { icon: '🔎', color: '#1e3a8a', name: 'Web Search Agent', text: 'Searches Google web and news via Serper for fresh catalysts, earnings coverage and sentiment.' },
  { icon: '💹', color: '#064e3b', name: 'Finance Data Agent', text: 'Pulls real-time quotes, fundamentals and 100 days of prices from Alpha Vantage, then computes RSI, MACD, Bollinger bands, volatility, drawdown and VaR.' },
  { icon: '🧭', color: '#3b0764', name: 'Head of Research (Nebius AI)', text: 'Writes the general market brief: snapshot, sector context, recent developments and key questions for the team.' },
  { icon: '📊', color: '#1e40af', name: 'Fundamental Analyst', text: 'Valuation multiples, profitability, growth drivers and a fair value range.' },
  { icon: '📈', color: '#065f46', name: 'Technical Analyst', text: 'Trend structure, momentum, support/resistance and a concrete trade setup.' },
  { icon: '🛡️', color: '#7f1d1d', name: 'Risk Manager', text: 'Market and event risks, a risk matrix, stop levels and hedging ideas.' },
  { icon: '💼', color: '#78350f', name: 'Portfolio Manager', text: 'Position sizing for different risk profiles, entry/exit plan and diversification.' },
  { icon: '🏛️', color: '#334155', name: 'Investment Committee', text: 'Synthesizes every analysis into a final rating, confidence score, thesis and key risks.' },
]

const FEATURES = [
  ['⚡ Parallel processing', 'Data collection and the four specialist agents run concurrently.'],
  ['🧩 Event-driven steps', 'Built on Motia: every agent is an isolated step wired together by topics.'],
  ['🧠 State management', 'Trace-isolated state persists data across steps; results indexed by traceId.'],
  ['🩹 Graceful degradation', 'If a data source or agent fails, the rest of the team keeps working.'],
  ['🔒 Type safety', 'Zod-validated inputs and shared TypeScript types across backend and UI.'],
  ['🐳 Deploy anywhere', 'Docker image for the Motia backend; this static dashboard runs on GitHub Pages.'],
]

export function HowItWorks() {
  return (
    <section id="how" className="section">
      <h2 className="section-title">Meet the research team</h2>
      <p className="section-sub">
        Eight specialized AI agents, orchestrated as an event-driven Motia workflow and powered by open models on Nebius AI Studio.
      </p>
      <div className="agents">
        {AGENTS.map((a) => (
          <div className="panel agent" key={a.name}>
            <div className="icon" style={{ background: a.color }}>
              {a.icon}
            </div>
            <h4>{a.name}</h4>
            <p>{a.text}</p>
          </div>
        ))}
      </div>
      <div className="features">
        {FEATURES.map(([title, text]) => (
          <div className="panel feature" key={title}>
            <b>{title}</b>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

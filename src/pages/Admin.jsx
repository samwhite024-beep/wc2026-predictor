import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcPoints, flag, STAGE_COLORS } from '../lib/scoring'

const CORRECT_PIN = import.meta.env.VITE_ADMIN_PIN || 'MARSH2026'

export default function Admin() {
  const [authed, setAuthed]   = useState(() => sessionStorage.getItem('admin_auth') === 'yes')
  const [pin, setPin]         = useState('')
  const [pinErr, setPinErr]   = useState('')

  const [matches, setMatches] = useState([])
  const [lb, setLb]           = useState([])
  const [scores, setScores]   = useState({})   // matchId → { home, away }
  const [saving, setSaving]   = useState(null) // matchId being saved
  const [activeStage, setActive] = useState(null)
  const [flash, setFlash]     = useState('')

  const fetchData = useCallback(async () => {
    const [{ data: mData }, { data: lbData }] = await Promise.all([
      supabase.from('matches').select('*').order('match_num'),
      supabase.from('leaderboard').select('*'),
    ])
    if (mData) {
      setMatches(mData)
      const map = {}
      mData.forEach(m => {
        map[m.id] = { home: m.home_score ?? '', away: m.away_score ?? '' }
      })
      setScores(map)
      if (!activeStage && mData.length > 0) setActive(mData[0].stage)
    }
    if (lbData) setLb(lbData)
  }, [activeStage])

  useEffect(() => { if (authed) fetchData() }, [authed, fetchData])

  const handlePin = (e) => {
    e.preventDefault()
    if (pin === CORRECT_PIN) {
      sessionStorage.setItem('admin_auth', 'yes')
      setAuthed(true)
    } else {
      setPinErr('Incorrect PIN')
      setPin('')
    }
  }

  const saveResult = async (match) => {
    const sc = scores[match.id]
    const home = parseInt(sc.home)
    const away = parseInt(sc.away)
    if (isNaN(home) || isNaN(away)) return
    setSaving(match.id)
    try {
      // Save result
      await supabase.from('matches').update({ home_score: home, away_score: away }).eq('id', match.id)

      // Recalculate points for all predictions of this match
      const { data: preds } = await supabase.from('predictions')
        .select('id, home_pred, away_pred')
        .eq('match_id', match.id)

      if (preds && preds.length > 0) {
        const updates = preds.map(p => ({
          id: p.id,
          points: calcPoints(p.home_pred, p.away_pred, home, away),
        }))
        await supabase.from('predictions').upsert(updates)
      }

      setFlash(`✅ Saved: ${match.home_team} ${home}–${away} ${match.away_team}`)
      setTimeout(() => setFlash(''), 3000)
      await fetchData()
    } finally {
      setSaving(null)
    }
  }

  const toggleRound = async (stage, open) => {
    await supabase.from('matches').update({ is_open: open }).eq('stage', stage)
    await fetchData()
    setFlash(`${open ? '🔓 Opened' : '🔒 Closed'} predictions for ${stage}`)
    setTimeout(() => setFlash(''), 3000)
  }

  if (!authed) return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="card text-center space-y-5">
        <div className="text-5xl">🔐</div>
        <h2 className="text-xl font-black">Admin Access</h2>
        <form onSubmit={handlePin} className="space-y-3">
          <input
            type="password"
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg text-center tracking-widest focus:border-brand focus:outline-none"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
          />
          {pinErr && <p className="text-red-600 text-sm">{pinErr}</p>}
          <button type="submit" className="btn-primary w-full py-3">Enter</button>
        </form>
      </div>
    </div>
  )

  const stages = [...new Set(matches.map(m => m.stage))]
  const stageMatches = matches.filter(m => m.stage === activeStage)
  const totalPlayed = matches.filter(m => m.home_score != null).length
  const totalGoals  = matches.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0)

  const statCards = [
    { icon: '👥', label: 'Players', value: lb.length },
    { icon: '⚽', label: 'Played', value: `${totalPlayed}/104` },
    { icon: '🎯', label: 'Goals', value: totalGoals },
    { icon: '🥇', label: 'Leader', value: lb[0]?.name ?? '—', sub: lb[0] ? `${lb[0].total_points}pts` : '' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">⚙️ Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Enter results · Points auto-calculate for all {lb.length} players</p>
        </div>
        <button onClick={() => { sessionStorage.removeItem('admin_auth'); setAuthed(false) }}
          className="text-xs text-gray-400 hover:text-gray-600 underline">Log out</button>
      </div>

      {flash && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
          {flash}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ icon, label, value, sub }) => (
          <div key={label} className="card text-center py-4">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl font-black text-brand">{value}</div>
            {sub && <div className="text-xs text-gray-400">{sub}</div>}
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Mini leaderboard */}
      <div className="card">
        <h3 className="font-bold mb-3">Live Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                {['#','Player','Pts','Exact','Correct','Wrong','Predicted'].map(h => (
                  <th key={h} className="px-3 py-2 text-center first:text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lb.slice(0, 10).map((p, i) => (
                <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold">{['🥇','🥈','🥉'][i] ?? i+1}</td>
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2 text-center font-black text-brand">{p.total_points}</td>
                  <td className="px-3 py-2 text-center text-green-700">{p.exact_scores}</td>
                  <td className="px-3 py-2 text-center text-amber-600">{p.correct_results}</td>
                  <td className="px-3 py-2 text-center text-red-500">{p.wrong}</td>
                  <td className="px-3 py-2 text-center text-gray-400">{p.predictions_made}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result entry */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg">Enter Match Results</h3>

        {/* Stage tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {stages.map(stage => {
            const stageMs = matches.filter(m => m.stage === stage)
            const played  = stageMs.filter(m => m.home_score != null).length
            const isOpen  = stageMs[0]?.is_open
            return (
              <button key={stage} type="button" onClick={() => setActive(stage)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${activeStage === stage ? 'text-white shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                style={activeStage === stage ? { background: STAGE_COLORS[stage], borderColor: STAGE_COLORS[stage] } : {}}>
                {stage} ({played}/{stageMs.length}) {isOpen ? '🔓' : '🔒'}
              </button>
            )
          })}
        </div>

        {/* Open/close round */}
        {activeStage && (
          <div className="flex items-center gap-3">
            {stageMatches[0]?.is_open ? (
              <button onClick={() => toggleRound(activeStage, false)} className="btn-secondary text-xs px-3 py-1.5">
                🔒 Close predictions for {activeStage}
              </button>
            ) : (
              <button onClick={() => toggleRound(activeStage, true)} className="btn-primary text-xs px-3 py-1.5">
                🔓 Open predictions for {activeStage}
              </button>
            )}
          </div>
        )}

        {/* Match result rows */}
        <div className="space-y-2">
          {stageMatches.map(match => {
            const sc = scores[match.id] ?? { home: '', away: '' }
            const saved = match.home_score != null
            return (
              <div key={match.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                  ${saved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'} shadow-sm`}>
                <span className="text-xs text-gray-400 w-10 text-center font-mono">#{match.match_num}</span>
                <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                  <span className="text-sm font-semibold text-right truncate">
                    {flag(match.home_team)} {match.home_team}
                  </span>
                  <input type="number" min="0" max="30"
                    className="score-input text-base"
                    value={sc.home}
                    onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], home: e.target.value } }))}
                  />
                  <span className="text-gray-400 font-bold text-lg">—</span>
                  <input type="number" min="0" max="30"
                    className="score-input text-base"
                    value={sc.away}
                    onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], away: e.target.value } }))}
                  />
                  <span className="text-sm font-semibold truncate">
                    {match.away_team} {flag(match.away_team)}
                  </span>
                </div>
                <button
                  onClick={() => saveResult(match)}
                  disabled={saving === match.id || sc.home === '' || sc.away === ''}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
                    ${saved ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-brand text-white hover:bg-brand-dark'}
                    disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {saving === match.id ? '…' : saved ? '✓ Update' : 'Save'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

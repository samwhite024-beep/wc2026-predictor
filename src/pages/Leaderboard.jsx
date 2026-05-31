import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts'

const MEDALS = ['🥇', '🥈', '🥉']
const FORM_EMOJI = { 3: '🟢', 1: '🟡', 0: '🔴' }

export default function Leaderboard() {
  const [lb, setLb]         = useState([])
  const [matches, setMatches]   = useState([])
  const [allPreds, setAllPreds] = useState([])
  const [tab, setTab]       = useState('table')
  const [loading, setLoading]   = useState(true)

  const fetchAll = useCallback(async () => {
    const [{ data: lbData }, { data: mData }, { data: pData }] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('*').not('home_score', 'is', null).order('match_num'),
      supabase.from('predictions').select('participant_id, match_id, home_pred, away_pred, points'),
    ])
    if (lbData)  setLb(lbData)
    if (mData)   setMatches(mData)
    if (pData)   setAllPreds(pData)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const sub = supabase.channel('lb-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchAll)
      .subscribe()
    return () => sub.unsubscribe()
  }, [fetchAll])

  // Form guide: last 5 scored matches per participant
  const formGuide = useCallback((participantId) => {
    const played = matches.slice().reverse().slice(0, 5)
    return played.map(m => {
      const p = allPreds.find(p => p.participant_id === participantId && p.match_id === m.id)
      return p?.points != null ? FORM_EMOJI[p.points] ?? '⚫' : '⚫'
    }).reverse()
  }, [matches, allPreds])

  // Lucky vs skilled data
  const scatterData = lb.map(p => ({
    name: p.name,
    x: Number(p.correct_results) || 0,
    y: Number(p.exact_scores) || 0,
    pts: Number(p.total_points) || 0,
  }))

  // Biggest upsets
  const upsets = matches.map(m => {
    const matchPreds = allPreds.filter(p => p.match_id === m.id && p.points != null)
    const total = matchPreds.length
    const wrong = matchPreds.filter(p => p.points === 0).length
    const pct = total > 0 ? wrong / total : 0
    return { match: m, wrong, total, pct, exact: matchPreds.filter(p => p.points === 3).length }
  }).filter(u => u.total > 0).sort((a, b) => b.pct - a.pct).slice(0, 5)

  const totalPlayed = matches.length
  const totalGoals  = matches.reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0)

  const statCards = [
    { icon: '👥', label: 'Players', value: lb.length },
    { icon: '⚽', label: 'Matches Played', value: `${totalPlayed} / 104` },
    { icon: '🎯', label: 'Total Goals', value: totalGoals },
    { icon: '🥇', label: 'Leader', value: lb[0]?.name ?? '—', sub: lb[0] ? `${lb[0].total_points} pts` : '' },
  ]

  const TABS = [
    { id: 'table',  label: '📋 Table' },
    { id: 'chart',  label: '📊 Chart' },
    { id: 'form',   label: '📈 Form' },
    { id: 'scatter',label: '🎯 Lucky/Skilled' },
    { id: 'upsets', label: '🚨 Upsets' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading leaderboard…</div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      <h1 className="text-2xl font-black">🏆 Leaderboard</h1>

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

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap border-b border-gray-200 pb-px">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${tab === id ? 'bg-brand text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {tab === 'table' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-white">
                {['#', 'Player', 'Points', 'Exact', 'Correct', 'Wrong', 'Predicted'].map(h => (
                  <th key={h} className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lb.map((p, i) => (
                <tr key={p.id} className={`border-t border-gray-100 ${i < 3 ? 'bg-yellow-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 text-center font-bold w-10">{MEDALS[i] ?? i + 1}</td>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 text-center font-black text-brand text-base">{p.total_points}</td>
                  <td className="px-4 py-3 text-center text-green-700 font-semibold">{p.exact_scores}</td>
                  <td className="px-4 py-3 text-center text-amber-700">{p.correct_results}</td>
                  <td className="px-4 py-3 text-center text-red-600">{p.wrong}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.predictions_made}</td>
                </tr>
              ))}
              {lb.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No predictions scored yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bar chart */}
      {tab === 'chart' && (
        <div className="card">
          <h3 className="font-bold mb-4">Points by Player</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, lb.length * 36)}>
            <BarChart data={lb.map(p => ({ name: p.name, pts: Number(p.total_points) }))}
              layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`${v} pts`, 'Points']} />
              <Bar dataKey="pts" radius={[0, 4, 4, 0]}>
                {lb.map((_, i) => <Cell key={i} fill={i === 0 ? '#C62828' : i === 1 ? '#9E9E9E' : i === 2 ? '#795548' : '#1565C0'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Form guide */}
      {tab === 'form' && (
        <div className="card">
          <h3 className="font-bold mb-1">Last 5 Results Per Player</h3>
          <p className="text-xs text-gray-400 mb-4">🟢 Exact  🟡 Correct result  🔴 Wrong  ⚫ Not yet played</p>
          <div className="space-y-2">
            {lb.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-gray-50">
                <span className="w-6 text-sm font-bold text-gray-400">{i + 1}</span>
                <span className="w-32 font-semibold text-sm truncate">{p.name}</span>
                <span className="font-black text-brand text-sm w-14">{p.total_points} pts</span>
                <div className="flex gap-1.5 text-xl">
                  {formGuide(p.id).map((e, j) => <span key={j}>{e}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scatter: lucky vs skilled */}
      {tab === 'scatter' && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-bold">Lucky vs Skilled</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              X = correct results (1pt) · Y = exact scores (3pt) ·
              <span className="text-green-600 font-semibold"> Top-right = skilled</span>
              <span className="text-amber-600 font-semibold"> · Bottom-right = lucky</span>
            </p>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid />
              <XAxis dataKey="x" name="Correct Results" type="number" label={{ value: 'Correct Results →', position: 'insideBottom', offset: -10 }} />
              <YAxis dataKey="y" name="Exact Scores"    type="number" label={{ value: 'Exact Scores', angle: -90, position: 'insideLeft' }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => payload?.[0] ? (
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow">
                    <p className="font-bold">{payload[0].payload.name}</p>
                    <p>Exact: {payload[0].payload.y} · Correct: {payload[0].payload.x}</p>
                    <p className="text-brand font-semibold">Total: {payload[0].payload.pts} pts</p>
                  </div>
                ) : null} />
              <Scatter data={scatterData} fill="#C62828">
                {scatterData.map((_, i) => <Cell key={i} fill={i === 0 ? '#C62828' : '#1565C0'} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {[
              ['Top-right ⭐', 'Skilled', 'bg-green-50 text-green-800'],
              ['Bottom-right 🍀', 'Lucky', 'bg-amber-50 text-amber-800'],
              ['Top-left 💎', 'Unlucky', 'bg-blue-50 text-blue-800'],
              ['Bottom-left 😬', 'Struggling', 'bg-red-50 text-red-800'],
            ].map(([q, l, cls]) => (
              <div key={q} className={`rounded-lg px-2 py-2 font-semibold ${cls}`}>{q}<br/>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* Biggest upsets */}
      {tab === 'upsets' && (
        <div className="card">
          <h3 className="font-bold mb-4">🚨 Biggest Upsets — Matches Most People Got Wrong</h3>
          {upsets.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No results entered yet</p>
          ) : (
            <div className="space-y-3">
              {upsets.map(({ match: m, wrong, total, pct, exact }, i) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                  <span className="text-2xl w-8 text-center">{['💥','😱','😬','😐','🤔'][i]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.home_team} {m.home_score}–{m.away_score} {m.away_team}</p>
                    <p className="text-xs text-gray-500">{m.stage} · {m.match_date}</p>
                    <div className="mt-1 bg-gray-200 rounded-full h-1.5 w-full">
                      <div className="bg-brand h-1.5 rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-black text-brand text-lg">{Math.round(pct * 100)}%</p>
                    <p className="text-gray-500">wrong ({wrong}/{total})</p>
                    <p className="text-green-600">{exact} exact</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

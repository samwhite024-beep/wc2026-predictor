import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Leaderboard({ currentPlayer }) {
  const [rows, setRows] = useState([])
  const [sortKey, setSortKey] = useState('rank')
  const [sortAsc, setSortAsc] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true })
      if (data) {
        setRows(data)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'rank') return sortAsc ? a.rank - b.rank : b.rank - a.rank
    const ak = a[sortKey] ?? 0
    const bk = b[sortKey] ?? 0
    return sortAsc ? ak - bk : bk - ak
  })

  const me = rows.find(r => r.name === currentPlayer?.name)
  const leader = rows[0]

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return ''
  }

  const SortHeader = ({ label, col }) => {
    const active = sortKey === col
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest transition-colors
          ${active ? 'text-gold' : 'text-faint hover:text-muted'}`}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </button>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-3">MARSH OFFICE LEAGUE · {rows.length} PLAYERS</p>
        <h1 className="font-display font-black text-5xl tracking-tight">Standings</h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Leaderboard table (2 cols) */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-surface-3 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-faint">Loading...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-3">
                    <th className="px-4 py-3 text-left text-xs font-bold text-faint uppercase tracking-widest w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-faint uppercase tracking-widest">Player</th>
                    <SortHeader label="P" col="total_predictions" />
                    <SortHeader label="Exact" col="exact_scores" />
                    <SortHeader label="Correct" col="correct_results" />
                    <SortHeader label="Pts" col="total_points" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => {
                    const isYou = row.name === currentPlayer?.name
                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-surface-3 transition-colors
                          ${isYou ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}
                      >
                        <td className="px-4 py-3 font-bold text-lg text-gold">
                          {getMedalEmoji(row.rank) || row.rank}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                              ${isYou
                                ? 'bg-gradient-to-br from-pink via-orange-500 to-gold text-black'
                                : 'bg-surface-3 text-muted'}`}>
                              {row.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-sm">
                              <div className={`font-medium ${isYou ? 'text-gold' : 'text-text'}`}>
                                {row.name}
                                {isYou && <span className="text-xs text-muted ml-1">· you</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-muted tabular-nums">{row.total_predictions ?? 0}</td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-green tabular-nums">{row.exact_scores ?? 0}</td>
                        <td className="px-3 py-3 text-right text-sm text-gold tabular-nums">{row.correct_results ?? 0}</td>
                        <td className="px-4 py-3 text-right font-display font-bold text-lg tabular-nums"
                          style={{ color: isYou || row.rank === 1 ? '#FFC23D' : '#F4F1EA' }}>
                          {row.total_points ?? 0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Your stats (1 col) */}
        <div className="space-y-6">
          {/* Your run */}
          <div className="card">
            <div className="mb-4">
              <p className="eyebrow mb-2">YOUR RUN</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-3xl text-gold">{me?.total_points ?? 0} pts</span>
                <span className="text-lg font-display font-bold text-text">· #{me?.rank ?? '—'}</span>
              </div>
            </div>

            {/* Simple sparkline placeholder */}
            <div className="mb-4 py-4 border-t border-surface-3">
              <svg width="100%" height="60" viewBox="0 0 300 60" className="w-full">
                <defs>
                  <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7A50A" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#F7A50A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  points="10,50 50,40 90,35 130,30 170,25 210,20 250,15 290,12"
                  fill="none"
                  stroke="#F7A50A"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M 10,50 L 50,40 L 90,35 L 130,30 L 170,25 L 210,20 L 250,15 L 290,12 L 290,60 L 10,60 Z"
                  fill="url(#sparkfill)"
                />
                <circle cx="290" cy="12" r="3" fill="#F7A50A" />
              </svg>
              <div className="flex justify-between text-xs text-muted mt-2 px-1">
                <span>R1</span>
                <span>Now</span>
              </div>
            </div>

            {/* Stats breakdown */}
            <div className="space-y-2 border-t border-surface-3 pt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green" />
                  <span className="text-muted">Exact scores</span>
                </div>
                <span className="font-bold text-text">{me?.exact_scores ?? 0} × 3 pts</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold" />
                  <span className="text-muted">Correct results</span>
                </div>
                <span className="font-bold text-text">{me?.correct_results ?? 0} × 1 pt</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-faint" />
                  <span className="text-muted">Missed</span>
                </div>
                <span className="font-bold text-text">{me?.missed ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Catch the leader */}
          {me && leader && me.name !== leader.name && (
            <div className="card">
              <h3 className="font-display font-bold text-lg mb-2">Catch the leader</h3>
              <p className="text-sm text-muted mb-4">
                You're <strong className="text-text">{leader.total_points - me.total_points} points</strong> behind {leader.name}.
                Two exact scorelines this round puts you top.
              </p>
              <Link to="/predict" className="btn-primary w-full justify-center text-sm">
                Make your picks →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

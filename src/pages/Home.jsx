import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEADLINE = new Date(import.meta.env.VITE_DEADLINE || '2026-06-10T20:00:00')

function useCountdown(target) {
  const calc = () => {
    const diff = target - Date.now()
    if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      expired: false,
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000)  / 60000),
      seconds: Math.floor((diff % 60000)    / 1000),
    }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

export default function Home({ currentPlayer, setCurrentPlayer }) {
  // Name entry screen
  if (!currentPlayer) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12 gap-8">
        <div className="text-center">
          <p className="eyebrow mb-3">World Cup · 26</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-3 leading-tight">
            Make your<br />
            <span className="gradient-text">predictions.</span>
          </h1>
          <p className="text-muted text-lg">Enter your name to load existing picks or start fresh.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = e.target.name.value.trim()
            if (!name) return
            const player = { name }
            localStorage.setItem('wc2026_player', JSON.stringify(player))
            setCurrentPlayer(player)
          }}
          className="flex gap-2 w-full max-w-sm"
        >
          <input
            name="name"
            placeholder="Your name"
            required
            className="flex-1 px-4 py-3 rounded-xl border border-surface-3 bg-surface-2 text-text
                       placeholder-faint focus:outline-none focus:border-gold font-body"
          />
          <button type="submit" className="btn-primary">Go →</button>
        </form>
      </div>
    )
  }

  const [standing, setStanding] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 72 })
  const [lastResult, setLastResult] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('rank')
  const [sortAsc, setSortAsc] = useState(true)
  const countdown = useCountdown(DEADLINE)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // Leaderboard
      const { data: board } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
      if (board) {
        const withRank = board.map((row, i) => ({
          ...row,
          rank: i + 1,
          total_predictions: row.predictions_made,
          missed: row.wrong,
        }))
        setLeaderboard(withRank)

        // Find current player's standing
        const playerRow = withRank.find(r => r.name === currentPlayer.name)
        if (playerRow) {
          setStanding({
            rank: playerRow.rank,
            pts: playerRow.total_points,
          })
        }
      }

      // Get participant ID for progress
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('name', currentPlayer.name)
        .single()

      if (participant) {
        const { count } = await supabase
          .from('predictions')
          .select('*', { count: 'exact', head: true })
          .eq('participant_id', participant.id)
          .not('home_pred', 'is', null)
        setProgress({ done: count ?? 0, total: 72 })
      }

      // Last result
      const { data: results } = await supabase
        .from('matches')
        .select('home_team, away_team, home_score, away_score')
        .not('home_score', 'is', null)
        .order('match_date', { ascending: false })
        .limit(1)
      if (results?.[0]) {
        const r = results[0]
        setLastResult({
          home: r.home_team,
          away: r.away_team,
          homeScore: r.home_score,
          awayScore: r.away_score,
        })
      }

      setLoading(false)
    }
    fetchData()
  }, [currentPlayer?.name])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sorted = [...leaderboard].sort((a, b) => {
    if (sortKey === 'rank') return sortAsc ? a.rank - b.rank : b.rank - a.rank
    const ak = a[sortKey] ?? 0
    const bk = b[sortKey] ?? 0
    return sortAsc ? ak - bk : bk - ak
  })

  const ordinal = (n) => {
    if (n === 1) return 'st'
    if (n === 2) return 'nd'
    if (n === 3) return 'rd'
    return 'th'
  }

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
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="eyebrow mb-2">WORLD CUP · 2026</p>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-1">
          Welcome back, {currentPlayer.name.split(' ')[0]}.
        </h1>
        <p className="text-muted">Make your predictions before the deadline</p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress Card */}
        <div className="card">
          <p className="eyebrow mb-3">YOUR PROGRESS</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display font-black text-3xl text-gold">{progress.done}</span>
                <span className="text-sm text-muted">of {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink via-orange-500 to-gold transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
            <Link to="/predict" className="btn-primary text-sm w-full justify-center">
              Continue predicting
            </Link>
          </div>
        </div>

        {/* Standing Card */}
        <div className="card">
          <p className="eyebrow mb-3">YOUR STANDING</p>
          <div className="font-display font-black text-4xl gradient-text mb-2">
            {standing?.rank ? `${standing.rank}${ordinal(standing.rank)}` : '—'}
          </div>
          <p className="text-sm text-muted">{standing?.pts ?? 0} points</p>
        </div>

        {/* Countdown Card */}
        <div className="card">
          <p className="eyebrow mb-3">DEADLINE</p>
          <div className="font-display font-black text-2xl text-gold mb-2">
            {String(countdown.days).padStart(2, '0')}d {String(countdown.hours).padStart(2, '0')}h
          </div>
          <p className="text-xs text-muted">Tue 10 Jun · 20:00</p>
        </div>
      </div>

      {/* Last result (if exists) */}
      {lastResult && (
        <div className="card">
          <p className="eyebrow mb-4">LAST RESULT SCORED</p>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">{lastResult.home} {lastResult.homeScore}–{lastResult.awayScore} {lastResult.away}</div>
            <div className="text-right">
              <div className="font-display font-black text-2xl text-green">+3</div>
              <p className="text-xs text-muted">points</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard + Your Run */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2">
          <h2 className="font-display font-black text-3xl mb-4">Leaderboard</h2>
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

        {/* Your Run sparkline */}
        <div className="space-y-4">
          <h2 className="font-display font-black text-3xl mb-4">Your Run</h2>
          <div className="card">
            <div className="mb-4">
              <p className="eyebrow mb-2">POINTS</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-3xl text-gold">{standing?.pts ?? 0} pts</span>
                <span className="text-lg font-display font-bold text-text">· #{standing?.rank ?? '—'}</span>
              </div>
            </div>
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
            <div className="space-y-2 border-t border-surface-3 pt-4">
              {(() => {
                const me = leaderboard.find(r => r.name === currentPlayer?.name)
                return (
                  <>
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
                        <span className="text-muted">Wrong</span>
                      </div>
                      <span className="font-bold text-text">{me?.wrong ?? 0}</span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

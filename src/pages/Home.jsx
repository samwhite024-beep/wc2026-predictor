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

  const [nextMatch, setNextMatch] = useState(null)
  const [standing, setStanding] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 72 })
  const [lastResult, setLastResult] = useState(null)
  const countdown = useCountdown(DEADLINE)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      // Next match
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .is('home_score', null)
        .order('match_date', { ascending: true })
        .limit(1)
      if (matches?.[0]) {
        const m = matches[0]
        setNextMatch({
          home: m.home_team,
          away: m.away_team,
          kickoff: m.match_date,
          venue: '',
          group: m.stage?.split(' ')[1] || 'A',
        })
      }

      // Standing
      const { data: board } = await supabase
        .from('leaderboard')
        .select('name, total_points, rank')
        .eq('name', currentPlayer.name)
        .single()
      if (board) {
        setStanding({
          rank: board.rank,
          pts: board.total_points,
        })
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
        .order('kickoff', { ascending: false })
        .limit(1)
      if (results?.[0]) {
        const r = results[0]
        // TODO: fetch player's prediction for this match
        setLastResult({
          home: r.home_team,
          away: r.away_team,
          homeScore: r.home_score,
          awayScore: r.away_score,
        })
      }
    }
    fetchData()
  }, [currentPlayer?.name])

  const ordinal = (n) => {
    if (n === 1) return 'st'
    if (n === 2) return 'nd'
    if (n === 3) return 'rd'
    return 'th'
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-8 flex-wrap">
        <div>
          <p className="eyebrow mb-2">MATCHDAY 1 · GROUP STAGE</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight">
            Welcome back, {currentPlayer.name.split(' ')[0]}.
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Predictions lock in</p>
          <p className="font-display font-bold text-gold text-lg tracking-tight">
            {String(countdown.days).padStart(2, '0')}d {String(countdown.hours).padStart(2, '0')}h
          </p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Next match */}
        <div className="lg:col-span-2 space-y-6">
          {nextMatch && (
            <div className="card relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background: 'radial-gradient(ellipse 60% 80% at 50% 110%, rgba(247,165,10,0.1) 0%, transparent 70%)',
                }}
              />
              <div className="relative space-y-6">
                <div>
                  <p className="tag mb-4">NEXT UP: {nextMatch.group || 'GROUP A'}</p>
                  <p className="text-sm text-muted">{nextMatch.venue}</p>
                </div>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="font-display font-bold text-xl mb-1">{nextMatch.home}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-black text-4xl text-gold">VS</div>
                    <div className="text-sm text-muted mt-2">KICK-OFF 18:00</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-xl mb-1">{nextMatch.away}</div>
                  </div>
                </div>
                <Link to="/predict" className="btn-primary w-full justify-center">
                  Predict this match →
                </Link>
                <p className="text-sm text-muted text-center">
                  You've predicted <strong className="text-text">{progress.done} of {progress.total}</strong> group games
                </p>
              </div>
            </div>
          )}

          {/* Countdown */}
          <div className="card">
            <p className="eyebrow mb-6">GROUP STAGE LOCKS IN</p>
            <div className="grid grid-cols-4 gap-4">
              {[
                ['DAYS', countdown.days],
                ['HRS', countdown.hours],
                ['MIN', countdown.minutes],
                ['SEC', countdown.seconds],
              ].map(([label, val]) => (
                <div key={label} className="border border-surface-3 rounded-lg p-4 text-center">
                  <div className="font-display font-black text-3xl text-gold font-variant-numeric:tabular-nums">
                    {String(val).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-muted uppercase tracking-widest mt-2">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">
              Deadline Tue 10 Jun · 20:00 local
            </p>
          </div>

          {/* Progress */}
          <div className="card">
            <p className="eyebrow mb-4">YOUR PROGRESS</p>
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    fill="none"
                    stroke="url(#grad)"
                    strokeWidth="6"
                    strokeDasharray={`${(progress.done / progress.total) * 220} 220`}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%">
                      <stop offset="0%" stopColor="#FF4D74" />
                      <stop offset="46%" stopColor="#FF7A2F" />
                      <stop offset="100%" stopColor="#F7A50A" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <div className="font-display font-black text-3xl mb-1">
                  <span className="text-gold">{progress.done}</span><span className="text-muted">/{progress.total}</span>
                </div>
                <p className="text-sm text-muted mb-3">group predictions in</p>
                <Link to="/predict" className="btn-secondary text-sm">Finish the rest</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Your stats */}
        <div className="space-y-6">
          {/* Standing */}
          <div className="card">
            <p className="eyebrow mb-3">YOUR STANDING</p>
            <div className="font-display font-black text-5xl gradient-text">
              {standing?.rank ? `${standing.rank}${ordinal(standing.rank)}` : '—'}
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-lg font-display font-bold text-text">{standing?.pts ?? 0} <span className="text-muted text-sm font-normal">points</span></div>
            </div>
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="card">
              <p className="eyebrow mb-4">LAST RESULT SCORED</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{lastResult.home} {lastResult.homeScore}–{lastResult.awayScore} {lastResult.away}</div>
                  <div className="text-right">
                    <div className="font-display font-black text-3xl text-green">+3</div>
                    <p className="text-xs text-muted">points</p>
                  </div>
                </div>
                <p className="text-xs text-muted">You picked 2–1 · exact!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
        .like('stage', 'Group%')
        .order('match_date', { ascending: true })
        .limit(1)
      if (matches?.[0]) {
        const m = matches[0]
        setNextMatch({
          home: m.home_team,
          away: m.away_team,
          kickoff: m.match_date,
          venue: '',
          group: m.stage,
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">WORLD CUP · 2026</p>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-1">
          Welcome back, {currentPlayer.name.split(' ')[0]}.
        </h1>
        <p className="text-muted">Make your predictions before the deadline</p>
      </div>

      {/* Main grid: 3 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Progress Card */}
        <div className="card">
          <p className="eyebrow mb-3">YOUR PROGRESS</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display font-black text-3xl text-gold">{progress.done}</span>
                <span className="text-sm text-muted">of {progress.total} predictions</span>
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
          <div>
            <div className="font-display font-black text-4xl gradient-text mb-2">
              {standing?.rank ? `${standing.rank}${ordinal(standing.rank)}` : '—'}
            </div>
            <p className="text-sm text-muted">{standing?.pts ?? 0} points</p>
          </div>
        </div>

        {/* Countdown Card */}
        <div className="card">
          <p className="eyebrow mb-3">LOCKS IN</p>
          <div className="space-y-2">
            <div className="font-display font-black text-2xl text-gold">
              {String(countdown.days).padStart(2, '0')}d {String(countdown.hours).padStart(2, '0')}h
            </div>
            <p className="text-xs text-muted">Tue 10 Jun · 20:00</p>
          </div>
        </div>

        {/* Next Match Card (compact) */}
        {nextMatch && (
          <div className="card">
            <p className="eyebrow mb-3">NEXT MATCH</p>
            <div className="space-y-2">
              <div className="text-sm">
                <div className="text-muted text-xs mb-1">{nextMatch.group}</div>
                <div className="font-display font-bold text-sm">{nextMatch.home} vs {nextMatch.away}</div>
              </div>
            </div>
          </div>
        )}
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
    </div>
  )
}

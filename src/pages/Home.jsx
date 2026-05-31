import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEADLINE = new Date(import.meta.env.VITE_DEADLINE || '2026-06-10T20:00:00')

function useCountdown(target) {
  const calc = () => {
    const diff = target - Date.now()
    if (diff <= 0) return { expired: true }
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

export default function Home() {
  const [top5, setTop5] = useState([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const countdown = useCountdown(DEADLINE)

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase.from('leaderboard').select('*').limit(5)
    if (data) setTop5(data)
    const { count } = await supabase.from('participants').select('*', { count: 'exact', head: true })
    if (count != null) setTotalPlayers(count)
  }, [])

  useEffect(() => {
    fetchLeaderboard()
    const sub = supabase.channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, fetchLeaderboard)
      .subscribe()
    return () => sub.unsubscribe()
  }, [fetchLeaderboard])

  const medals = ['đĽ', 'đĽ', 'đĽ']

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 text-white p-8 text-center shadow-xl">
        <div className="text-6xl mb-3">â˝</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
          World Cup 2026
        </h1>
        <p className="text-red-200 text-lg font-medium mb-1">Score Predictor</p>
        <p className="text-gray-400 text-sm">USA Âˇ Canada Âˇ Mexico Âˇ 11 Jun â 19 Jul 2026</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/predict" className="btn-primary text-base px-7 py-3">
            âď¸  Make Your Predictions
          </Link>
          <Link to="/leaderboard" className="btn-secondary text-base px-7 py-3">
            đ  View Leaderboard
          </Link>
        </div>
      </div>

      {/* Countdown */}
      <div className="card text-center">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {countdown.expired ? 'đ Submission deadline has passed' : 'â° Group Stage Predictions Close In'}
        </p>
        {!countdown.expired && (
          <div className="flex justify-center gap-4">
            {[['Days', countdown.days], ['Hours', countdown.hours], ['Mins', countdown.minutes], ['Secs', countdown.seconds]].map(([label, val]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-4xl font-black text-brand tabular-nums w-16 text-center">
                  {String(val).padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Deadline: Tuesday 10 June 2026 Âˇ 20:00 local time Âˇ Submit via Email or Teams to Sam
        </p>
      </div>

      {/* How to play */}
      <div className="card">
        <h2 className="font-bold text-lg mb-4">đ How to Play</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ['1. Submit Group Predictions', 'Predict the score for all 72 group stage matches and answer the 3 tiebreaker questions before the deadline.'],
            ['2. Earn Points', 'â­ 3 points for the exact scoreline. â 1 point for the correct result. â 0 for wrong.'],
            ['3. Knockout Rounds', 'After each round you\'ll get the chance to predict the next knockout round before it kicks off.'],
            ['4. Tiebreakers', 'If you finish level on points, tiebreakers decide the winner: highest attendance, Golden Boot, top-scoring team.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">đ Leaderboard Preview</h2>
          <span className="text-sm text-gray-500">{totalPlayers} players entered</span>
        </div>
        {top5.length === 0 ? (
          <p className="text-gray-400 text-center py-6 text-sm">No predictions submitted yet â be the first!</p>
        ) : (
          <div className="space-y-2">
            {top5.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg
                ${i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                <span className="text-xl w-8 text-center">{medals[i] ?? `#${i + 1}`}</span>
                <span className="flex-1 font-semibold">{p.name}</span>
                <span className="font-black text-brand text-lg">{p.total_points}</span>
                <span className="text-xs text-gray-400">pts</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-center">
          <Link to="/leaderboard" className="text-brand text-sm font-medium hover:underline">
            View full leaderboard â
          </Link>
        </div>
      </div>

    </div>
  )
}

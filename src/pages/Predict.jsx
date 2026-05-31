import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcPoints, flag, STAGE_COLORS } from '../lib/scoring'

const DEADLINE = new Date(import.meta.env.VITE_DEADLINE || '2026-06-10T20:00:00')
const isLocked = () => Date.now() > DEADLINE

const TIEBREAKERS = [
  { key: 'tb1', q: '🏟️  Which match will have the highest attendance? Give the exact attendance figure AND the stadium name.',
    placeholder: 'e.g. 92,500 — MetLife Stadium' },
  { key: 'tb2', q: '🥇  Which player will win the Golden Boot (top scorer)?',
    placeholder: 'e.g. Kylian Mbappé' },
  { key: 'tb3', q: '🏆  Which team will score the most goals across the whole tournament?',
    placeholder: 'e.g. France' },
]

export default function Predict() {
  const [step, setStep]           = useState('name')   // 'name' | 'form' | 'done'
  const [nameInput, setNameInput] = useState('')
  const [participant, setParticipant] = useState(null)
  const [matches, setMatches]     = useState([])
  const [preds, setPreds]         = useState({})        // matchId → { home, away }
  const [tbs, setTbs]             = useState({ tb1: '', tb2: '', tb3: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [activeStage, setActiveStage] = useState(null)

  const loadMatches = useCallback(async () => {
    const { data } = await supabase.from('matches').select('*').eq('is_open', true).order('match_num')
    if (data) {
      setMatches(data)
      if (data.length > 0) setActiveStage(data[0].stage)
    }
  }, [])

  const loadExisting = useCallback(async (participantId) => {
    const [{ data: predData }, { data: tbData }] = await Promise.all([
      supabase.from('predictions').select('match_id, home_pred, away_pred').eq('participant_id', participantId),
      supabase.from('tiebreakers').select('tb1,tb2,tb3').eq('participant_id', participantId).maybeSingle(),
    ])
    if (predData) {
      const map = {}
      predData.forEach(p => { map[p.match_id] = { home: p.home_pred ?? '', away: p.away_pred ?? '' } })
      setPreds(map)
    }
    if (tbData) setTbs({ tb1: tbData.tb1 ?? '', tb2: tbData.tb2 ?? '', tb3: tbData.tb3 ?? '' })
  }, [])

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return
    setError('')
    setSaving(true)
    try {
      const { data, error: err } = await supabase
        .from('participants')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
        .select().single()
      if (err) throw err
      setParticipant(data)
      await Promise.all([loadMatches(), loadExisting(data.id)])
      setStep('form')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const setScore = (matchId, side, val) => {
    const n = val === '' ? '' : Math.max(0, Math.min(99, parseInt(val) || 0))
    setPreds(p => ({ ...p, [matchId]: { ...p[matchId], [side]: n } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked()) return
    setSaving(true)
    setError('')
    try {
      const predRows = Object.entries(preds)
        .filter(([, v]) => v.home !== '' && v.away !== '')
        .map(([matchId, v]) => ({
          participant_id: participant.id,
          match_id: parseInt(matchId),
          home_pred: parseInt(v.home),
          away_pred: parseInt(v.away),
          updated_at: new Date().toISOString(),
        }))
      if (predRows.length > 0) {
        const { error: predErr } = await supabase.from('predictions').upsert(predRows, { onConflict: 'participant_id,match_id' })
        if (predErr) throw predErr
      }
      await supabase.from('tiebreakers').upsert({ participant_id: participant.id, ...tbs }, { onConflict: 'participant_id' })
      setStep('done')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const stages = [...new Set(matches.map(m => m.stage))]
  const stageMatches = matches.filter(m => m.stage === activeStage)
  const filledCount = Object.values(preds).filter(v => v.home !== '' && v.away !== '').length

  if (step === 'name') return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card text-center space-y-5">
        <div className="text-5xl">✏️</div>
        <h1 className="text-2xl font-black">Enter Your Name</h1>
        <p className="text-gray-500 text-sm">
          If you've predicted before, entering the same name loads your existing predictions.
        </p>
        <form onSubmit={handleNameSubmit} className="space-y-3">
          <input
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg focus:border-brand focus:outline-none"
            placeholder="Your name..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            maxLength={50}
            autoFocus
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={!nameInput.trim() || saving} className="btn-primary w-full py-3 text-base">
            {saving ? 'Loading…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-black">Predictions Saved!</h2>
        <p className="text-gray-600">
          <span className="font-semibold text-brand">{filledCount}</span> match predictions saved for <span className="font-semibold">{participant?.name}</span>.
        </p>
        <p className="text-sm text-gray-500">
          Send your completed file to Sam via Email or Teams before<br />
          <span className="font-semibold">Tuesday 10 June 2026, 20:00</span>
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => setStep('form')} className="btn-secondary">Edit Predictions</button>
          <a href="/leaderboard" className="btn-primary">View Leaderboard</a>
        </div>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Your Predictions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Predicting as <span className="font-semibold text-gray-800">{participant?.name}</span>
            {' · '}{filledCount} / {matches.length} filled
          </p>
        </div>
        {isLocked() ? (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full">🔒 Locked</span>
        ) : (
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {/* Scoring reminder */}
      <div className="flex gap-3 text-xs flex-wrap">
        <span className="badge-exact px-3 py-1">⭐ 3 pts — Exact score</span>
        <span className="badge-correct px-3 py-1">✔ 1 pt — Correct result</span>
        <span className="badge-wrong px-3 py-1">✖ 0 pts — Wrong</span>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {stages.map(stage => {
          const stageCount = matches.filter(m => m.stage === stage).length
          const filled = matches.filter(m => m.stage === stage && preds[m.id]?.home !== '' && preds[m.id]?.away !== '').length
          const done = filled === stageCount
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setActiveStage(stage)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${activeStage === stage
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
              style={activeStage === stage ? { background: STAGE_COLORS[stage], borderColor: STAGE_COLORS[stage] } : {}}
            >
              {stage} {done ? '✓' : `${filled}/${stageCount}`}
            </button>
          )
        })}
      </div>

      {/* Match cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg font-bold text-white text-sm"
             style={{ background: STAGE_COLORS[activeStage] }}>
          {activeStage}
        </div>
        {stageMatches.map(match => {
          const pred = preds[match.id] ?? { home: '', away: '' }
          const locked = isLocked() || !match.is_open
          let ptsBadge = null
          if (match.home_score != null && pred.home !== '' && pred.away !== '') {
            const pts = calcPoints(Number(pred.home), Number(pred.away), match.home_score, match.away_score)
            if (pts === 3) ptsBadge = <span className="badge-exact">⭐ 3pts</span>
            else if (pts === 1) ptsBadge = <span className="badge-correct">✔ 1pt</span>
            else if (pts === 0) ptsBadge = <span className="badge-wrong">✖ 0pts</span>
          }
          return (
            <div key={match.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <span className="text-xs text-gray-400 w-12 text-center font-mono">#{match.match_num}<br/>{match.match_date}</span>
              <div className="flex-1 flex items-center gap-3 justify-end min-w-0">
                <span className="text-sm font-semibold text-right truncate">
                  {flag(match.home_team)} {match.home_team}
                </span>
                <input type="number" min="0" max="99"
                  className="score-input" placeholder="?" disabled={locked}
                  value={pred.home} onChange={e => setScore(match.id, 'home', e.target.value)} />
                <span className="text-gray-300 font-bold">—</span>
                <input type="number" min="0" max="99"
                  className="score-input" placeholder="?" disabled={locked}
                  value={pred.away} onChange={e => setScore(match.id, 'away', e.target.value)} />
                <span className="text-sm font-semibold truncate">
                  {match.away_team} {flag(match.away_team)}
                </span>
              </div>
              <div className="w-20 text-right">
                {match.home_score != null
                  ? <span className="text-xs text-gray-400 font-mono">{match.home_score}–{match.away_score}</span>
                  : null}
                {ptsBadge}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tiebreakers — show only on last group stage tab */}
      {activeStage === stages[stages.length - 1] && (
        <div className="card space-y-5">
          <h3 className="font-bold text-base">🔀 Tiebreaker Questions</h3>
          <p className="text-sm text-gray-500">
            Only used if two or more players are level on points at the top — closest answer wins.
          </p>
          {TIEBREAKERS.map(({ key, q, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">{q}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder={placeholder}
                value={tbs[key]}
                disabled={isLocked()}
                onChange={e => setTbs(t => ({ ...t, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {!isLocked() && (
        <div className="sticky bottom-4 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-8 py-3 text-base shadow-lg">
            {saving ? 'Saving…' : `💾 Save Predictions (${filledCount}/${matches.length})`}
          </button>
        </div>
      )}

    </form>
  )
}

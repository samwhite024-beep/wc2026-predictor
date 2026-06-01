import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEADLINE = new Date(import.meta.env.VITE_DEADLINE || '2026-06-10T20:00:00')

export default function Predict({ currentPlayer }) {
  const [activeGroup, setActiveGroup] = useState('A')
  const [matches, setMatches] = useState([])
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [totalDone, setTotalDone] = useState(0)
  const [locked] = useState(() => Date.now() > DEADLINE)
  const [aiContext, setAiContext] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  // Load matches for group
  useEffect(() => {
    const loadMatches = async () => {
      setSaved(false)
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('stage', `Group ${activeGroup}`)
        .order('match_date', { ascending: true })
      setMatches(data ?? [])

      if (!data?.length) return

      // Get participant ID
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('name', currentPlayer.name)
        .single()

      if (!participant) return

      // Fetch existing predictions
      const ids = data.map(m => m.id)
      const { data: preds } = await supabase
        .from('predictions')
        .select('match_id, home_pred, away_pred')
        .eq('participant_id', participant.id)
        .in('match_id', ids)

      const scoreMap = {}
      preds?.forEach(p => {
        scoreMap[p.match_id] = { home: p.home_pred ?? '', away: p.away_pred ?? '' }
      })
      setScores(scoreMap)

      // Total progress
      const { count } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', participant.id)
        .not('home_pred', 'is', null)
      setTotalDone(count ?? 0)
    }
    loadMatches()
  }, [activeGroup, currentPlayer?.name])

  const predictWithAI = async () => {
    if (!aiContext.trim()) {
      setAiError('Please enter some context for AI predictions')
      return
    }

    setAiLoading(true)
    setAiError('')

    try {
      const response = await supabase.functions.invoke('ai-predict', {
        body: {
          context: aiContext,
          matches: matches.map(m => ({
            id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
          })),
        },
      })

      if (response.error) {
        setAiError(response.error.message || 'Failed to get AI predictions')
        return
      }

      const predictions = response.data?.predictions
      if (!predictions || typeof predictions !== 'object') {
        setAiError('Invalid response from AI service')
        return
      }

      setScores(prev => ({
        ...prev,
        ...predictions,
      }))
      setAiContext('')
    } catch (err) {
      setAiError(err.message || 'Error calling AI service')
    } finally {
      setAiLoading(false)
    }
  }

  const setScore = (matchId, side, val) => {
    const num = val === '' ? '' : Math.max(0, Math.min(12, parseInt(val) || 0))
    setScores(p => ({
      ...p,
      [matchId]: { ...p[matchId], [side]: num },
    }))
    setSaved(false)
  }

  const saveGroup = async () => {
    setSaving(true)

    // Get participant ID
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('name', currentPlayer.name)
      .single()

    if (!participant) return

    const upserts = matches
      .filter(m => scores[m.id]?.home !== '' && scores[m.id]?.away !== '')
      .map(m => ({
        participant_id: participant.id,
        match_id: m.id,
        home_pred: scores[m.id].home,
        away_pred: scores[m.id].away,
      }))

    if (upserts.length) {
      await supabase
        .from('predictions')
        .upsert(upserts, { onConflict: 'participant_id,match_id' })
    }
    setSaving(false)
    setSaved(true)

    const { count } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('participant_id', participant.id)
      .not('home_pred', 'is', null)
    setTotalDone(count ?? 0)
  }

  const groupComplete = matches.length > 0 &&
    matches.every(m => scores[m.id]?.home !== '' && scores[m.id]?.away !== '')
  const groupDone = matches.filter(m => scores[m.id]?.home !== '' && scores[m.id]?.away !== '').length

  const groupTeams = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]))].slice(0, 4)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-8 flex-wrap">
        <div>
          <p className="eyebrow mb-2">GROUP STAGE · FAST ENTRY</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight">
            Predict the fixtures
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted mb-2">Group games predicted</p>
          <p className="font-display font-bold text-text text-2xl mb-3">{totalDone}/72</p>
          <div className="w-40 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink via-orange-500 to-gold transition-all"
              style={{ width: `${(totalDone / 72) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allGroups.map(g => {
          const groupMatches = matches.filter(m => m.group_id === g)
          const groupDoneCnt = groupMatches.filter(m => scores[m.id]?.home !== '' && scores[m.id]?.away !== '').length
          const isGroupComplete = groupMatches.length > 0 && groupDoneCnt === groupMatches.length

          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`relative w-12 h-12 rounded-xl font-display font-bold text-lg transition-all flex-shrink-0
                ${activeGroup === g
                  ? 'bg-sunset text-black shadow-lg shadow-gold/30'
                  : 'bg-surface-2 text-muted border border-surface-3 hover:text-text'}`}
            >
              {g}
              {isGroupComplete && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green flex items-center justify-center text-xs text-black">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Group info */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <p className="tag">Group {activeGroup}</p>
          <p className="text-sm text-muted">Round-robin · {matches.length} matches</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {groupTeams.map(code => (
            <div key={code} className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 text-sm font-display font-bold">
              <span className="text-base">{code}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matches */}
      <div className="bg-surface border border-surface-3 rounded-2xl overflow-hidden">
        {matches.length === 0 ? (
          <div className="p-12 text-center text-faint">Loading fixtures...</div>
        ) : (
          matches.map(match => {
            const kickoff = match.kickoff ? new Date(match.kickoff) : null
            const dateStr = kickoff?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            const timeStr = kickoff?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={match.id}
                className="flex items-center gap-4 px-6 py-5 border-t border-surface-3 first:border-t-0"
              >
                {/* Date/time */}
                <div className="text-sm min-w-fit">
                  <div className="font-medium text-text">{dateStr}</div>
                  <div className="text-xs text-muted mt-0.5">{timeStr}</div>
                </div>

                {/* Home team */}
                <div className="text-right flex-1">
                  <div className="font-display font-bold text-text">{match.home_team}</div>
                </div>

                {/* Score inputs */}
                <div className="flex items-center gap-2">
                  {/* Home score */}
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={scores[match.id]?.home ?? ''}
                      onChange={e => setScore(match.id, 'home', e.target.value)}
                      disabled={locked}
                      className="score-input text-center w-12"
                    />
                  </div>

                  {/* Dash */}
                  <div className="text-muted font-display font-black text-lg mx-2 pb-4">–</div>

                  {/* Away score */}
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={scores[match.id]?.away ?? ''}
                      onChange={e => setScore(match.id, 'away', e.target.value)}
                      disabled={locked}
                      className="score-input text-center w-12"
                    />
                  </div>
                </div>

                {/* Away team */}
                <div className="text-left flex-1">
                  <div className="font-display font-bold text-text">{match.away_team}</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-8">
        <p className="text-sm text-muted">
          <span className={`font-bold ${groupComplete ? 'text-green' : 'text-text'}`}>{groupDone}/{matches.length}</span>
          {' '}in Group {activeGroup}
          {groupComplete && <span className="text-green ml-2">· complete ✓</span>}
        </p>
        {!locked && (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-3 items-start">
              <input
                type="text"
                maxLength="1000"
                placeholder="Add context for AI predictions (e.g., 'form, injuries, weather')…"
                value={aiContext}
                onChange={e => {
                  setAiContext(e.target.value)
                  setAiError('')
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-surface-3 bg-surface-2 text-text placeholder-muted focus:border-gold focus:outline-none text-sm"
              />
              <button
                onClick={predictWithAI}
                disabled={aiLoading || !aiContext.trim()}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                {aiLoading ? '🤖 Thinking…' : '🤖 Predict'}
              </button>
            </div>
            {aiError && <p className="text-pink text-xs">{aiError}</p>}
            <div className="flex gap-3">
              <div className="text-xs text-muted flex-1">
                {aiContext.length}/1000 characters
              </div>
              <button
                onClick={saveGroup}
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? 'Saving…' : saved ? `Saved ✓` : `Save Group ${activeGroup} →`}
              </button>
            </div>
          </div>
        )}
        {locked && <p className="text-sm text-pink">Predictions are locked.</p>}
      </div>
    </div>
  )
}

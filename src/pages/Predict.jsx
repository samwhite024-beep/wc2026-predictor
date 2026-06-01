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
  const [submittedGroups, setSubmittedGroups] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '', visible: false })
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, groupId: null })

  const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  const getRoundInfo = () => {
    if (activeGroup && allGroups.includes(activeGroup)) {
      return { stage: `Group ${activeGroup}`, roundName: 'Round 1: Group Stage', totalMatches: 72 }
    }
    return { stage: null, roundName: 'Unknown', totalMatches: 0 }
  }

  const roundInfo = getRoundInfo()

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
      // Fetch all matches for the current round (all groups for group stage)
      const stages = allGroups.map(g => `Group ${g}`)
      const { data: roundMatches } = await supabase
        .from('matches')
        .select('*')
        .in('stage', stages)
        .order('match_date', { ascending: true })

      if (!roundMatches?.length) {
        setAiError('No matches found for this round')
        return
      }

      const matchList = roundMatches.map((m, idx) =>
        `${idx + 1}. ${m.home_team} vs ${m.away_team}`
      ).join('\n')

      const response = await supabase.functions.invoke('ai-predict', {
        body: {
          context: aiContext,
          matchList: matchList,
          matches: roundMatches.map(m => ({
            match_id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
          })),
        },
      })

      if (response.error) {
        setAiError(`Error: ${response.error.message || 'Failed to get AI predictions'}`)
        return
      }

      console.log('Edge function response:', response)
      const predictionsList = response.data?.predictions
      console.log('Predictions list:', predictionsList)

      if (!predictionsList || !Array.isArray(predictionsList)) {
        setAiError('Invalid response format from AI service. Please try again.')
        return
      }

      if (predictionsList.length === 0) {
        setAiError('No predictions returned. Please check your context and try again.')
        return
      }

      // Transform response format from edge function to app format
      const predictions = {}
      predictionsList.forEach((pred, idx) => {
        console.log(`Prediction ${idx}:`, pred)
        predictions[pred.match_id] = {
          home: pred.home || '',
          away: pred.away || '',
        }
      })

      const predictionCount = predictionsList.length
      const expectedCount = roundMatches.length

      if (predictionCount < expectedCount) {
        setAiError(`⚠️ Partial predictions: Only ${predictionCount}/${expectedCount} matches predicted. Fill in remaining matches manually.`)
        setTimeout(() => setAiError(''), 6000)
      }

      setScores(prev => ({
        ...prev,
        ...predictions,
      }))
      setAiContext('')

      if (predictionCount === expectedCount) {
        setMessage({
          type: 'success',
          text: `✓ AI predicted all ${predictionCount} matches`,
          visible: true,
        })
        setTimeout(() => setMessage(prev => ({ ...prev, visible: false })), 3000)
      }
    } catch (err) {
      setAiError(`Error: ${err.message || 'Failed to call AI service'}`)
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

    try {
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
          submitted: false,
        }))

      if (upserts.length) {
        await supabase
          .from('predictions')
          .upsert(upserts, { onConflict: 'participant_id,match_id' })
      }

      setMessage({
        type: 'success',
        text: `✓ Group ${activeGroup} saved as draft`,
        visible: true,
      })
      setTimeout(() => setMessage(prev => ({ ...prev, visible: false })), 3000)

      const { count } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', participant.id)
        .not('home_pred', 'is', null)
      setTotalDone(count ?? 0)
    } finally {
      setSaving(false)
    }
  }

  const confirmSubmitGroup = () => {
    const filledCount = matches.filter(m => scores[m.id]?.home !== '' && scores[m.id]?.away !== '').length
    const missingCount = matches.length - filledCount

    if (filledCount === 0) {
      setMessage({
        type: 'error',
        text: `Cannot submit: All ${matches.length} matches need predictions. Please enter predictions for all matches in Group ${activeGroup}.`,
        visible: true,
      })
      setTimeout(() => setMessage(prev => ({ ...prev, visible: false })), 5000)
      return
    }

    if (filledCount < matches.length) {
      setMessage({
        type: 'error',
        text: `Cannot submit: ${missingCount} match${missingCount > 1 ? 'es' : ''} missing predictions. Please enter predictions for all ${matches.length} matches in Group ${activeGroup}.`,
        visible: true,
      })
      setTimeout(() => setMessage(prev => ({ ...prev, visible: false })), 5000)
      return
    }

    setConfirmDialog({ visible: true, groupId: activeGroup })
  }

  const submitGroup = async () => {
    setSubmitting(true)
    setConfirmDialog({ visible: false, groupId: null })

    try {
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
          submitted: true,
        }))

      if (upserts.length) {
        await supabase
          .from('predictions')
          .upsert(upserts, { onConflict: 'participant_id,match_id' })
      }

      setSubmittedGroups(prev => new Set([...prev, activeGroup]))
      setMessage({
        type: 'success',
        text: `✓ Group ${activeGroup} submitted · Predictions locked`,
        visible: true,
      })
      setTimeout(() => setMessage(prev => ({ ...prev, visible: false })), 3000)

      const { count } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', participant.id)
        .not('home_pred', 'is', null)
      setTotalDone(count ?? 0)
    } finally {
      setSubmitting(false)
    }
  }


  const groupComplete = matches.length > 0 &&
    matches.every(m => scores[m.id] && scores[m.id].home !== '' && scores[m.id].away !== '')
  const groupDone = matches.filter(m => scores[m.id] && scores[m.id].home !== '' && scores[m.id].away !== '').length

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

      {/* AI Predictor Section */}
      {!locked && (
        <div className="bg-gradient-to-r from-pink/10 via-orange-500/10 to-gold/10 border-2 border-gold/30 rounded-2xl p-6 space-y-4">
          <div>
            <p className="eyebrow mb-1">AI ROUND PREDICTOR</p>
            <h2 className="font-display font-black text-2xl mb-1">Predict all {roundInfo.totalMatches} matches</h2>
            <p className="text-sm text-muted">{roundInfo.roundName}</p>
          </div>

          <div className="flex gap-3 items-start">
            <input
              type="text"
              maxLength="1000"
              placeholder="Add context for AI predictions (e.g., 'form, injuries, weather, home advantage')…"
              value={aiContext}
              onChange={e => {
                setAiContext(e.target.value)
                setAiError('')
              }}
              className="flex-1 px-4 py-3 rounded-lg border border-gold/20 bg-surface-2 text-text placeholder-muted focus:border-gold focus:outline-none text-sm"
            />
            <button
              onClick={predictWithAI}
              disabled={aiLoading || !aiContext.trim()}
              className="btn-primary text-sm whitespace-nowrap"
            >
              {aiLoading ? '🤖 Thinking…' : '🤖 Predict All'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="text-muted">{aiContext.length}/1000 characters</div>
            {aiError && <p className="text-pink font-medium">{aiError}</p>}
          </div>

        </div>
      )}

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {allGroups.map(g => {
          const groupMatches = matches.filter(m => m.group_id === g)
          const groupDoneCnt = groupMatches.filter(m => scores[m.id] && scores[m.id].home !== '' && scores[m.id].away !== '').length
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
              {submittedGroups.has(g) ? (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green flex items-center justify-center text-xs text-black font-bold">📤</span>
              ) : isGroupComplete ? (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center text-xs text-black">✓</span>
              ) : null}
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
                      disabled={locked || submittedGroups.has(activeGroup)}
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
                      disabled={locked || submittedGroups.has(activeGroup)}
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
        {!locked && !submittedGroups.has(activeGroup) && (
          <div className="flex gap-3">
            <button
              onClick={saveGroup}
              disabled={saving || submitting}
              className="btn-secondary text-sm flex-1"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : '💾 Save Draft'}
            </button>
            <button
              onClick={confirmSubmitGroup}
              disabled={saving || submitting}
              className="btn-primary text-sm flex-1"
            >
              {submitting ? 'Submitting…' : '📤 Submit Group'}
            </button>
          </div>
        )}
        {submittedGroups.has(activeGroup) && (
          <div className="bg-green/10 border border-green rounded-lg px-4 py-3 text-center">
            <p className="text-green font-bold text-sm">✓ Group {activeGroup} submitted</p>
            <p className="text-green text-xs mt-1">Predictions locked - cannot be edited</p>
          </div>
        )}
        {locked && <p className="text-sm text-pink">Predictions are locked.</p>}
      </div>

      {/* Message notification */}
      {message.visible && (
        <div
          className={`fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-96 px-4 py-4 rounded-lg font-medium text-sm transition-all ${
            message.type === 'success'
              ? 'bg-green/20 border border-green text-green'
              : 'bg-pink/20 border border-pink text-pink'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Confirm submission dialog */}
      {confirmDialog.visible && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-surface border border-surface-3 rounded-2xl p-6 max-w-sm w-full space-y-4 animate-in slide-in-from-bottom-4">
            <div>
              <h3 className="font-display font-bold text-lg mb-2">Submit Group {confirmDialog.groupId}?</h3>
              <p className="text-sm text-muted">
                Once you submit, you won't be able to change your predictions for this group. Make sure everything is correct.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog({ visible: false, groupId: null })}
                disabled={submitting}
                className="btn-secondary text-sm flex-1"
              >
                Cancel
              </button>
              <button
                onClick={submitGroup}
                disabled={submitting}
                className="btn-primary text-sm flex-1"
              >
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

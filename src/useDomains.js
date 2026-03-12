import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { SIGNAL_ORDER } from './constants'

// Transform flat DB rows into the nested structure App.jsx expects
function buildDomains(dbDomains, dbFunctions, dbSignals) {
  return dbDomains
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(d => ({
      id: d.id,
      label: d.label,
      abbr: d.abbr,
      color: d.color,
      desc: d.description,
      isTeamDomain: d.is_team_domain,
      functions: dbFunctions
        .filter(f => f.domain_id === d.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(f => ({
          id: f.id,
          label: f.label,
          desc: f.description,
          weight: Number(f.weight),
          signals: dbSignals
            .filter(s => s.function_id === f.id)
            .sort((a, b) => {
              const ai = SIGNAL_ORDER.indexOf(a.label);
              const bi = SIGNAL_ORDER.indexOf(b.label);
              if (ai !== -1 && bi !== -1) return ai - bi;
              if (ai !== -1) return -1;
              if (bi !== -1) return 1;
              return a.label.localeCompare(b.label);
            })
            .map(s => ({
              id: s.id,
              label: s.label,
              score: Number(s.score),
              weight: Number(s.weight || 0.2),
              source: s.source,
              active: s.active !== false,
              ...(s.role ? { role: s.role } : {}),
            })),
        })),
    }))
}

export function useDomains() {
  const [domains, setDomains] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: dbDomains, error: e1 },
        { data: dbFunctions, error: e2 },
        { data: dbSignals, error: e3 },
      ] = await Promise.all([
        supabase.from('domains').select('*'),
        supabase.from('functions').select('*'),
        supabase.from('signals').select('*'),
      ])
      if (e1 || e2 || e3) throw e1 || e2 || e3
      setDomains(buildDomains(dbDomains, dbFunctions, dbSignals))
    } catch (err) {
      console.error('Failed to load domains:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Update a single signal score in Supabase + local state
  const updateSignal = useCallback(async (domId, fnId, sigId, val) => {
    // Optimistic local update
    setDomains(prev =>
      prev?.map(d => d.id !== domId ? d : {
        ...d,
        functions: d.functions.map(fn => fn.id !== fnId ? fn : {
          ...fn,
          signals: fn.signals.map(s => s.id !== sigId ? s : { ...s, score: val }),
        }),
      })
    )
    // Persist
    const { error } = await supabase
      .from('signals')
      .update({ score: val })
      .eq('id', sigId)
    if (error) console.error('Failed to save signal:', error)
  }, [])

  // Trigger sync-travel-load edge function and reload
  const syncTravelLoad = useCallback(async () => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-travel-load`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Sync failed: ${res.status}`)
    }
    await load()
  }, [load])

  return { domains, loading, error, updateSignal, syncTravelLoad, reload: load }
}

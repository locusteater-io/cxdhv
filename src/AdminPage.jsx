import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from './supabase'

function tierColor(s) { return s >= 75 ? '#4ade80' : s >= 55 ? '#facc15' : '#f87171' }
function hexToRgb(hex) { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)] }

const DOMAIN_COLORS = ['#38bdf8','#fb923c','#f472b6','#34d399','#a78bfa','#f59e0b','#06b6d4','#ec4899','#84cc16','#8b5cf6']

const DEFAULT_SIGNALS = [
  { label: 'Process Clarity',             weight: 0.15, score: 50 },
  { label: 'Process Accuracy',            weight: 0.15, score: 50 },
  { label: 'System Functionality',        weight: 0.15, score: 50 },
  { label: 'Accountability & Visibility', weight: 0.15, score: 50 },
  { label: 'Overall Effectiveness',       weight: 0.40, score: 50 },
]

export default function AdminPage() {
  const [searchParams] = useSearchParams()
  const [domains, setDomains] = useState(null)
  const [functions, setFunctions] = useState(null)
  const [signals, setSignals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingDomain, setEditingDomain] = useState(null)
  const [draft, setDraft] = useState(null)
  const [expandedFn, setExpandedFn] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const [{ data: d }, { data: f }, { data: s }] = await Promise.all([
      supabase.from('domains').select('*').order('sort_order'),
      supabase.from('functions').select('*').order('sort_order'),
      supabase.from('signals').select('*'),
    ])
    setDomains(d)
    setFunctions(f)
    setSignals(s)
    setLoading(false)
    return { d, f, s }
  }, [])

  useEffect(() => {
    reload().then(({ d, f, s }) => {
      const editId = searchParams.get('edit')
      if (editId && d?.find(dom => dom.id === editId)) {
        startEditWith(editId, d, f, s)
      }
    })
  }, [reload, searchParams])

  // ── START EDIT ─────────────────────────────────────────────────
  const startEditWith = (domId, doms, fns, sigs) => {
    const dom = doms.find(d => d.id === domId)
    const domFns = fns.filter(f => f.domain_id === domId).sort((a,b) => a.sort_order - b.sort_order)
    setDraft({
      ...dom,
      functions: domFns.map(fn => ({
        ...fn,
        weight: Number(fn.weight),
        signals: sigs
          .filter(s => s.function_id === fn.id)
          .map(s => ({ ...s, score: Number(s.score), weight: Number(s.weight), active: s.active !== false })),
      })),
    })
    setEditingDomain(domId)
    setExpandedFn(null)
    setSaveError(null)
  }

  const startEdit = (domId) => {
    startEditWith(domId, domains, functions, signals)
  }

  const cancelEdit = () => {
    setEditingDomain(null)
    setDraft(null)
    setSaveError(null)
    setExpandedFn(null)
  }

  const updateDraft = (path, val) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      let obj = next
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]]
      obj[path[path.length - 1]] = val
      return next
    })
  }

  const totalWeight = draft ? draft.functions.reduce((a, f) => a + f.weight, 0) : 0
  const weightValid = draft ? Math.abs(totalWeight - 1.0) < 0.02 : false

  // ── TEAM MEMBER MANAGEMENT ─────────────────────────────────────
  // Update a team member's name across ALL functions in the draft
  const updateTeamMemberName = (memberIndex, newName) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.functions.forEach(fn => {
        if (fn.signals[memberIndex]) fn.signals[memberIndex].label = newName
      })
      return next
    })
  }

  // Toggle active/inactive across ALL functions
  const toggleTeamMemberActive = (memberIndex) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const newActive = !next.functions[0].signals[memberIndex].active
      next.functions.forEach(fn => {
        if (fn.signals[memberIndex]) fn.signals[memberIndex].active = newActive
      })
      return next
    })
  }

  // Update team member role across ALL functions
  const updateTeamMemberRole = (memberIndex, newRole) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.functions.forEach(fn => {
        if (fn.signals[memberIndex]) fn.signals[memberIndex].role = newRole
      })
      return next
    })
  }

  // Add a team member to ALL functions
  const addTeamMember = () => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      const ts = Date.now()
      next.functions.forEach((fn, fi) => {
        fn.signals.push({
          id: `${fn.id}_member_${ts}`,
          function_id: fn.id,
          label: 'New Member',
          score: 50,
          weight: 0,
          role: 'FDE',
          active: true,
          source: 'manual',
          _isNew: true,
        })
      })
      return next
    })
  }

  // Remove a team member from ALL functions
  const removeTeamMember = (memberIndex) => {
    setDraft(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.functions.forEach(fn => {
        fn.signals.splice(memberIndex, 1)
      })
      return next
    })
  }

  // ── ADD / REMOVE FUNCTION ──────────────────────────────────────
  const addFunction = () => {
    if (!draft || draft.functions.length >= 5) return
    const n = draft.functions.length + 1
    const newWeight = Math.round((1 / n) * 100) / 100
    const fnId = `${draft.id}_fn_${Date.now()}`

    let newSignals
    if (draft.is_team_domain) {
      // Copy member list from first function
      newSignals = draft.functions[0].signals.map((s, i) => ({
        id: `${fnId}_member_${i}`,
        function_id: fnId,
        label: s.label,
        score: 50,
        weight: 0,
        role: s.role,
        active: s.active,
        source: 'manual',
        _isNew: true,
      }))
    } else {
      newSignals = DEFAULT_SIGNALS.map((s, i) => ({
        id: `${fnId}_sig_${i}`,
        function_id: fnId,
        label: s.label,
        score: s.score,
        weight: s.weight,
        source: 'manual',
        _isNew: true,
      }))
    }

    const newFn = {
      id: fnId,
      domain_id: draft.id,
      label: `Function ${n}`,
      description: '',
      weight: newWeight,
      sort_order: draft.functions.length,
      _isNew: true,
      signals: newSignals,
    }
    setDraft(prev => ({
      ...prev,
      functions: prev.functions.map(f => ({ ...f, weight: newWeight })).concat(newFn),
    }))
  }

  const removeFunction = (fnId) => {
    if (!draft || draft.functions.length <= 3) return
    const remaining = draft.functions.filter(f => f.id !== fnId)
    const newWeight = Math.round((1 / remaining.length) * 100) / 100
    setDraft(prev => ({
      ...prev,
      functions: remaining.map(f => ({ ...f, weight: newWeight })),
    }))
    if (expandedFn === fnId) setExpandedFn(null)
  }

  // ── SAVE ───────────────────────────────────────────────────────
  const saveDomain = async () => {
    if (!weightValid) {
      setSaveError('Function weights must sum to 1.0')
      return
    }
    // Validate signal weights for non-team domains
    if (!draft.is_team_domain) {
      for (const fn of draft.functions) {
        const sigWeightSum = fn.signals.reduce((a, s) => a + s.weight, 0)
        if (Math.abs(sigWeightSum - 1.0) > 0.02) {
          setSaveError(`Signal weights for "${fn.label}" must sum to 1.0 (currently ${sigWeightSum.toFixed(2)})`)
          return
        }
      }
    }

    setSaving(true)
    setSaveError(null)
    try {
      const isNew = draft._isNew

      const { error: domErr } = await supabase.from('domains').upsert({
        id: draft.id,
        label: draft.label,
        abbr: draft.abbr,
        color: draft.color,
        description: draft.description || '',
        is_team_domain: draft.is_team_domain || false,
        sort_order: draft.sort_order,
      })
      if (domErr) throw domErr

      if (!isNew) {
        const oldFnIds = functions.filter(f => f.domain_id === draft.id).map(f => f.id)
        const newFnIds = draft.functions.map(f => f.id)
        const deletedFnIds = oldFnIds.filter(id => !newFnIds.includes(id))
        for (const fnId of deletedFnIds) {
          await supabase.from('functions').delete().eq('id', fnId)
        }
        // Delete removed signals
        for (const fn of draft.functions) {
          const oldSigIds = signals.filter(s => s.function_id === fn.id).map(s => s.id)
          const newSigIds = fn.signals.map(s => s.id)
          const deletedSigIds = oldSigIds.filter(id => !newSigIds.includes(id))
          for (const sigId of deletedSigIds) {
            await supabase.from('signals').delete().eq('id', sigId)
          }
        }
      }

      for (const fn of draft.functions) {
        const { error: fnErr } = await supabase.from('functions').upsert({
          id: fn.id,
          domain_id: draft.id,
          label: fn.label,
          description: fn.description || '',
          weight: fn.weight,
          sort_order: fn.sort_order,
        })
        if (fnErr) throw fnErr

        for (const sig of fn.signals) {
          const { error: sigErr } = await supabase.from('signals').upsert({
            id: sig.id,
            function_id: fn.id,
            label: sig.label,
            score: sig.score,
            weight: sig.weight || 0,
            source: sig.source || 'manual',
            role: sig.role || null,
            active: sig.active !== false,
          })
          if (sigErr) throw sigErr
        }
      }

      await reload()
      setEditingDomain(null)
      setDraft(null)
      setExpandedFn(null)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── ADD NEW DOMAIN ─────────────────────────────────────────────
  const addNewDomain = () => {
    const ts = Date.now()
    const domId = `domain_${ts}`
    const color = DOMAIN_COLORS[(domains?.length || 0) % DOMAIN_COLORS.length]
    const fns = [1, 2, 3].map((n, i) => {
      const fnId = `${domId}_fn_${i}`
      return {
        id: fnId, domain_id: domId, label: `Function ${n}`, description: '',
        weight: Math.round((1 / 3) * 100) / 100, sort_order: i, _isNew: true,
        signals: DEFAULT_SIGNALS.map((s, si) => ({
          id: `${fnId}_sig_${si}`, function_id: fnId, label: s.label,
          score: s.score, weight: s.weight, source: 'manual', _isNew: true,
        })),
      }
    })
    setDraft({
      id: domId, label: 'New Domain', abbr: 'NEW', color,
      description: '', is_team_domain: false, sort_order: (domains?.length || 0),
      _isNew: true, functions: fns,
    })
    setEditingDomain(domId)
    setExpandedFn(null)
    setSaveError(null)
  }

  // ── SCORING ────────────────────────────────────────────────────
  const getFnSignals = (fnId) => signals?.filter(s => s.function_id === fnId) || []
  const fnAvg = (fnId) => {
    const sigs = getFnSignals(fnId)
    if (!sigs.length) return 0
    const isTeam = sigs.some(s => s.role)
    if (isTeam) {
      const active = sigs.filter(s => s.active !== false)
      return active.length ? Math.min(100, active.reduce((a, s) => a + Number(s.score), 0) / active.length) : 0
    }
    return Math.min(100, sigs.reduce((a, s) => a + Number(s.score) * Number(s.weight), 0))
  }
  const domainAvg = (domId) => {
    const fns = functions?.filter(f => f.domain_id === domId) || []
    return Math.min(100, fns.reduce((a, f) => a + fnAvg(f.id) * Number(f.weight), 0))
  }
  const draftFnAvg = (fn) => {
    if (!fn.signals.length) return 0
    const isTeam = fn.signals.some(s => s.role)
    if (isTeam) {
      const active = fn.signals.filter(s => s.active !== false)
      return active.length ? Math.min(100, active.reduce((a, s) => a + s.score, 0) / active.length) : 0
    }
    return Math.min(100, fn.signals.reduce((a, s) => a + s.score * s.weight, 0))
  }
  const draftDomainAvg = () => {
    if (!draft) return 0
    return Math.min(100, draft.functions.reduce((a, f) => a + draftFnAvg(f) * f.weight, 0))
  }

  if (loading) return (
    <div style={S.page}><div style={S.loading}>Loading signals...</div></div>
  )

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.brand}>CXDHV</div>
          <div style={S.subtitle}>Signal Editor</div>
        </div>
        <a href="/" style={S.backLink}>← Dashboard</a>
      </div>

      <div style={S.grid}>
        {domains.map(domain => {
          const ds = domainAvg(domain.id)
          const tc = tierColor(ds)
          const [r, g, b] = hexToRgb(domain.color)
          const isEditing = editingDomain === domain.id
          const domFns = functions.filter(f => f.domain_id === domain.id)

          if (isEditing && draft) return (
            <EditCard key={domain.id} draft={draft} setDraft={setDraft} updateDraft={updateDraft}
              expandedFn={expandedFn} setExpandedFn={setExpandedFn}
              totalWeight={totalWeight} weightValid={weightValid}
              saveError={saveError} saving={saving}
              onSave={saveDomain} onCancel={cancelEdit}
              onAddFn={addFunction} onRemoveFn={removeFunction}
              draftDomainAvg={draftDomainAvg} draftFnAvg={draftFnAvg}
              updateTeamMemberName={updateTeamMemberName}
              toggleTeamMemberActive={toggleTeamMemberActive}
              updateTeamMemberRole={updateTeamMemberRole}
              addTeamMember={addTeamMember}
              removeTeamMember={removeTeamMember} />
          )

          return (
            <div key={domain.id} style={{ ...S.domainCard, borderLeft: `3px solid ${domain.color}` }}>
              <div style={S.domainHeader}>
                <div>
                  <span style={{ ...S.abbr, color: `rgba(${r},${g},${b},0.7)` }}>{domain.abbr}</span>
                  <span style={S.domainLabel}>{domain.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ ...S.scoreNum, color: tc, fontSize: 24 }}>{Math.round(ds)}</span>
                  <button onClick={() => startEdit(domain.id)} style={S.editBtn}>Edit</button>
                </div>
              </div>
              <div style={S.fnList}>
                {domFns.map(fn => {
                  const avg = fnAvg(fn.id)
                  const fc = tierColor(avg)
                  return (
                    <div key={fn.id} style={S.fnRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: fc, boxShadow: `0 0 4px ${fc}` }} />
                        <span style={S.fnLabelRead}>{fn.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...S.fnScoreRead, color: fc }}>{Math.round(avg)}</span>
                        <span style={S.weightBadge}>w:{Number(fn.weight).toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {(!editingDomain || !draft?._isNew) && (
          <div onClick={addNewDomain} style={S.addCard}>
            <span style={S.addPlus}>+</span>
          </div>
        )}

        {editingDomain && draft?._isNew && (
          <EditCard key="new" draft={draft} setDraft={setDraft} updateDraft={updateDraft}
            expandedFn={expandedFn} setExpandedFn={setExpandedFn}
            totalWeight={totalWeight} weightValid={weightValid}
            saveError={saveError} saving={saving}
            onSave={saveDomain} onCancel={cancelEdit}
            onAddFn={addFunction} onRemoveFn={removeFunction}
            draftDomainAvg={draftDomainAvg} draftFnAvg={draftFnAvg}
            updateTeamMemberName={updateTeamMemberName}
            toggleTeamMemberActive={toggleTeamMemberActive}
            updateTeamMemberRole={updateTeamMemberRole}
            addTeamMember={addTeamMember}
            removeTeamMember={removeTeamMember} />
        )}
      </div>
    </div>
  )
}

// ── EDIT CARD ─────────────────────────────────────────────────────
function EditCard({ draft, setDraft, updateDraft, expandedFn, setExpandedFn,
  totalWeight, weightValid, saveError, saving,
  onSave, onCancel, onAddFn, onRemoveFn, draftDomainAvg, draftFnAvg,
  updateTeamMemberName, toggleTeamMemberActive, updateTeamMemberRole,
  addTeamMember, removeTeamMember }) {

  const ds = draftDomainAvg()
  const tc = tierColor(ds)
  const [r, g, b] = hexToRgb(draft.color)
  const isTeam = draft.is_team_domain

  // Get unique member list from first function (team domains)
  const members = isTeam && draft.functions[0] ? draft.functions[0].signals : []

  return (
    <div style={{
      ...S.domainCard, borderLeft: `3px solid ${draft.color}`,
      gridColumn: '1 / -1',
      border: `1px solid rgba(${r},${g},${b},0.3)`,
      background: `rgba(${r},${g},${b},0.03)`,
    }}>
      {/* Domain header — editable */}
      <div style={{ ...S.domainHeader, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <input value={draft.abbr}
            onChange={e => setDraft(prev => ({ ...prev, abbr: e.target.value.toUpperCase().slice(0, 6) }))}
            style={{ ...S.input, width: 60, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: draft.color }}
            placeholder="ABBR" />
          <input value={draft.label}
            onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
            style={{ ...S.input, flex: 1, fontSize: 13, fontWeight: 'bold' }}
            placeholder="Domain Name" />
          {/* Color picker */}
          <input type="color" value={draft.color}
            onChange={e => setDraft(prev => ({ ...prev, color: e.target.value }))}
            style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...S.scoreNum, color: tc, fontSize: 24 }}>{Math.round(ds)}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 10, fontWeight: 'bold', letterSpacing: '0.08em',
              color: weightValid ? '#4ade80' : '#f87171',
            }}>
              Σw = {totalWeight.toFixed(2)} {weightValid ? '✓' : '✗'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 18px 10px' }}>
        <input value={draft.description || ''}
          onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
          style={{ ...S.input, width: '100%', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}
          placeholder="Domain description..." />
      </div>

      {/* ── TEAM MEMBER ROSTER (team domains only) ──────────────── */}
      {isTeam && (
        <div style={{ padding: '0 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: 10 }}>
            Team Roster — edits apply to all functions
          </div>
          {members.map((m, mi) => (
            <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, opacity: m.active ? 1 : 0.35 }}>
              <button onClick={() => toggleTeamMemberActive(mi)}
                style={{ ...S.toggleBtn, background: m.active ? '#4ade80' : 'rgba(255,255,255,0.1)', color: m.active ? '#020408' : 'rgba(255,255,255,0.3)' }}>
                {m.active ? '●' : '○'}
              </button>
              <input value={m.label}
                onChange={e => updateTeamMemberName(mi, e.target.value)}
                style={{ ...S.input, flex: 1, fontSize: 11, textDecoration: m.active ? 'none' : 'line-through' }}
                placeholder="Member name" />
              <select value={m.role || 'FDE'}
                onChange={e => updateTeamMemberRole(mi, e.target.value)}
                style={{ ...S.input, width: 90, fontSize: 10, padding: '4px 6px' }}>
                <option value="Manager">Manager</option>
                <option value="FDE">FDE</option>
                <option value="CS">CS</option>
              </select>
              <button onClick={() => removeTeamMember(mi)}
                style={S.removeBtn} title="Remove member">×</button>
            </div>
          ))}
          <div onClick={addTeamMember} style={{ ...S.addFnBtn, borderTop: 'none', padding: '6px 0', textAlign: 'left', fontSize: 9 }}>
            + Add Team Member
          </div>
        </div>
      )}

      {/* Functions */}
      {draft.functions.map((fn, fi) => {
        const avg = draftFnAvg(fn)
        const fc = tierColor(avg)
        const isExpanded = expandedFn === fn.id
        const sigWeightSum = isTeam ? 0 : fn.signals.reduce((a, s) => a + s.weight, 0)
        const sigWeightValid = isTeam || Math.abs(sigWeightSum - 1.0) < 0.02

        return (
          <div key={fn.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ ...S.fnHeader, cursor: 'pointer' }} onClick={() => setExpandedFn(isExpanded ? null : fn.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: fc, boxShadow: `0 0 5px ${fc}`, flexShrink: 0 }} />
                <input value={fn.label}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateDraft(['functions', fi, 'label'], e.target.value)}
                  style={{ ...S.input, flex: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  placeholder="Function name" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ ...S.fnScoreRead, color: fc }}>{Math.round(avg)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>w:</span>
                  <input type="number" step="0.01" min="0" max="1" value={fn.weight}
                    onChange={e => updateDraft(['functions', fi, 'weight'], Math.max(0, Math.min(1, Number(e.target.value))))}
                    style={{ ...S.input, width: 50, fontSize: 11, textAlign: 'center' }} />
                </div>
                {draft.functions.length > 3 && (
                  <button onClick={e => { e.stopPropagation(); onRemoveFn(fn.id) }}
                    style={S.removeBtn} title="Remove function">×</button>
                )}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '0 18px 4px 34px' }}>
                <input value={fn.description || ''}
                  onChange={e => updateDraft(['functions', fi, 'description'], e.target.value)}
                  style={{ ...S.input, width: '100%', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}
                  placeholder="Function description..." />
              </div>
            )}

            {isExpanded && (
              <div style={{ padding: '8px 18px 16px 34px' }}>
                {!isTeam && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase' }}>Signals</span>
                    <span style={{
                      fontSize: 9, fontWeight: 'bold', letterSpacing: '0.08em',
                      color: sigWeightValid ? '#4ade80' : '#f87171',
                    }}>
                      Σw = {sigWeightSum.toFixed(2)} {sigWeightValid ? '✓' : '✗'}
                    </span>
                  </div>
                )}
                {isTeam && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase' }}>
                      Member Scores (evenly weighted)
                    </span>
                  </div>
                )}

                {isTeam ? (
                  // Team: show member scores grouped by role
                  ['Manager', 'FDE', 'CS'].map(role => {
                    const roleSigs = fn.signals.map((s, i) => ({ ...s, _idx: i })).filter(s => s.role === role)
                    if (!roleSigs.length) return null
                    return (
                      <div key={role}>
                        <div style={S.roleLabel}>{role}</div>
                        {roleSigs.map(sig => (
                          <TeamSignalRow key={sig.id} sig={sig} fi={fi} si={sig._idx} updateDraft={updateDraft} />
                        ))}
                      </div>
                    )
                  })
                ) : (
                  fn.signals.map((sig, si) => (
                    <EditSignalRow key={sig.id} sig={sig} fi={fi} si={si} updateDraft={updateDraft} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {draft.functions.length < 5 && (
        <div onClick={onAddFn} style={S.addFnBtn}>
          + Add Function ({draft.functions.length}/5)
        </div>
      )}

      <div style={S.actionBar}>
        {saveError && <div style={S.errorMsg}>{saveError}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={S.cancelBtn}>Cancel</button>
          <button onClick={onSave} disabled={saving || !weightValid}
            style={{ ...S.saveBtn, opacity: (saving || !weightValid) ? 0.4 : 1 }}>
            {saving ? 'Saving...' : 'Save Domain'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TEAM SIGNAL ROW (score only, no weight) ───────────────────────
function TeamSignalRow({ sig, fi, si, updateDraft }) {
  const score = sig.score
  const inactive = sig.active === false
  const tc = inactive ? 'rgba(255,255,255,0.1)' : tierColor(score)
  return (
    <div style={{ marginBottom: 12, opacity: inactive ? 0.3 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: inactive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', textDecoration: inactive ? 'line-through' : 'none' }}>
          {sig.label}{inactive ? ' (inactive)' : ''}
        </span>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: tc, fontFamily: 'monospace' }}>{inactive ? '—' : score}</span>
      </div>
      {!inactive && (
        <div style={{ position: 'relative', height: 4 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${score}%`, background: tc, borderRadius: 2, boxShadow: `0 0 6px ${tc}77`, transition: 'width 0.15s' }} />
          </div>
          <input type="range" min={0} max={100} value={score}
            onChange={e => updateDraft(['functions', fi, 'signals', si, 'score'], Number(e.target.value))}
            style={{ position: 'absolute', top: -10, left: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 24, margin: 0 }} />
        </div>
      )}
    </div>
  )
}

// ── SIGNAL ROW (EDIT MODE) ────────────────────────────────────────
function EditSignalRow({ sig, fi, si, updateDraft }) {
  const score = sig.score
  const tc = tierColor(score)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <input value={sig.label}
          onChange={e => updateDraft(['functions', fi, 'signals', si, 'label'], e.target.value)}
          style={{ ...S.input, flex: 1, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)' }}
          placeholder="Signal name" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>w:</span>
            <input type="number" step="0.01" min="0" max="1" value={sig.weight}
              onChange={e => updateDraft(['functions', fi, 'signals', si, 'weight'], Math.max(0, Math.min(1, Number(e.target.value))))}
              style={{ ...S.input, width: 45, fontSize: 10, textAlign: 'center' }} />
          </div>
          {sig.source !== 'manual' && <span style={S.sourceBadge}>{sig.source}</span>}
          <span style={{ fontSize: 13, fontWeight: 'bold', color: tc, width: 28, textAlign: 'right', fontFamily: 'monospace' }}>{score}</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 4 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${score}%`, background: tc, borderRadius: 2, boxShadow: `0 0 6px ${tc}77`, transition: 'width 0.15s' }} />
        </div>
        <input type="range" min={0} max={100} value={score}
          onChange={e => updateDraft(['functions', fi, 'signals', si, 'score'], Number(e.target.value))}
          style={{ position: 'absolute', top: -10, left: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 24, margin: 0 }} />
      </div>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#020408', color: 'white', fontFamily: "'SF Mono','Fira Code',monospace", padding: '0 0 40px' },
  loading: { padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' },
  brand: { fontSize: 10, letterSpacing: '0.44em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' },
  subtitle: { fontSize: 13, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: 2 },
  backLink: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '20px 24px' },
  domainCard: { background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  domainHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' },
  abbr: { fontSize: 9, letterSpacing: '0.38em', textTransform: 'uppercase', marginRight: 10 },
  domainLabel: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  scoreNum: { fontFamily: 'monospace', fontWeight: 'bold', lineHeight: 1, letterSpacing: '-0.04em' },
  editBtn: { fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  fnList: { padding: '4px 18px 12px' },
  fnRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.04)' },
  fnLabelRead: { fontSize: 10, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' },
  fnScoreRead: { fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  weightBadge: { fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em' },
  fnHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, color: 'rgba(255,255,255,0.85)', padding: '5px 8px', fontFamily: "'SF Mono','Fira Code',monospace", outline: 'none' },
  removeBtn: { background: 'none', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', borderRadius: 3, width: 22, height: 22, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0, lineHeight: 1 },
  toggleBtn: { width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0, flexShrink: 0 },
  addFnBtn: { padding: '10px 18px', textAlign: 'center', cursor: 'pointer', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', borderTop: '1px dashed rgba(255,255,255,0.06)' },
  roleLabel: { fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginTop: 10, marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.04)' },
  actionBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)', flexWrap: 'wrap', gap: 8 },
  errorMsg: { fontSize: 10, color: '#f87171', letterSpacing: '0.05em', flex: 1 },
  cancelBtn: { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#020408', background: '#4ade80', fontWeight: 'bold', border: 'none', borderRadius: 3, padding: '6px 20px', cursor: 'pointer', fontFamily: 'inherit' },
  addCard: { background: 'none', border: '2px dashed rgba(255,255,255,0.08)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  addPlus: { fontSize: 36, color: 'rgba(255,255,255,0.12)', fontWeight: 300, lineHeight: 1 },
  sourceBadge: { fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 2 },
}

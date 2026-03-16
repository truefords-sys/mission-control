'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────────────
interface PlanningTask {
  id: number
  name: string
  description: string
  cron_expression: string
  timezone: string
  session_type: 'isolated' | 'continue'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'active' | 'paused'
  last_run: string | null
  created_at: string
  updated_at: string
}

type ScheduleType = 'daily' | 'weekly' | 'recurring'
type TabId = 'quotidiennes' | 'hebdomadaires' | 'always-running'

// ─── Constants ──────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Bas',
  medium: 'Moyen',
  high: 'Haut',
  urgent: 'Urgent',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_CRON = [1, 2, 3, 4, 5, 6, 0] // Monday=1 ... Sunday=0

const TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'UTC',
]

// ─── Cron Helpers ───────────────────────────────────────────────────
function parseCronType(cron: string): 'daily' | 'weekly' | 'recurring' {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return 'daily'

  const [minute, hour, , , dayOfWeek] = parts

  // Recurring: */N or has intervals
  if (minute.includes('/') || hour.includes('/')) return 'recurring'

  // Weekly: specific day of week (not *)
  if (dayOfWeek !== '*') return 'weekly'

  // Daily: specific hour, all days
  return 'daily'
}

function getCronHour(cron: string): number {
  const parts = cron.trim().split(/\s+/)
  const h = parseInt(parts[1])
  return isNaN(h) ? 0 : h
}

function getCronMinute(cron: string): number {
  const parts = cron.trim().split(/\s+/)
  const m = parseInt(parts[0])
  return isNaN(m) ? 0 : m
}

function getCronDayOfWeek(cron: string): number {
  const parts = cron.trim().split(/\s+/)
  const d = parseInt(parts[4])
  return isNaN(d) ? -1 : d
}

function describeCron(cron: string): string {
  const type = parseCronType(cron)
  const parts = cron.trim().split(/\s+/)

  if (type === 'recurring') {
    if (parts[0].includes('/')) {
      const interval = parts[0].split('/')[1]
      return `Toutes les ${interval} min`
    }
    if (parts[1].includes('/')) {
      const interval = parts[1].split('/')[1]
      return `Toutes les ${interval}h`
    }
    return cron
  }

  const hour = getCronHour(cron)
  const minute = getCronMinute(cron)
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  if (type === 'weekly') {
    const dow = getCronDayOfWeek(cron)
    const dayIdx = DAYS_CRON.indexOf(dow)
    const dayName = dayIdx >= 0 ? DAYS_FR[dayIdx] : `Jour ${dow}`
    return `${dayName} à ${timeStr}`
  }

  return `Tous les jours à ${timeStr}`
}

function buildCron(scheduleType: ScheduleType, hour: number, minute: number, dayOfWeek: number, intervalValue: number, intervalUnit: 'minutes' | 'hours'): string {
  switch (scheduleType) {
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`
    case 'recurring':
      if (intervalUnit === 'minutes') {
        return `*/${intervalValue} * * * *`
      }
      return `0 */${intervalValue} * * *`
    default:
      return '0 0 * * *'
  }
}

// ─── Cron Cheatsheet Tooltip ────────────────────────────────────────
function CronCheatsheet() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
      >
        Aide Cron
      </button>
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-0 w-80 bg-card border border-border rounded-lg shadow-xl p-3 text-xs">
          <div className="font-semibold text-foreground mb-2">Syntaxe Cron (5 champs)</div>
          <div className="font-mono text-muted-foreground mb-2">
            minute heure jour mois jour_semaine
          </div>
          <table className="w-full text-left">
            <tbody className="text-muted-foreground">
              <tr><td className="pr-2 font-mono text-foreground">*</td><td>Toutes les valeurs</td></tr>
              <tr><td className="pr-2 font-mono text-foreground">*/5</td><td>Toutes les 5 unités</td></tr>
              <tr><td className="pr-2 font-mono text-foreground">0 8 * * *</td><td>Tous les jours à 08:00</td></tr>
              <tr><td className="pr-2 font-mono text-foreground">0 9 * * 1</td><td>Lundi à 09:00</td></tr>
              <tr><td className="pr-2 font-mono text-foreground">*/15 * * * *</td><td>Toutes les 15 min</td></tr>
              <tr><td className="pr-2 font-mono text-foreground">0 */4 * * *</td><td>Toutes les 4 heures</td></tr>
            </tbody>
          </table>
          <div className="mt-2 text-muted-foreground/60">
            Jours: 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Task Modal (Add / Edit) ────────────────────────────────────────
function TaskModal({
  task,
  onSave,
  onClose,
  onDelete,
}: {
  task: PlanningTask | null // null = add mode
  onSave: (data: Partial<PlanningTask> & { name: string; cron_expression: string }) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const isEdit = task !== null

  const [name, setName] = useState(task?.name || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState<string>(task?.priority || 'medium')
  const [sessionType, setSessionType] = useState<string>(task?.session_type || 'isolated')
  const [timezone, setTimezone] = useState(task?.timezone || 'Europe/London')
  const [scheduleType, setScheduleType] = useState<ScheduleType>(() => {
    if (task) return parseCronType(task.cron_expression)
    return 'daily'
  })
  const [hour, setHour] = useState(() => task ? getCronHour(task.cron_expression) : 8)
  const [minute, setMinute] = useState(() => task ? getCronMinute(task.cron_expression) : 0)
  const [dayOfWeek, setDayOfWeek] = useState(() => {
    if (task) {
      const d = getCronDayOfWeek(task.cron_expression)
      return d >= 0 ? d : 1
    }
    return 1
  })
  const [intervalValue, setIntervalValue] = useState(() => {
    if (task) {
      const parts = task.cron_expression.trim().split(/\s+/)
      if (parts[0].includes('/')) return parseInt(parts[0].split('/')[1]) || 5
      if (parts[1].includes('/')) return parseInt(parts[1].split('/')[1]) || 1
    }
    return 5
  })
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours'>(() => {
    if (task) {
      const parts = task.cron_expression.trim().split(/\s+/)
      if (parts[1].includes('/')) return 'hours'
    }
    return 'minutes'
  })
  const [rawCron, setRawCron] = useState(task?.cron_expression || '0 8 * * *')
  const [useRawCron, setUseRawCron] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Update raw cron when pickers change
  useEffect(() => {
    if (!useRawCron) {
      setRawCron(buildCron(scheduleType, hour, minute, dayOfWeek, intervalValue, intervalUnit))
    }
  }, [scheduleType, hour, minute, dayOfWeek, intervalValue, intervalUnit, useRawCron])

  const handleSave = () => {
    if (!name.trim()) return
    const cronExpr = useRawCron ? rawCron : buildCron(scheduleType, hour, minute, dayOfWeek, intervalValue, intervalUnit)
    onSave({
      name: name.trim(),
      description: description.trim(),
      cron_expression: cronExpr,
      timezone,
      session_type: sessionType as 'isolated' | 'continue',
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
    })
  }

  const selectClass = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
  const inputClass = selectClass

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Modifier la tâche' : 'Nouvelle tâche planifiée'}
          </h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nom *</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Nom de la tâche..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Schedule Type */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type de planification</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'recurring'] as ScheduleType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setScheduleType(t); setUseRawCron(false) }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    scheduleType === t && !useRawCron
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'daily' ? 'Quotidien' : t === 'weekly' ? 'Hebdomadaire' : 'Récurrent'}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Pickers */}
          {!useRawCron && scheduleType === 'daily' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Heure</label>
                <select value={hour} onChange={(e) => setHour(parseInt(e.target.value))} className={selectClass}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Minute</label>
                <select value={minute} onChange={(e) => setMinute(parseInt(e.target.value))} className={selectClass}>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!useRawCron && scheduleType === 'weekly' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jour</label>
                <div className="flex gap-1 flex-wrap">
                  {DAYS_FR.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDayOfWeek(DAYS_CRON[idx])}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
                        dayOfWeek === DAYS_CRON[idx]
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Heure</label>
                  <select value={hour} onChange={(e) => setHour(parseInt(e.target.value))} className={selectClass}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Minute</label>
                  <select value={minute} onChange={(e) => setMinute(parseInt(e.target.value))} className={selectClass}>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!useRawCron && scheduleType === 'recurring' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Intervalle</label>
                <input
                  type="number"
                  min={1}
                  max={intervalUnit === 'minutes' ? 59 : 23}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Unité</label>
                <select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as 'minutes' | 'hours')} className={selectClass}>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Heures</option>
                </select>
              </div>
            </div>
          )}

          {/* Raw Cron Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={useRawCron}
                onChange={(e) => setUseRawCron(e.target.checked)}
                className="rounded border-border"
              />
              Cron avancé
            </label>
            <CronCheatsheet />
          </div>

          {useRawCron && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Expression Cron</label>
              <input
                value={rawCron}
                onChange={(e) => setRawCron(e.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="0 8 * * *"
              />
            </div>
          )}

          {/* Generated Cron Preview */}
          <div className="text-xs text-muted-foreground bg-background/50 rounded-lg px-3 py-2 font-mono border border-border/50">
            Cron: {useRawCron ? rawCron : buildCron(scheduleType, hour, minute, dayOfWeek, intervalValue, intervalUnit)}
            <span className="ml-3 font-sans text-muted-foreground/60">
              ({describeCron(useRawCron ? rawCron : buildCron(scheduleType, hour, minute, dayOfWeek, intervalValue, intervalUnit))})
            </span>
          </div>

          {/* Priority + Session + Timezone */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
                <option value="low">Bas</option>
                <option value="medium">Moyen</option>
                <option value="high">Haut</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Session</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className={selectClass}>
                <option value="isolated">Isolée</option>
                <option value="continue">Continue</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fuseau</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          {isEdit && onDelete ? (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Supprimer
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Daily Tasks Table ──────────────────────────────────────────────
function DailyTasksTab({
  tasks,
  onEdit,
  onToggle,
}: {
  tasks: PlanningTask[]
  onEdit: (task: PlanningTask) => void
  onToggle: (task: PlanningTask) => void
}) {
  const sorted = [...tasks].sort((a, b) => {
    const ha = getCronHour(a.cron_expression) * 60 + getCronMinute(a.cron_expression)
    const hb = getCronHour(b.cron_expression) * 60 + getCronMinute(b.cron_expression)
    return ha - hb
  })

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-sm">
        Aucune tâche quotidienne configurée
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left px-3 py-2 font-medium">Heure</th>
            <th className="text-left px-3 py-2 font-medium">Nom</th>
            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Description</th>
            <th className="text-left px-3 py-2 font-medium">Cron</th>
            <th className="text-left px-3 py-2 font-medium">Priorité</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-right px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const h = getCronHour(task.cron_expression)
            const m = getCronMinute(task.cron_expression)
            return (
              <tr
                key={task.id}
                className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => onEdit(task)}
              >
                <td className="px-3 py-2.5 font-mono text-foreground">
                  {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                </td>
                <td className="px-3 py-2.5 text-foreground font-medium">{task.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                  {task.description || '—'}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {task.cron_expression}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggle(task) }}
                    className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${STATUS_COLORS[task.status]}`}
                  >
                    {task.status === 'active' ? 'Actif' : 'Pausé'}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                    title="Modifier"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
                    </svg>
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Weekly Calendar View ───────────────────────────────────────────
function WeeklyTasksTab({
  tasks,
  onEdit,
  onToggle,
}: {
  tasks: PlanningTask[]
  onEdit: (task: PlanningTask) => void
  onToggle: (task: PlanningTask) => void
}) {
  // Group tasks by day of week
  const tasksByDay: Record<number, PlanningTask[]> = {}
  for (const d of DAYS_CRON) {
    tasksByDay[d] = []
  }
  for (const task of tasks) {
    const dow = getCronDayOfWeek(task.cron_expression)
    if (tasksByDay[dow]) {
      tasksByDay[dow].push(task)
    }
  }

  // Sort tasks within each day by time
  for (const day of DAYS_CRON) {
    tasksByDay[day].sort((a, b) => {
      const ta = getCronHour(a.cron_expression) * 60 + getCronMinute(a.cron_expression)
      const tb = getCronHour(b.cron_expression) * 60 + getCronMinute(b.cron_expression)
      return ta - tb
    })
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-sm">
        Aucune tâche hebdomadaire configurée
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_FR.map((day, idx) => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 bg-secondary/30 rounded-t-lg border border-border/50">
              {day}
              <span className="ml-1 text-muted-foreground/50">({tasksByDay[DAYS_CRON[idx]].length})</span>
            </div>
          ))}
        </div>

        {/* Timeline grid */}
        <div className="grid grid-cols-7 gap-1" style={{ minHeight: '400px' }}>
          {DAYS_FR.map((day, idx) => {
            const dayTasks = tasksByDay[DAYS_CRON[idx]]
            return (
              <div key={day} className="relative bg-secondary/10 border border-border/30 rounded-b-lg overflow-hidden">
                {/* Hour lines */}
                {hours.filter(h => h % 3 === 0).map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/20"
                    style={{ top: `${(h / 24) * 100}%` }}
                  >
                    <span className="text-[9px] text-muted-foreground/30 px-0.5 leading-none">
                      {String(h).padStart(2, '0')}
                    </span>
                  </div>
                ))}

                {/* Task blocks */}
                {dayTasks.map((task) => {
                  const h = getCronHour(task.cron_expression)
                  const m = getCronMinute(task.cron_expression)
                  const topPercent = ((h * 60 + m) / (24 * 60)) * 100

                  const priorityBlockColors: Record<string, string> = {
                    low: 'bg-blue-500/30 border-blue-500/50 text-blue-300',
                    medium: 'bg-yellow-500/30 border-yellow-500/50 text-yellow-300',
                    high: 'bg-orange-500/30 border-orange-500/50 text-orange-300',
                    urgent: 'bg-red-500/30 border-red-500/50 text-red-300',
                  }

                  return (
                    <div
                      key={task.id}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 border cursor-pointer hover:brightness-125 transition-all ${
                        priorityBlockColors[task.priority]
                      } ${task.status === 'paused' ? 'opacity-40' : ''}`}
                      style={{ top: `${topPercent}%`, minHeight: '24px' }}
                      onClick={() => onEdit(task)}
                      title={`${task.name} - ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`}
                    >
                      <div className="text-[10px] font-medium truncate leading-tight">{task.name}</div>
                      <div className="text-[9px] opacity-70">
                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                      </div>
                    </div>
                  )
                })}

                {dayTasks.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground/20 text-xs">
                    —
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Always Running Tab ─────────────────────────────────────────────
function AlwaysRunningTab({
  tasks,
  onEdit,
  onToggle,
}: {
  tasks: PlanningTask[]
  onEdit: (task: PlanningTask) => void
  onToggle: (task: PlanningTask) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-sm">
        Aucune tâche récurrente configurée
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left px-3 py-2 font-medium">Fréquence</th>
            <th className="text-left px-3 py-2 font-medium">Nom</th>
            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Description</th>
            <th className="text-left px-3 py-2 font-medium">Cron</th>
            <th className="text-left px-3 py-2 font-medium">Priorité</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-right px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
              onClick={() => onEdit(task)}
            >
              <td className="px-3 py-2.5 text-foreground">{describeCron(task.cron_expression)}</td>
              <td className="px-3 py-2.5 text-foreground font-medium">{task.name}</td>
              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                {task.description || '—'}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {task.cron_expression}
              </td>
              <td className="px-3 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(task) }}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${STATUS_COLORS[task.status]}`}
                >
                  {task.status === 'active' ? 'Actif' : 'Pausé'}
                </button>
              </td>
              <td className="px-3 py-2.5 text-right">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                  title="Modifier"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                    <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
                  </svg>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Planning Board Panel ──────────────────────────────────────
export function PlanningBoardPanel() {
  const [tasks, setTasks] = useState<PlanningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('quotidiennes')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/planning')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTasks(data.tasks || [])
      setError(null)
    } catch {
      setError('Erreur de chargement des tâches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Categorize tasks
  const dailyTasks = tasks.filter((t) => parseCronType(t.cron_expression) === 'daily')
  const weeklyTasks = tasks.filter((t) => parseCronType(t.cron_expression) === 'weekly')
  const recurringTasks = tasks.filter((t) => parseCronType(t.cron_expression) === 'recurring')

  const createTask = async (data: Partial<PlanningTask> & { name: string; cron_expression: string }) => {
    try {
      const res = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create task')
      const result = await res.json()
      setTasks((prev) => [result.task, ...prev])
      setModalMode(null)
    } catch {
      setError('Erreur lors de la création de la tâche')
    }
  }

  const updateTask = async (data: Partial<PlanningTask> & { name: string; cron_expression: string }) => {
    if (!editingTask) return
    try {
      const res = await fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTask.id, ...data }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const result = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? result.task : t)))
      setModalMode(null)
      setEditingTask(null)
    } catch {
      setError('Erreur lors de la mise à jour')
    }
  }

  const deleteTask = async () => {
    if (!editingTask) return
    try {
      const res = await fetch('/api/planning', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTask.id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      setTasks((prev) => prev.filter((t) => t.id !== editingTask.id))
      setModalMode(null)
      setEditingTask(null)
    } catch {
      setError('Erreur lors de la suppression')
    }
  }

  const toggleTask = async (task: PlanningTask) => {
    const newStatus = task.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      const result = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === task.id ? result.task : t)))
    } catch {
      setError('Erreur lors du basculement du statut')
    }
  }

  const openEdit = (task: PlanningTask) => {
    setEditingTask(task)
    setModalMode('edit')
  }

  const openAdd = () => {
    setEditingTask(null)
    setModalMode('add')
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'quotidiennes', label: 'Quotidiennes', count: dailyTasks.length },
    { id: 'hebdomadaires', label: 'Hebdomadaires', count: weeklyTasks.length },
    { id: 'always-running', label: 'Always Running', count: recurringTasks.length },
  ]

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
          </svg>
          <h1 className="text-sm font-semibold text-foreground">Calendrier des Tâches Planifiées</h1>
          <span className="text-xs text-muted-foreground/60 bg-secondary/50 px-2 py-0.5 rounded-md">
            {tasks.length} tâche{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" onClick={openAdd}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Ajouter
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4 shrink-0">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3M8 10.5v.5" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg border border-b-0 transition-colors ${
              activeTab === tab.id
                ? 'bg-card text-foreground border-border'
                : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/30'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
              activeTab === tab.id
                ? 'bg-primary/20 text-primary'
                : 'bg-secondary/50 text-muted-foreground/60'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-card mx-4 mb-4 rounded-b-lg rounded-tr-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" strokeDasharray="30" strokeDashoffset="10" strokeLinecap="round" />
              </svg>
              Chargement...
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'quotidiennes' && (
              <DailyTasksTab tasks={dailyTasks} onEdit={openEdit} onToggle={toggleTask} />
            )}
            {activeTab === 'hebdomadaires' && (
              <WeeklyTasksTab tasks={weeklyTasks} onEdit={openEdit} onToggle={toggleTask} />
            )}
            {activeTab === 'always-running' && (
              <AlwaysRunningTab tasks={recurringTasks} onEdit={openEdit} onToggle={toggleTask} />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modalMode === 'add' && (
        <TaskModal
          task={null}
          onSave={createTask}
          onClose={() => setModalMode(null)}
        />
      )}
      {modalMode === 'edit' && editingTask && (
        <TaskModal
          task={editingTask}
          onSave={updateTask}
          onClose={() => { setModalMode(null); setEditingTask(null) }}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}

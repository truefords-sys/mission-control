'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

// Types
interface PlanningCard {
  id: number
  title: string
  description: string
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  position: number
  created_at: number
  updated_at: number
}

interface Column {
  id: string
  label: string
}

const COLUMNS: Column[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-blue-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-400',
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

// ─── Card Edit Modal ───────────────────────────────────────────────
function CardEditModal({
  card,
  onSave,
  onClose,
  onDelete,
}: {
  card: PlanningCard
  onSave: (updates: Partial<PlanningCard>) => void
  onClose: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [priority, setPriority] = useState(card.priority)
  const [status, setStatus] = useState(card.status)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim(), priority, status })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Edit Card</h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Card title..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PlanningCard['priority'])}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>{col.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete Card
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Card Form ─────────────────────────────────────────────────
function AddCardForm({
  columnId,
  onAdd,
  onCancel,
}: {
  columnId: string
  onAdd: (data: { title: string; description: string; priority: string; status: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: '', priority, status: columnId })
    setTitle('')
  }

  return (
    <div className="bg-background/50 border border-border rounded-lg p-3 flex flex-col gap-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        placeholder="Card title..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="flex-1 px-2 py-1 rounded-md bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <Button size="xs" onClick={handleSubmit} disabled={!title.trim()}>
          Add
        </Button>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Kanban Card ───────────────────────────────────────────────────
function KanbanCard({
  card,
  onEdit,
  onDelete,
}: {
  card: PlanningCard
  onEdit: (card: PlanningCard) => void
  onDelete: (id: number) => void
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(card.id))
    e.dataTransfer.effectAllowed = 'move'
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '0.5'
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(card)}
      className="group bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-150 select-none"
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[card.priority]}`} />
        <h4 className="text-sm font-medium text-foreground flex-1 leading-snug">{card.title}</h4>
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 shrink-0 -mt-0.5 -mr-1"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </Button>
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-xs text-muted-foreground mt-1.5 ml-4 line-clamp-2">{card.description}</p>
      )}

      {/* Footer: priority badge + date */}
      <div className="flex items-center gap-2 mt-2.5 ml-4">
        <span className={`text-2xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[card.priority]}`}>
          {card.priority}
        </span>
        <span className="text-2xs text-muted-foreground/60">{formatDate(card.created_at)}</span>
      </div>
    </div>
  )
}

// ─── Kanban Column ─────────────────────────────────────────────────
function KanbanColumn({
  column,
  cards,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onMoveCard,
}: {
  column: Column
  cards: PlanningCard[]
  onAddCard: (data: { title: string; description: string; priority: string; status: string }) => void
  onEditCard: (card: PlanningCard) => void
  onDeleteCard: (id: number) => void
  onMoveCard: (cardId: number, newStatus: string, newPosition: number) => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set dragOver false if we're actually leaving the column
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const cardId = parseInt(e.dataTransfer.getData('text/plain'))
    if (isNaN(cardId)) return
    onMoveCard(cardId, column.id, cards.length)
  }

  const columnColors: Record<string, string> = {
    todo: 'border-blue-500/30',
    in_progress: 'border-yellow-500/30',
    review: 'border-purple-500/30',
    done: 'border-green-500/30',
  }

  const columnHeaderColors: Record<string, string> = {
    todo: 'text-blue-400',
    in_progress: 'text-yellow-400',
    review: 'text-purple-400',
    done: 'text-green-400',
  }

  const columnDotColors: Record<string, string> = {
    todo: 'bg-blue-400',
    in_progress: 'bg-yellow-400',
    review: 'bg-purple-400',
    done: 'bg-green-400',
  }

  return (
    <div
      className={`flex flex-col rounded-xl border-t-2 ${columnColors[column.id]} bg-secondary/30 min-w-[280px] max-w-[340px] flex-1 transition-colors duration-150 ${
        dragOver ? 'bg-primary/5 border-primary/40' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${columnDotColors[column.id]}`} />
          <h3 className={`text-sm font-semibold ${columnHeaderColors[column.id]}`}>{column.label}</h3>
          <span className="text-xs text-muted-foreground/50 bg-background/50 px-1.5 py-0.5 rounded-md font-medium">
            {cards.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setShowAddForm(true)}
          title="Add card"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </Button>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2 min-h-[120px]">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onEdit={onEditCard}
            onDelete={onDeleteCard}
          />
        ))}

        {/* Add Card Form */}
        {showAddForm && (
          <AddCardForm
            columnId={column.id}
            onAdd={(data) => { onAddCard(data); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Empty state */}
        {cards.length === 0 && !showAddForm && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/40">Drop cards here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Planning Board Panel ────────────────────────────────────
export function PlanningBoardPanel() {
  const [cards, setCards] = useState<PlanningCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCard, setEditingCard] = useState<PlanningCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/planning')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCards(data.cards || [])
      setError(null)
    } catch {
      setError('Failed to load planning cards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const addCard = async (data: { title: string; description: string; priority: string; status: string }) => {
    try {
      const res = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create card')
      const result = await res.json()
      setCards((prev) => [...prev, result.card])
    } catch {
      setError('Failed to create card')
    }
  }

  const updateCard = async (updates: Partial<PlanningCard>) => {
    if (!editingCard) return
    try {
      const res = await fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCard.id, ...updates }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const result = await res.json()
      setCards((prev) => prev.map((c) => (c.id === editingCard.id ? result.card : c)))
      setEditingCard(null)
    } catch {
      setError('Failed to update card')
    }
  }

  const deleteCard = async (id: number) => {
    try {
      const res = await fetch('/api/planning', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      setCards((prev) => prev.filter((c) => c.id !== id))
      setEditingCard(null)
    } catch {
      setError('Failed to delete card')
    }
  }

  const moveCard = async (cardId: number, newStatus: string, newPosition: number) => {
    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: newStatus, position: newPosition } : c)))

    try {
      const res = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', cardId, newStatus, newPosition }),
      })
      if (!res.ok) throw new Error('Failed to move')
      // Refetch for accurate positions
      await fetchCards()
    } catch {
      // Revert on failure
      await fetchCards()
      setError('Failed to move card')
    }
  }

  const getColumnCards = (columnId: string) =>
    cards.filter((c) => c.status === columnId).sort((a, b) => a.position - b.position)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading board...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
              <rect x="1" y="2" width="4" height="12" rx="0.5" />
              <rect x="6" y="2" width="4" height="8" rx="0.5" />
              <rect x="11" y="2" width="4" height="10" rx="0.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Planning Board</h2>
            <p className="text-xs text-muted-foreground">{cards.length} card{cards.length !== 1 ? 's' : ''} across {COLUMNS.length} columns</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCards}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
            <path d="M2 8a6 6 0 0111.47-2.47M14 8a6 6 0 01-11.47 2.47" />
            <polyline points="2,3 2,8 7,8" />
            <polyline points="14,13 14,8 9,8" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <span className="text-xs text-red-400">{error}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setError(null)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Button>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-h-[400px]">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={getColumnCards(column.id)}
              onAddCard={addCard}
              onEditCard={setEditingCard}
              onDeleteCard={deleteCard}
              onMoveCard={moveCard}
            />
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editingCard && (
        <CardEditModal
          card={editingCard}
          onSave={updateCard}
          onClose={() => setEditingCard(null)}
          onDelete={() => deleteCard(editingCard.id)}
        />
      )}
    </div>
  )
}

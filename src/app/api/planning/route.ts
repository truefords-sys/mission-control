import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

// Ensure planning_cards table exists
function ensureTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS planning_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);
  return db;
}

/**
 * GET /api/planning - List all planning cards
 */
export async function GET() {
  try {
    const db = ensureTable();
    const cards = db.prepare(`
      SELECT * FROM planning_cards
      ORDER BY position ASC, created_at DESC
    `).all();
    return NextResponse.json({ cards });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch planning cards' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/planning - Create a new card or perform bulk operations
 * Body: { title, description?, status?, priority? }
 * Or: { action: 'reorder', cardId, newStatus, newPosition }
 */
export async function POST(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();

    // Handle reorder/move action
    if (body.action === 'reorder') {
      const { cardId, newStatus, newPosition } = body;
      if (!cardId || !newStatus || typeof newPosition !== 'number') {
        return NextResponse.json(
          { error: 'Missing cardId, newStatus, or newPosition' },
          { status: 400 }
        );
      }

      const now = Math.floor(Date.now() / 1000);

      // Shift cards in the target column to make room
      db.prepare(`
        UPDATE planning_cards
        SET position = position + 1, updated_at = ?
        WHERE status = ? AND position >= ?
      `).run(now, newStatus, newPosition);

      // Update the moved card
      db.prepare(`
        UPDATE planning_cards
        SET status = ?, position = ?, updated_at = ?
        WHERE id = ?
      `).run(newStatus, newPosition, now, cardId);

      const card = db.prepare('SELECT * FROM planning_cards WHERE id = ?').get(cardId);
      return NextResponse.json({ card });
    }

    // Create new card
    const { title, description, status, priority } = body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['todo', 'in_progress', 'review', 'done'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const cardStatus = validStatuses.includes(status) ? status : 'todo';
    const cardPriority = validPriorities.includes(priority) ? priority : 'medium';

    const now = Math.floor(Date.now() / 1000);

    // Get max position in target column
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM planning_cards WHERE status = ?'
    ).get(cardStatus) as { maxPos: number };

    const result = db.prepare(`
      INSERT INTO planning_cards (title, description, status, priority, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      (description || '').trim(),
      cardStatus,
      cardPriority,
      maxPos.maxPos + 1,
      now,
      now
    );

    const card = db.prepare('SELECT * FROM planning_cards WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create planning card' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/planning - Update a card
 * Body: { id, title?, description?, status?, priority? }
 */
export async function PUT(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { id, title, description, status, priority } = body;

    if (!id) {
      return NextResponse.json({ error: 'Card id is required' }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM planning_cards WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const validStatuses = ['todo', 'in_progress', 'review', 'done'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push((description || '').trim());
    }
    if (status !== undefined && validStatuses.includes(status)) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined && validPriorities.includes(priority)) {
      updates.push('priority = ?');
      values.push(priority);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE planning_cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const card = db.prepare('SELECT * FROM planning_cards WHERE id = ?').get(id);

    return NextResponse.json({ card });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update planning card' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planning - Delete a card
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Card id is required' }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM planning_cards WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM planning_cards WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete planning card' },
      { status: 500 }
    );
  }
}

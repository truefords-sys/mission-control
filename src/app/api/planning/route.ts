import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

// Ensure planning_tasks table exists
function ensureTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS planning_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cron_expression TEXT NOT NULL,
      timezone TEXT DEFAULT 'Europe/London',
      session_type TEXT DEFAULT 'isolated',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return db;
}

interface PlanningTaskRow {
  id: number;
  name: string;
  description: string;
  cron_expression: string;
  timezone: string;
  session_type: string;
  priority: string;
  status: string;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/planning - List all planning tasks
 */
export async function GET() {
  try {
    const db = ensureTable();
    const tasks = db.prepare(`
      SELECT * FROM planning_tasks
      ORDER BY created_at DESC
    `).all() as PlanningTaskRow[];
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Failed to fetch planning tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch planning tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/planning - Create a new scheduled task
 * Body: { name, description?, cron_expression, timezone?, session_type?, priority? }
 */
export async function POST(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { name, description, cron_expression, timezone, session_type, priority } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le nom est requis' },
        { status: 400 }
      );
    }

    if (!cron_expression || typeof cron_expression !== 'string' || cron_expression.trim().length === 0) {
      return NextResponse.json(
        { error: "L'expression cron est requise" },
        { status: 400 }
      );
    }

    // Validate cron expression format (basic 5-field check)
    const cronParts = cron_expression.trim().split(/\s+/);
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { error: "L'expression cron doit avoir 5 champs (minute heure jour mois jour_semaine)" },
        { status: 400 }
      );
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const validSessionTypes = ['isolated', 'continue'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
    const taskSessionType = validSessionTypes.includes(session_type) ? session_type : 'isolated';
    const taskTimezone = timezone || 'Europe/London';

    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO planning_tasks (name, description, cron_expression, timezone, session_type, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      name.trim(),
      (description || '').trim(),
      cron_expression.trim(),
      taskTimezone,
      taskSessionType,
      taskPriority,
      now,
      now
    );

    const task = db.prepare('SELECT * FROM planning_tasks WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Failed to create planning task:', error);
    return NextResponse.json(
      { error: 'Failed to create planning task' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/planning - Update a task (edit fields or toggle status)
 * Body: { id, name?, description?, cron_expression?, timezone?, session_type?, priority?, status? }
 */
export async function PUT(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { id, name, description, cron_expression, timezone, session_type, priority, status } = body;

    if (!id) {
      return NextResponse.json({ error: "L'id de la tâche est requis" }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM planning_tasks WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Tâche non trouvée' }, { status: 404 });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const validStatuses = ['active', 'paused'];
    const validSessionTypes = ['isolated', 'continue'];

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push((description || '').trim());
    }
    if (cron_expression !== undefined) {
      const cronParts = cron_expression.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        return NextResponse.json(
          { error: "L'expression cron doit avoir 5 champs" },
          { status: 400 }
        );
      }
      updates.push('cron_expression = ?');
      values.push(cron_expression.trim());
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(timezone);
    }
    if (session_type !== undefined && validSessionTypes.includes(session_type)) {
      updates.push('session_type = ?');
      values.push(session_type);
    }
    if (priority !== undefined && validPriorities.includes(priority)) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (status !== undefined && validStatuses.includes(status)) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE planning_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const task = db.prepare('SELECT * FROM planning_tasks WHERE id = ?').get(id);

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Failed to update planning task:', error);
    return NextResponse.json(
      { error: 'Failed to update planning task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planning - Delete a task
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "L'id de la tâche est requis" }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM planning_tasks WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Tâche non trouvée' }, { status: 404 });
    }

    db.prepare('DELETE FROM planning_tasks WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete planning task:', error);
    return NextResponse.json(
      { error: 'Failed to delete planning task' },
      { status: 500 }
    );
  }
}

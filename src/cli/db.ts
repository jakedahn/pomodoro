// Database operations for Pomodoro timer
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "@std/path";
import { ensureDir } from "@std/fs";

export interface Session {
  id?: number;
  task: string;
  duration: number; // in seconds
  started_at: string;
  completed_at?: string;
}

export class PomodoroDatabase {
  private db!: DatabaseSync;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Hardcoded to ~/.claude/skills/pomodoro/pomodoro.db for security
    const home = Deno.env.get("HOME");
    if (!home) {
      throw new Error("HOME environment variable not set");
    }
    this.dbPath =
      dbPath || join(home, ".claude", "skills", "pomodoro", "pomodoro.db");
  }

  async init(): Promise<void> {
    await ensureDir(dirname(this.dbPath));
    this.db = new DatabaseSync(this.dbPath);

    // Simple single table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        duration INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT
      )
    `);

    // Index for querying by date
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_started_at
      ON sessions(started_at)
    `);
  }

  startSession(task: string, duration: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (task, duration, started_at)
      VALUES (?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(task, duration);
    return Number(result.lastInsertRowid);
  }

  completeSession(sessionId: number): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET completed_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    stmt.run(sessionId);
  }

  getCurrentSession(): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, task, duration, started_at, completed_at
      FROM sessions
      WHERE completed_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);

    const result = stmt.get() as Session | undefined;
    return result || null;
  }

  getSessionHistory(days: number = 7, limit: number = 100): Session[] {
    const stmt = this.db.prepare(`
      SELECT id, task, duration, started_at, completed_at
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const results = stmt.all(limit) as unknown as Session[];
    return results;
  }

  getStatistics(period: "day" | "week" | "month" | "year" = "week") {
    const periodDays = {
      day: 1,
      week: 7,
      month: 30,
      year: 365,
    };

    const days = periodDays[period];

    // Total sessions
    const totalSessionsResult = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
    `
      )
      .get() as { count: number };

    // Completed sessions
    const completedSessionsResult = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
        AND completed_at IS NOT NULL
    `
      )
      .get() as { count: number };

    // Total focus time (in minutes)
    const totalFocusTimeResult = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(duration / 60), 0) as focusTime
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
        AND completed_at IS NOT NULL
    `
      )
      .get() as { focusTime: number };

    // Most productive hours
    const productiveHours = this.db
      .prepare(
        `
      SELECT CAST(strftime('%H', started_at) AS INTEGER) as hour, COUNT(*) as count
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
        AND completed_at IS NOT NULL
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 3
    `
      )
      .all() as { hour: string; count: number }[];

    // Task distribution
    const taskDistribution = this.db
      .prepare(
        `
      SELECT task, COUNT(*) as count
      FROM sessions
      WHERE datetime(started_at) >= datetime('now', 'localtime', '-${days} days')
      GROUP BY task
      ORDER BY count DESC
      LIMIT 5
    `
      )
      .all() as { task: string; count: number }[];

    const totalSessions = totalSessionsResult.count;
    const completedSessions = completedSessionsResult.count;

    return {
      period,
      totalSessions,
      completedSessions,
      incompleteSessions: totalSessions - completedSessions,
      completionRate: totalSessions
        ? ((completedSessions / totalSessions) * 100).toFixed(1)
        : "0",
      totalFocusTimeMinutes: Math.round(totalFocusTimeResult.focusTime),
      mostProductiveHours: productiveHours.map((row) => ({
        hour: parseInt(row.hour),
        count: row.count,
      })),
      taskDistribution: taskDistribution.map((row) => ({
        task: row.task,
        count: row.count,
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}

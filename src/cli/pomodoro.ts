#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-net

// Simple Pomodoro CLI - demonstrating CLI + SQLite + SKILL.md pattern
import { Command } from "@cliffy/command";
import { colors } from "@cliffy/ansi/colors";
import { Table } from "@cliffy/table";
import { PomodoroDatabase } from "./db.ts";
import { PomodoroTimer } from "./timer.ts";

// Default 25-minute Pomodoro duration
const DEFAULT_DURATION = 25 * 60; // 25 minutes in seconds

// Global instances
let db: PomodoroDatabase;
let timer: PomodoroTimer;
let activeSessionId: number | null = null;

// Initialize database
async function initDatabase(): Promise<void> {
  db = new PomodoroDatabase();
  await db.init();
}

// Start command - begin a focus session
async function startSession(options: {
  task: string;
  work?: number;
  break?: number;
  cycles?: number;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  // Check if a session is already running
  const currentSession = db.getCurrentSession();
  if (currentSession) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: "A session is already running",
            session: currentSession,
          },
          null,
          2
        )
      );
    } else {
      console.log(colors.red("A session is already running"));
      console.log(`Task: ${currentSession.task}`);
      console.log(`Started: ${currentSession.started_at}`);
    }
    Deno.exit(1);
  }

  const workMinutes = options.work || 25;
  const breakMinutes = options.break || 5;
  const cycles = options.cycles || 1;
  const workSeconds = workMinutes * 60;
  const breakSeconds = breakMinutes * 60;

  // Start session in database
  activeSessionId = db.startSession(options.task, workSeconds);

  // Initialize timer
  timer = new PomodoroTimer();
  timer.start(options.task, workSeconds, breakSeconds, cycles, activeSessionId);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: "started",
          sessionId: activeSessionId,
          task: options.task,
          workDuration: workMinutes,
          breakDuration: breakMinutes,
          cycles: cycles,
        },
        null,
        2
      )
    );
  } else {
    console.log(colors.green("✓ Pomodoro session started!"));
    console.log(`Task: ${colors.bold(options.task)}`);
    console.log(`Work: ${workMinutes} min${cycles > 1 ? ` | Break: ${breakMinutes} min | Cycles: ${cycles}` : ""}`);
  }

  // Keep the process running and show progress
  await waitForTimer(cycles);
}

// Wait for timer to complete
async function waitForTimer(totalCycles: number): Promise<void> {
  let completedCycles = 0;

  return new Promise((resolve) => {
    timer.setCompleteCallback(() => {
      console.log(colors.green("\n✓ All cycles complete! Great work!"));
      if (activeSessionId) {
        db.completeSession(activeSessionId);
      }
      resolve();
    });

    timer.setCycleCompleteCallback(() => {
      completedCycles++;
      console.log(colors.green(`\n✓ Cycle ${completedCycles}/${totalCycles} complete!`));
      if (activeSessionId) {
        db.completeSession(activeSessionId);
      }
      // Start new session for next cycle if there are more
      if (completedCycles < totalCycles) {
        const state = timer.getState();
        if (state) {
          activeSessionId = db.startSession(state.task, state.duration);
        }
      }
    });

    timer.setBreakStartCallback(() => {
      console.log(colors.yellow("\n☕ Break time! Relax..."));
    });

    timer.setUpdateCallback((state) => {
      // Update progress every minute
      if (state.remaining % 60 === 0) {
        const timeLeft = timer.formatTimeRemaining(state.remaining);
        const mode = state.isBreak ? "Break" : "Work";
        const cycleInfo = totalCycles > 1 ? ` (Cycle ${state.currentCycle}/${state.totalCycles})` : "";
        const encoder = new TextEncoder();
        Deno.stdout.writeSync(
          encoder.encode(`\r⏱  ${mode}${cycleInfo}: ${timeLeft} remaining`)
        );
      }
    });
  });
}

// Stop command - end current session early
async function stopSession(options: { json?: boolean }): Promise<void> {
  await initDatabase();

  const currentSession = db.getCurrentSession();
  if (!currentSession) {
    if (options.json) {
      console.log(JSON.stringify({ error: "No active session" }, null, 2));
    } else {
      console.log(colors.yellow("No active session running"));
    }
    Deno.exit(1);
  }

  // Mark as complete (stopped early)
  db.completeSession(currentSession.id!);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: "stopped",
          sessionId: currentSession.id,
          task: currentSession.task,
        },
        null,
        2
      )
    );
  } else {
    console.log(colors.yellow("⏹ Session stopped"));
    console.log(`Task: ${currentSession.task}`);
  }
}

// Status command - check if timer is running
async function getStatus(options: { json?: boolean }): Promise<void> {
  await initDatabase();

  const currentSession = db.getCurrentSession();

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          running: currentSession !== null,
          session: currentSession,
        },
        null,
        2
      )
    );
    return;
  }

  if (!currentSession) {
    console.log(colors.dim("No active session"));
    return;
  }

  console.log(colors.green("✓ Session running"));
  console.log(`Task: ${colors.bold(currentSession.task)}`);
  console.log(`Started: ${currentSession.started_at}`);
  console.log(`Duration: 25 minutes`);
}

// History command - view past sessions
async function showHistory(options: {
  days?: number;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  const sessions = db.getSessionHistory(options.days || 7);

  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log(colors.dim("No sessions found"));
    return;
  }

  console.log(
    colors.bold(`\nPomodoro History (last ${options.days || 7} days):`)
  );

  const table = new Table()
    .header(["Date", "Task", "Status"])
    .body(
      sessions.map((session) => {
        const date = new Date(session.started_at).toLocaleString();
        const status = session.completed_at
          ? colors.green("Completed")
          : colors.yellow("Incomplete");

        return [date, session.task, status];
      })
    )
    .border(true);

  console.log(table.toString());
}

// Stats command - analyze productivity
async function showStats(options: {
  period?: string;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  const validPeriods = ["day", "week", "month", "year"] as const;
  const period = validPeriods.includes(options.period as any)
    ? (options.period as "day" | "week" | "month" | "year")
    : "week";

  const stats = db.getStatistics(period);

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(colors.bold(`\nPomodoro Statistics (${stats.period}):\n`));

  console.log(`${colors.green("Total Sessions:")} ${stats.totalSessions}`);
  console.log(`${colors.green("Completed:")} ${stats.completedSessions}`);
  console.log(`${colors.yellow("Incomplete:")} ${stats.incompleteSessions}`);
  console.log(`${colors.blue("Completion Rate:")} ${stats.completionRate}%`);
  console.log(
    `${colors.cyan("Total Focus Time:")} ${stats.totalFocusTimeMinutes} minutes`
  );

  if (stats.mostProductiveHours.length > 0) {
    console.log(`\n${colors.bold("Most Productive Hours:")}`);
    stats.mostProductiveHours.forEach((hour) => {
      console.log(
        `  ${hour.hour}:00 - ${hour.count} session${hour.count > 1 ? "s" : ""}`
      );
    });
  }

  if (stats.taskDistribution.length > 0) {
    console.log(`\n${colors.bold("Top Tasks:")}`);
    stats.taskDistribution.forEach((task) => {
      console.log(
        `  ${task.task} - ${task.count} session${task.count > 1 ? "s" : ""}`
      );
    });
  }
}

// Main CLI
const main = new Command()
  .name("pomodoro")
  .version("1.0.0")
  .description("Simple Pomodoro timer with session tracking")
  .globalOption("-j, --json", "Output in JSON format")
  .action(function () {
    this.showHelp();
  });

// Start command
main
  .command("start")
  .description("Start a Pomodoro session")
  .option("-t, --task <task:string>", "Task description", { required: true })
  .option("-w, --work <minutes:number>", "Work duration in minutes", { default: 25 })
  .option("-b, --break <minutes:number>", "Break duration in minutes", { default: 5 })
  .option("-c, --cycles <count:number>", "Number of work+break cycles", { default: 1 })
  .action(startSession);

// Stop command
main
  .command("stop")
  .description("Stop the current session")
  .action(stopSession);

// Status command
main
  .command("status")
  .description("Check if a session is running")
  .action(getStatus);

// History command
main
  .command("history")
  .description("View session history")
  .option("-d, --days <days:number>", "Number of days to look back", {
    default: 7,
  })
  .action(showHistory);

// Stats command
main
  .command("stats")
  .description("View productivity statistics")
  .option(
    "-p, --period <period:string>",
    "Analysis period (day/week/month/year)",
    {
      default: "week",
    }
  )
  .action(showStats);

// Parse and run
if (import.meta.main) {
  await main.parse(Deno.args);
}

---
title: "The System Skill Pattern"
date: October 22, 2025
excerpt: "Give Claude a CLI, a SKILL.md, and a SQLite database. Then watch it turn the crank and animate your data to life."
ogImage: "https://assets.shruggingface.com/the-system-skill-pattern/system-skill-pattern.webp"
coverImage: "https://assets.shruggingface.com/the-system-skill-pattern/system-skill-pattern.webp"
---

Okay so.

I've been playing with [Claude Skills](https://www.anthropic.com/news/skills) for a few days now, and overall I've been impressed by their simplicity _(just put a markdown file in a folder, and suddenly Claude has a new capability!)_, and surprised by how useful they can be.

Skills are easy to write, easy to use, and easy to tweak. I'm a fan.

While I was hacking, I naturally stumbled into exploring Skills with persistence. Like wouldn't it be nice if it didn't forget helpful information every time I call a Skill from a new chat session? What if Skills could record and learn from examples they've already encountered?

Wait a minute, what if Claude could bring the system to life by turning the crank behind the scenes?

If Claude has an operating procedure/process to follow, and some tutorial on how to seek/search/query relevant information-- it will basically run and operate its own [OODA loop](https://en.wikipedia.org/wiki/OODA_loop) _(Observe, Orient, Decide, and Act)_.

To my eye, this is a phase change, where chat agents and Skills join to become something new.

## Introducing the System Skill

In this post, I'm going to unpack what I've been calling **The System Skill Pattern**.

An opinionated approach for building self-contained personal data systems as Claude Skills.

To illustrate how all of the pieces fit together, I've created a [Pomodoro System Skill](https://github.com/jakedahn/pomodoro). It records your focus sessions, and gives Claude a CLI to interact with your session history and drive the timer. However, perhaps most impressively, this skill turns Claude into the world's most expensive Pomodoro timer. _(at least when you consider the capital required to train Claude)_

The basic idea is that you tell Claude that you want to kick off a Pomodoro session, and share what you're working on. The `SKILL.md` defines how to run and operate the Pomodoro recording system. Then Claude knows it just needs to call `./pomodoro start --task "Refactor ABC-123"` to create a session, and sleep for 25 minutes.

```
 ▐▛███▜▌   Claude Code v2.0.25
▝▜█████▛▘  Sonnet 4.5 · Claude Max
  ▘▘ ▝▝    /Users/jakedahn/Desktop/projects/pomodoro

> hey let's pomodoro, I need to refactor ABC-123

⏺ I'll help you start a Pomodoro session for your refactoring task ABC-123.

╭─────────────────────────────────────────────────────────────────────────────╮
│ Use skill “pomodoro”?                                                       │
│ Claude may use instructions, code, or files from this Skill.                │
│                                                                             │
│   Simple Pomodoro timer for focused work sessions with session tracking     │
│   and productivity analytics. Demonstrates the CLI + SQLite + SKILL.md      │
│   pattern for stateful skills. (project, gitignored)                        │
│                                                                             │
│ Do you want to proceed?                                                     │
│ ❯ 1. Yes                                                                    │
│   2. Yes, and don't ask again for pomodoro in                               │
│   /Users/jakedahn/Desktop/projects/pomodoro                                 │
│   3. No, and tell Claude what to do differently (esc)                       │
│                                                                             │
╰─────────────────────────────────────────────────────────────────────────────╯

⏺ I'll help you start a Pomodoro session for refactoring ABC-123. Let me
  first check if there's already an active session running.

⏺ Bash(cd /Users/jakedahn/.claude/skills/pomodoro && ./pomodoro status)
  ⎿  No active session

⏺ Perfect! No active session. Let me start a 25-minute Pomodoro for
  refactoring ABC-123.

  Bash(cd /Users/jakedahn/.claude/skills/pomodoro && ./pomodoro   timeout: 30m
      start --task "Refactor ABC-123")                            0s
  ⎿  ✓ Pomodoro session started!
     Task: Refactor ABC-123
     Work: 25 min
     (21s)
```

Here's an example from today:

> • When do I work best?
>
> This week you've completed 8 sessions. All of them started before 11 AM. The three you tried after lunch? Still running or abandoned. Morning person confirmed. Block out your morning for deep work.

Now, I understand that this isn't, exactly, interesting. It's just a toy implementation that clarifies how the pieces of the System Skill Pattern fit together.

## So what's the pattern?

At it's core, a System Skill combines three components to create animated self-running information systems.

The three components are

1. **A CLI** — A no-config executable binary that Claude can run.
2. **A SKILL.md** — A tutorial of how to operate the desired system, and run the CLI.
3. **A Database** — SQLite.

### Component 1: The CLI Binary

This is a standalone executable that Claude will use to interact with your system. The goal with the CLI is to distill the core loop of your system into an easy to use CLI. This gives Claude handles and hooks it can use to effectively drive the system.

For example, if you want Claude to be able to view your session history, you create a command like `./pomodoro history` that prints a table of your session history.

Below are some commands from the Pomodoro System Skill that Claude can run to start tasks _(record a working session to a db)_, inspect work stats _(like time spent, loops bailed, etc)_, and fetch session history.

```bash
./pomodoro start --task "Deep work on authentication"
./pomodoro stats --period week
./pomodoro history --days 30
```

An important attribute for this CLI is that it must be **self-contained**. No runtime dependencies. No configuration. Just a single executable binary file.

In the Pomodoro reference implementation, I used Deno, which is a modern Typescript runtime that allows you to compile your code down into a single binary. One significant advantage of using Deno vs. Python is that you can skip installing and dependencies. As a user, this makes for a much better installation experience. You just run `./pomodoro` and it just works.

Another nice thing about Deno is that you can bake [security restrictions](https://docs.deno.com/runtime/fundamentals/security/) directly into the compiled binary. By default your binary will not have network access or any files on disk. You can explicitly configure exactly what files it can read and write. This is not sufficient for sandboxing, but it's nice to know that your CLI is not exfiltrating data to the internet through your CLI.

Finally, make sure that your CLI's `--help` flag has helpful documentation for each command. This is super effective at keeping Claude on track and filling in the gaps of your `SKILL.md`.

It's also just a great way to ensure your CLI is easy to use and understand. Just in case humans want to read the `SKILL.md` and run commands on their own.

```pomodoro --help
Usage:   pomodoro
Version: 1.0.0

Description:

  Simple Pomodoro timer with session tracking

Options:

  -h, --help     - Show this help.
  -V, --version  - Show the version number for this program.
  -j, --json     - Output in JSON format

Commands:

  start    - Start a Pomodoro session
  stop     - Stop the current session
  status   - Check if a session is running
  history  - View session history
  stats    - View productivity statistics
```

### Component 2: SKILL.md

The `SKILL.md` tells Claude:

- What the system is, and instructions for how to drive it
- When to run which CLI commands
- What flags to use in what situations
- How to interpret the output
- What patterns to look for as data accumulates

I think of `SKILL.md` as the place you give Claude a tutorial about how to think about your system, and how to use your CLI to operate it. You can actually be pretty sparse in what you write here, especially if your CLI's `--help` flag provides good documentation.

Focus on sharing the mental model of your system. What are the different data structures? How do they flow and interact together?

Here's a snippet from the Pomodoro `SKILL.md` showing the core decision flow-- sharing details like this helps to keep Claude on the right track.

```markdown
## Quick Decision Tree

User task → What kind of request?
├─ Start focused work → Check status first, then start session
├─ Check current timer → Use status command
├─ Review productivity → Use stats command (day/week/month/year)
├─ View past sessions → Use history command
└─ Stop early → Use stop command
```

`SKILL.md` is also very malleable for modifying functionality. Like lets say you use a System Skill every day, you could change the flow or define your personal preferences on how interaction should work.

### Component 3: SQLite Database

The SQLite database is used to store the state of your system. It's a simple single-file database that Claude can read and write to.

In the case of the Pomodoro System Skill, the database is unremarkable. One table. Five columns. Nothing fancy.

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  duration INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
```

I chose to use SQLite, mostly because it's awesome, but also:

- It's self-contained-- just a file, no server process to run, or credentials to manage.
- Lives right next to the CLI binary _(`./pomodoro` is the cli, `./pomodoro.db` is the database.)_
- Zero configuration
- Easy to backup and restore
- Worst case scenario, you want something your CLI doesn't do, and Claude can just query the data directly out of the db and pull it into other scripts or Skills.

### Putting It All Together

So how do these three pieces actually work together?

You ask Claude to start a pomodoro. Claude reads `SKILL.md`, sees it should run `./pomodoro start`, executes the CLI. The CLI writes a row to SQLite. Session complete.

Three weeks later, you ask Claude about your productivity. It runs `./pomodoro stats --period week`, gets back JSON with all your sessions, reasons and infers that you always finish morning sessions but abandon sessions in the afternoon.

## Some ideas to try

I had fun building the Pomodoro timer, but there is a huge amount of unexplored territory.

I personally find System Skills shine for building personal bespoke data systems to automate small tasks or workflows of daily life. Things that matter to you, that no one else cares about.

I haven't built any of these, but I suspect they would be awesome!

Some ideas to try:

**Personal Finance Mananger**

- CLI `money tx list`, `money tx info abc-123`, `money note abc-123 "unexpected road trip!"`, `money cat abc-123 "vacation"`
- Database: Table of all bank and credit card transactions (think mint.com)
- Result: Claude can watch transactions for spending trends, ask you questions about the transactions, etc.

**Personal Project Management**

- CLI `task new "rake the leaves"`, `task update T-123 --status=done`, `task list`, `task stats`, `task kanban`
- Database: Table of tasks with status, due date, priority, etc.
- Result: "What are my top 3 priorities for the week?"

**Gratitude Journal**

- CLI: `thankful "for my cat"`, `thankful list`, `thankful trends`, `thankful search`
- Database: Single table of entries with message and timestamp.
- Result: A gratitude journal that can talk back to you, and lift you up when you're feeling down.

**ChatGPT Pulse Clone**

- CLI: `pulse topic add "AI safety research"`, `pulse topic remove "tennis"`, `pulse generate`, `pulse feedback <id> --helpful`, `pulse history`
- Database: Tables for topics you care about, generated briefings, and feedback on what was useful
- Result: Ask Claude for your morning briefing, and it searches the web for updates on your tracked topics, synthesizes them into a personalized summary, and learns from your feedback over time.

The pattern is the same for all of these. Give Claude handles and hooks to operate a system, in the form of a CLI, and watch the magic happen.

## "I want to try the Pomodoro System Skill"

If you're running an Apple Silicon Mac, you can install the Pomodoro skill via the Claude Plugin Marketplace, and start using it immediately with Claude Code, with these three steps:

```bash
# 1. Add the marketplace
/plugin marketplace add jakedahn/pomodoro

# 2. Exit Claude Code
/exit

# 3. Run the install script (copies the skill files to your ~/.claude/skills/pomodoro/ directory)
~/.claude/plugins/marketplaces/pomodoro/install.sh
```

Then just say to Claude: _"Start a pomodoro for writing tests"_

As a sidenote, Claude Skills are not natively supported as a first class citizen in the Claude Code Plugin Marketplace yet, but you can still install a repo, and run an install script that installs the skill files to your `~/.claude/skills/` directory.

## "I want to build my own"

The Pomodoro implementation lives on GitHub as a reference: [github.com/jakedahn/pomodoro](https://github.com/jakedahn/pomodoro)

Clone it. Read the code. Hack it. Break it. It's deliberately kept simple-- ~600 lines of code total across three files. Get a feel for how a CLI, SQLite database, and `SKILL.md` vibe together.

## Closing Thoughts

I started this thinking about Skills with persistence. But what emerged feels bigger than that.

When you give Claude the handles to operate a system - a CLI to run commands, a database to remember things, and a tutorial on how it all works - something shifts. It's not just running commands anymore. It's turning the crank. Running its own OODA loop. Building context that compounds over time.

That's the phase change: chat agents and Skills joining to become something new - systems that Claude animates rather than just responds to.

I'm excited to see what System Skills y'all build with this pattern. Tag me on [X](https://x.com/jakedahn) or send me an email at [jake@shruggingface.com](mailto:jake@shruggingface.com).

---

_The Pomodoro skill is available at [github.com/jakedahn/pomodoro](https://github.com/jakedahn/pomodoro). The complete source code is included as a reference implementation for building your own System Skills._

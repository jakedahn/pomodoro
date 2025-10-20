// Simple timer for Pomodoro sessions

export interface TimerState {
  task: string;
  duration: number; // in seconds
  remaining: number; // in seconds
  startTime: number;
  sessionId?: number;
  isBreak: boolean; // true during break, false during work
  currentCycle: number;
  totalCycles: number;
}

export class PomodoroTimer {
  private state: TimerState | null = null;
  private intervalId: number | null = null;
  private onUpdate?: (state: TimerState) => void;
  private onComplete?: () => void;
  private onBreakStart?: () => void;
  private onCycleComplete?: () => void;

  // Cycle configuration
  private workDuration: number = 0;
  private breakDuration: number = 0;
  private totalCycles: number = 1;
  private currentCycle: number = 1;
  private task: string = "";

  start(
    task: string,
    workDuration: number,
    breakDuration: number = 0,
    cycles: number = 1,
    sessionId?: number
  ): void {
    this.task = task;
    this.workDuration = workDuration;
    this.breakDuration = breakDuration;
    this.totalCycles = cycles;
    this.currentCycle = 1;

    this.state = {
      task,
      duration: workDuration,
      remaining: workDuration,
      startTime: Date.now(),
      sessionId,
      isBreak: false,
      currentCycle: 1,
      totalCycles: cycles,
    };

    this.startCountdown();
  }

  stop(): TimerState | null {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const finalState = this.state;
    this.state = null;
    return finalState;
  }

  getState(): TimerState | null {
    return this.state;
  }

  setUpdateCallback(callback: (state: TimerState) => void): void {
    this.onUpdate = callback;
  }

  setCompleteCallback(callback: () => void): void {
    this.onComplete = callback;
  }

  setBreakStartCallback(callback: () => void): void {
    this.onBreakStart = callback;
  }

  setCycleCompleteCallback(callback: () => void): void {
    this.onCycleComplete = callback;
  }

  formatTimeRemaining(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  private startCountdown(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      if (!this.state) {
        clearInterval(this.intervalId!);
        return;
      }

      this.state.remaining--;

      if (this.onUpdate) {
        this.onUpdate(this.state);
      }

      if (this.state.remaining <= 0) {
        this.handleTimerComplete();
      }
    }, 1000);
  }

  private handleTimerComplete(): void {
    if (!this.state) return;

    if (this.state.isBreak) {
      // Break just finished
      if (this.currentCycle < this.totalCycles) {
        // Start next work session
        this.currentCycle++;
        this.startWorkSession();
      } else {
        // All cycles complete
        if (this.onComplete) {
          this.onComplete();
        }
        this.stop();
      }
    } else {
      // Work session just finished
      if (this.onCycleComplete) {
        this.onCycleComplete();
      }

      if (this.breakDuration > 0 && this.currentCycle <= this.totalCycles) {
        // Start break
        this.startBreakSession();
      } else if (this.currentCycle < this.totalCycles) {
        // No break, but more cycles - start next work session
        this.currentCycle++;
        this.startWorkSession();
      } else {
        // All done
        if (this.onComplete) {
          this.onComplete();
        }
        this.stop();
      }
    }
  }

  private startWorkSession(): void {
    this.state = {
      task: this.task,
      duration: this.workDuration,
      remaining: this.workDuration,
      startTime: Date.now(),
      isBreak: false,
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles,
    };
    this.startCountdown();
  }

  private startBreakSession(): void {
    if (this.onBreakStart) {
      this.onBreakStart();
    }

    this.state = {
      task: this.task,
      duration: this.breakDuration,
      remaining: this.breakDuration,
      startTime: Date.now(),
      isBreak: true,
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles,
    };
    this.startCountdown();
  }
}

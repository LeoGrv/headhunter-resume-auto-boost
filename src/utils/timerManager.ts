// HeadHunter Resume Auto-Boost Extension
// Timer Management System

import { addLogEntry } from './storage';

// Timer interface
export interface Timer {
  id: number;
  tabId: number;
  expirationTime: number;
  intervalMs: number;
  callback?: () => void;
  isActive: boolean;
}

// Timer callback type
export type TimerCallback = (tabId: number) => void | Promise<void>;

/**
 * Timer Manager Class
 * Manages individual timers for each resume tab
 */
export class TimerManager {
  private timers: Map<number, Timer> = new Map();
  private timeoutIds: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private callbacks: Map<number, TimerCallback> = new Map();
  private nextTimerId = 1;

  /**
   * Start a timer for a specific tab
   */
  public startTimer(tabId: number, intervalMs: number = 15 * 60 * 1000): void {
    try {
      console.log(
        `TimerManager: Starting timer for tab ${tabId} with interval ${intervalMs}ms (${intervalMs / 1000 / 60} minutes)`
      );

      // Stop existing timer if any
      this.stopTimer(tabId);

      const timerId = this.nextTimerId++;
      const expirationTime = Date.now() + intervalMs;

      const timer: Timer = {
        id: timerId,
        tabId: tabId,
        expirationTime: expirationTime,
        intervalMs: intervalMs,
        isActive: true,
      };

      // Store timer
      this.timers.set(tabId, timer);

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.handleTimerExpiration(tabId);
      }, intervalMs);

      this.timeoutIds.set(tabId, timeoutId);

      console.log(`✅ Timer started for tab ${tabId}:`, {
        timerId: timer.id,
        intervalMinutes: intervalMs / 1000 / 60,
        expirationTime: new Date(expirationTime).toLocaleTimeString(),
        isActive: timer.isActive,
      });

      this.logEvent('info', `Timer started for tab ${tabId}`, {
        tabId,
        intervalMs,
        expirationTime,
      });
    } catch (error) {
      console.error(`❌ Failed to start timer for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to start timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Stop a timer for a specific tab
   */
  public stopTimer(tabId: number): void {
    try {
      const timer = this.timers.get(tabId);
      const timeoutId = this.timeoutIds.get(tabId);

      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeoutIds.delete(tabId);
      }

      if (timer) {
        timer.isActive = false;
        this.timers.delete(tabId);
        console.log(`Timer stopped for tab ${tabId}`);
        this.logEvent('info', `Timer stopped for tab ${tabId}`, { tabId });
      }
    } catch (error) {
      console.error(`Failed to stop timer for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to stop timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reset a timer for a specific tab with a new interval
   */
  public resetTimer(tabId: number, intervalMs: number = 15 * 60 * 1000): void {
    try {
      console.log(
        `Resetting timer for tab ${tabId} with interval ${intervalMs / 1000 / 60} minutes`
      );
      this.stopTimer(tabId);
      this.startTimer(tabId, intervalMs);
      this.logEvent('info', `Timer reset for tab ${tabId}`, {
        tabId,
        intervalMs,
      });
    } catch (error) {
      console.error(`Failed to reset timer for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to reset timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get time remaining for a specific tab timer (in milliseconds)
   */
  public getTimeRemaining(tabId: number): number {
    try {
      const timer = this.timers.get(tabId);

      if (!timer || !timer.isActive) {
        return 0;
      }

      const remaining = timer.expirationTime - Date.now();
      return Math.max(0, remaining);
    } catch (error) {
      console.error(`Failed to get time remaining for tab ${tabId}:`, error);
      return 0;
    }
  }

  /**
   * Get time remaining in a human-readable format
   */
  public getTimeRemainingFormatted(tabId: number): string {
    const remainingMs = this.getTimeRemaining(tabId);

    if (remainingMs === 0) {
      return 'Timer not active';
    }

    const minutes = Math.floor(remainingMs / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Check if a timer is active for a specific tab
   */
  public isTimerActive(tabId: number): boolean {
    const timer = this.timers.get(tabId);
    return timer ? timer.isActive : false;
  }

  /**
   * Get all active timers
   */
  public getActiveTimers(): Timer[] {
    return Array.from(this.timers.values()).filter(timer => timer.isActive);
  }

  /**
   * Register a callback for timer expiration
   */
  public setCallback(tabId: number, callback: TimerCallback): void {
    this.callbacks.set(tabId, callback);
    console.log(`Callback registered for tab ${tabId}`);
  }

  /**
   * Remove callback for a specific tab
   */
  public removeCallback(tabId: number): void {
    this.callbacks.delete(tabId);
    console.log(`Callback removed for tab ${tabId}`);
  }

  /**
   * Set global callback for all timers
   */
  public setGlobalCallback(callback: TimerCallback): void {
    // Set callback for all existing timers
    for (const timer of this.timers.values()) {
      this.callbacks.set(timer.tabId, callback);
    }

    // Store for future timers
    this.globalCallback = callback;
    console.log('Global callback set for all timers');
  }

  private globalCallback?: TimerCallback;

  /**
   * Handle timer expiration
   */
  private async handleTimerExpiration(tabId: number): Promise<void> {
    try {
      console.log(`Timer expired for tab ${tabId}`);

      const timer = this.timers.get(tabId);
      if (!timer) {
        return;
      }

      // Mark timer as inactive
      timer.isActive = false;

      // Execute callback if registered
      const callback = this.callbacks.get(tabId) || this.globalCallback;
      if (callback) {
        try {
          console.log(`🔔 Executing timer callback for tab ${tabId}`);
          await callback(tabId);
          console.log(`✅ Timer callback completed for tab ${tabId}`);
        } catch (callbackError) {
          console.error(
            `❌ Timer callback failed for tab ${tabId}:`,
            callbackError
          );
          this.logEvent('error', `Timer callback failed for tab ${tabId}`, {
            tabId,
            error:
              callbackError instanceof Error
                ? callbackError.message
                : 'Unknown callback error',
          });
          // Continue execution even if callback fails - timer cleanup should still happen
        }
      } else {
        console.warn(
          `⚠️ No callback registered for tab ${tabId}, timer will not restart automatically`
        );
      }

      // Clean up
      this.timeoutIds.delete(tabId);
      this.timers.delete(tabId);

      this.logEvent('info', `Timer expired for tab ${tabId}`, { tabId });
    } catch (error) {
      console.error(
        `Failed to handle timer expiration for tab ${tabId}:`,
        error
      );
      this.logEvent(
        'error',
        `Failed to handle timer expiration for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Handle tab closure - clean up associated timer
   */
  public handleTabClosure(tabId: number): void {
    try {
      console.log(`Handling tab closure for tab ${tabId}`);

      this.stopTimer(tabId);
      this.removeCallback(tabId);

      this.logEvent('info', `Tab closed, timer cleaned up for tab ${tabId}`, {
        tabId,
      });
    } catch (error) {
      console.error(`Failed to handle tab closure for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to handle tab closure for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Pause a timer (stop without removing)
   */
  public pauseTimer(tabId: number): boolean {
    try {
      const timer = this.timers.get(tabId);
      if (!timer) {
        console.warn(`⚠️ No timer found for tab ${tabId} to pause`);
        return false;
      }

      if (!timer.isActive) {
        console.warn(`⚠️ Timer for tab ${tabId} is already paused`);
        return true; // Return true since it's already in desired state
      }

      const timeoutId = this.timeoutIds.get(tabId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeoutIds.delete(tabId);
      }

      // Calculate remaining time
      const now = Date.now();
      const remainingMs = Math.max(0, timer.expirationTime - now);

      // Update timer status
      timer.isActive = false;
      // Store remaining time for resume functionality
      (timer as any).remainingMs = remainingMs;

      console.log(
        `⏸️ Timer paused for tab ${tabId}, ${remainingMs}ms remaining`
      );
      this.logEvent('info', `⏸️ Timer paused for tab ${tabId}`, {
        tabId,
        remainingMs,
        remainingFormatted: this.getTimeRemainingFormatted(tabId),
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to pause timer for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to pause timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Resume a paused timer
   */
  public resumeTimer(tabId: number): boolean {
    try {
      const timer = this.timers.get(tabId);

      if (!timer) {
        console.warn(`⚠️ No timer found to resume for tab ${tabId}`);
        return false;
      }

      if (timer.isActive) {
        console.warn(`⚠️ Timer for tab ${tabId} is already active`);
        return true; // Return true since it's already in desired state
      }

      // Get remaining time from stored value or calculate from expiration
      const storedRemaining = (timer as any).remainingMs;
      const calculatedRemaining = Math.max(
        0,
        timer.expirationTime - Date.now()
      );
      const remainingTime = storedRemaining || calculatedRemaining;

      if (remainingTime > 0) {
        timer.isActive = true;
        // Update expiration time based on remaining time
        timer.expirationTime = Date.now() + remainingTime;

        const timeoutId = setTimeout(() => {
          this.handleTimerExpiration(tabId);
        }, remainingTime);

        this.timeoutIds.set(tabId, timeoutId);

        console.log(
          `▶️ Timer resumed for tab ${tabId}, ${remainingTime / 1000 / 60} minutes remaining`
        );
        this.logEvent('info', `▶️ Timer resumed for tab ${tabId}`, {
          tabId,
          remainingTime,
        });

        return true;
      } else {
        // Timer already expired, trigger immediately
        console.log(
          `⏰ Timer expired while paused for tab ${tabId}, triggering immediately`
        );
        this.handleTimerExpiration(tabId);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to resume timer for tab ${tabId}:`, error);
      this.logEvent('error', `Failed to resume timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get timer status for a specific tab
   */
  public getTimerStatus(tabId: number): {
    exists: boolean;
    isActive: boolean;
    remainingMs: number;
    remainingFormatted: string;
    expirationTime?: number;
    intervalMs?: number;
  } {
    console.log(`TimerManager: Getting status for timer ${tabId}`);

    const timer = this.timers.get(tabId);
    const remainingMs = this.getTimeRemaining(tabId);

    console.log(`TimerManager: Timer ${tabId} raw data:`, {
      timerExists: !!timer,
      timerData: timer
        ? {
            id: timer.id,
            tabId: timer.tabId,
            isActive: timer.isActive,
            expirationTime: new Date(timer.expirationTime).toLocaleTimeString(),
            intervalMs: timer.intervalMs,
          }
        : null,
      remainingMs: remainingMs,
    });

    const result: {
      exists: boolean;
      isActive: boolean;
      remainingMs: number;
      remainingFormatted: string;
      expirationTime?: number;
      intervalMs?: number;
    } = {
      exists: !!timer,
      isActive: timer ? timer.isActive : false,
      remainingMs: remainingMs,
      remainingFormatted: this.getTimeRemainingFormatted(tabId),
    };

    if (timer) {
      result.expirationTime = timer.expirationTime;
      result.intervalMs = timer.intervalMs;
    }

    console.log(`TimerManager: Timer ${tabId} final result:`, {
      exists: result.exists,
      isActive: result.isActive,
      remainingMs: result.remainingMs,
      remainingFormatted: result.remainingFormatted,
    });

    return result;
  }

  /**
   * Clean up all timers
   */
  public cleanup(): void {
    try {
      console.log('Cleaning up all timers...');

      // Clear all timeouts
      for (const timeoutId of this.timeoutIds.values()) {
        clearTimeout(timeoutId);
      }

      // Clear all data
      this.timers.clear();
      this.timeoutIds.clear();
      this.callbacks.clear();

      console.log('All timers cleaned up');
      this.logEvent('info', 'All timers cleaned up', {});
    } catch (error) {
      console.error('Failed to cleanup timers:', error);
      this.logEvent('error', 'Failed to cleanup timers', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Log events for debugging and monitoring
   */
  private async logEvent(
    level: 'info' | 'warning' | 'error',
    message: string,
    data: any
  ): Promise<void> {
    try {
      await addLogEntry({
        level: level,
        message: `TimerManager: ${message}`,
        data: data,
      });
    } catch (error) {
      console.error('Failed to log timer event:', error);
    }
  }
}

// Export singleton instance
export const timerManager = new TimerManager();

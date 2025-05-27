// HeadHunter Resume Auto-Boost Extension
// Alarm-based Timer Management System for reliable background operation

import { addLogEntry } from './storage';

// Timer callback type
export type AlarmTimerCallback = (tabId: number) => void | Promise<void>;

/**
 * Alarm-based Timer Manager Class
 * Uses chrome.alarms API for reliable background timers that work even when Service Worker sleeps
 */
export class AlarmTimerManager {
  private callbacks: Map<number, AlarmTimerCallback> = new Map();
  private globalCallback?: AlarmTimerCallback;
  private timers: Map<
    number,
    {
      tabId: number;
      intervalMs: number;
      startTime: number;
      isActive: boolean;
      alarmName: string;
    }
  > = new Map();

  constructor() {
    // Set up alarm listener
    chrome.alarms.onAlarm.addListener(alarm => {
      this.handleAlarmExpiration(alarm);
    });

    console.log('AlarmTimerManager initialized with chrome.alarms listener');
  }

  /**
   * Start a timer for a specific tab using chrome.alarms
   */
  public async startTimer(
    tabId: number,
    intervalMs: number = 15 * 60 * 1000
  ): Promise<void> {
    try {
      console.log(
        `AlarmTimerManager: Starting alarm timer for tab ${tabId} with interval ${intervalMs}ms (${intervalMs / 1000 / 60} minutes)`
      );

      // Stop existing timer if any
      await this.stopTimer(tabId);

      const alarmName = `tab_${tabId}_timer`;
      const delayInMinutes = intervalMs / (1000 * 60);

      // Chrome alarms minimum is 1 minute, so for shorter intervals use setTimeout as fallback
      if (delayInMinutes < 1) {
        console.warn(
          `Interval ${delayInMinutes} minutes is too short for chrome.alarms, using setTimeout fallback`
        );
        this.startTimeoutTimer(tabId, intervalMs);
        return;
      }

      // Create chrome alarm
      await chrome.alarms.create(alarmName, {
        delayInMinutes: delayInMinutes,
      });

      // Store timer info
      const timer = {
        tabId: tabId,
        intervalMs: intervalMs,
        startTime: Date.now(),
        isActive: true,
        alarmName: alarmName,
      };

      this.timers.set(tabId, timer);

      console.log(`✅ Alarm timer started for tab ${tabId}:`, {
        alarmName: alarmName,
        intervalMinutes: delayInMinutes,
        startTime: new Date(timer.startTime).toLocaleTimeString(),
        isActive: timer.isActive,
      });

      await this.logEvent('info', `Alarm timer started for tab ${tabId}`, {
        tabId,
        intervalMs,
        alarmName,
      });
    } catch (error) {
      console.error(`❌ Failed to start alarm timer for tab ${tabId}:`, error);
      await this.logEvent(
        'error',
        `Failed to start alarm timer for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Fallback setTimeout timer for intervals < 1 minute
   */
  private startTimeoutTimer(tabId: number, intervalMs: number): void {
    const alarmName = `tab_${tabId}_timeout`;

    setTimeout(() => {
      this.handleTimerExpiration(tabId);
    }, intervalMs);

    // Store timer info
    const timer = {
      tabId: tabId,
      intervalMs: intervalMs,
      startTime: Date.now(),
      isActive: true,
      alarmName: alarmName,
    };

    this.timers.set(tabId, timer);
    console.log(`✅ Timeout timer started for tab ${tabId} (${intervalMs}ms)`);
  }

  /**
   * Stop a timer for a specific tab
   */
  public async stopTimer(tabId: number): Promise<void> {
    try {
      const timer = this.timers.get(tabId);

      if (timer) {
        // Clear chrome alarm if it exists
        if (timer.alarmName && timer.alarmName.includes('timer')) {
          await chrome.alarms.clear(timer.alarmName);
          console.log(`Alarm cleared: ${timer.alarmName}`);
        }

        // Mark as inactive and remove
        timer.isActive = false;
        this.timers.delete(tabId);

        console.log(`Timer stopped for tab ${tabId}`);
        await this.logEvent('info', `Timer stopped for tab ${tabId}`, {
          tabId,
        });
      }
    } catch (error) {
      console.error(`Failed to stop timer for tab ${tabId}:`, error);
      await this.logEvent('error', `Failed to stop timer for tab ${tabId}`, {
        tabId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reset a timer for a specific tab with a new interval
   */
  public async resetTimer(
    tabId: number,
    intervalMs: number = 15 * 60 * 1000
  ): Promise<void> {
    try {
      console.log(
        `Resetting alarm timer for tab ${tabId} with interval ${intervalMs / 1000 / 60} minutes`
      );
      await this.stopTimer(tabId);
      await this.startTimer(tabId, intervalMs);
      await this.logEvent('info', `Timer reset for tab ${tabId}`, {
        tabId,
        intervalMs,
      });
    } catch (error) {
      console.error(`Failed to reset timer for tab ${tabId}:`, error);
      await this.logEvent('error', `Failed to reset timer for tab ${tabId}`, {
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

      const elapsed = Date.now() - timer.startTime;
      const remaining = timer.intervalMs - elapsed;
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
  public getActiveTimers(): Array<{
    tabId: number;
    intervalMs: number;
    startTime: number;
    alarmName: string;
  }> {
    return Array.from(this.timers.values()).filter(timer => timer.isActive);
  }

  /**
   * Register a callback for timer expiration
   */
  public setCallback(tabId: number, callback: AlarmTimerCallback): void {
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
  public setGlobalCallback(callback: AlarmTimerCallback): void {
    // Set callback for all existing timers
    for (const timer of this.timers.values()) {
      this.callbacks.set(timer.tabId, callback);
    }

    // Store for future timers
    this.globalCallback = callback;
    console.log('Global callback set for all alarm timers');
  }

  /**
   * Handle chrome.alarms.onAlarm event
   */
  private async handleAlarmExpiration(
    alarm: chrome.alarms.Alarm
  ): Promise<void> {
    try {
      console.log(`Chrome alarm fired: ${alarm.name}`);

      // Extract tab ID from alarm name
      const match = alarm.name.match(/^tab_(\d+)_timer$/);
      if (!match) {
        console.warn(`Unknown alarm format: ${alarm.name}`);
        return;
      }

      const tabId = parseInt(match[1] || '0', 10);
      await this.handleTimerExpiration(tabId);
    } catch (error) {
      console.error(
        `Failed to handle alarm expiration for ${alarm.name}:`,
        error
      );
    }
  }

  /**
   * Handle timer expiration (both alarm and timeout)
   */
  private async handleTimerExpiration(tabId: number): Promise<void> {
    try {
      console.log(`AlarmTimerManager: Timer expired for tab ${tabId}`);

      const timer = this.timers.get(tabId);
      if (!timer) {
        console.warn(`No timer found for expired tab ${tabId}`);
        return;
      }

      // Mark timer as inactive
      timer.isActive = false;

      // Execute callback if registered
      const callback = this.callbacks.get(tabId) || this.globalCallback;
      if (callback) {
        try {
          console.log(`🔔 Executing alarm timer callback for tab ${tabId}`);
          await callback(tabId);
          console.log(`✅ Alarm timer callback completed for tab ${tabId}`);
        } catch (callbackError) {
          console.error(
            `❌ Alarm timer callback failed for tab ${tabId}:`,
            callbackError
          );
          await this.logEvent(
            'error',
            `Alarm timer callback failed for tab ${tabId}`,
            {
              tabId,
              error:
                callbackError instanceof Error
                  ? callbackError.message
                  : 'Unknown callback error',
            }
          );
        }
      } else {
        console.warn(
          `⚠️ No callback registered for tab ${tabId}, timer will not restart automatically`
        );
      }

      // Clean up
      this.timers.delete(tabId);

      await this.logEvent('info', `Alarm timer expired for tab ${tabId}`, {
        tabId,
      });
    } catch (error) {
      console.error(
        `Failed to handle timer expiration for tab ${tabId}:`,
        error
      );
      await this.logEvent(
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
  public async handleTabClosure(tabId: number): Promise<void> {
    try {
      console.log(`Handling tab closure for tab ${tabId}`);

      await this.stopTimer(tabId);
      this.removeCallback(tabId);

      await this.logEvent(
        'info',
        `Tab closed, alarm timer cleaned up for tab ${tabId}`,
        { tabId }
      );
    } catch (error) {
      console.error(`Failed to handle tab closure for tab ${tabId}:`, error);
      await this.logEvent(
        'error',
        `Failed to handle tab closure for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Pause a timer (stop without removing)
   */
  public async pauseTimer(tabId: number): Promise<boolean> {
    try {
      const timer = this.timers.get(tabId);
      if (!timer) {
        console.warn(`⚠️ No timer found for tab ${tabId} to pause`);
        return false;
      }

      if (!timer.isActive) {
        console.warn(`⚠️ Timer for tab ${tabId} is already paused`);
        return true;
      }

      // Clear alarm
      if (timer.alarmName && timer.alarmName.includes('timer')) {
        await chrome.alarms.clear(timer.alarmName);
      }

      // Calculate remaining time
      const remainingMs = this.getTimeRemaining(tabId);

      // Update timer status
      timer.isActive = false;
      // Store remaining time for resume functionality
      (timer as any).remainingMs = remainingMs;

      console.log(
        `⏸️ Alarm timer paused for tab ${tabId}, ${remainingMs}ms remaining`
      );
      await this.logEvent('info', `⏸️ Alarm timer paused for tab ${tabId}`, {
        tabId,
        remainingMs,
        remainingFormatted: this.getTimeRemainingFormatted(tabId),
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to pause alarm timer for tab ${tabId}:`, error);
      await this.logEvent(
        'error',
        `Failed to pause alarm timer for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      return false;
    }
  }

  /**
   * Resume a paused timer
   */
  public async resumeTimer(tabId: number): Promise<boolean> {
    try {
      const timer = this.timers.get(tabId);

      if (!timer) {
        console.warn(`⚠️ No timer found to resume for tab ${tabId}`);
        return false;
      }

      if (timer.isActive) {
        console.warn(`⚠️ Timer for tab ${tabId} is already active`);
        return true;
      }

      // Get remaining time from stored value
      const storedRemaining = (timer as any).remainingMs || 0;

      if (storedRemaining > 0) {
        // Restart timer with remaining time
        await this.startTimer(tabId, storedRemaining);

        console.log(
          `▶️ Alarm timer resumed for tab ${tabId}, ${storedRemaining / 1000 / 60} minutes remaining`
        );
        await this.logEvent('info', `▶️ Alarm timer resumed for tab ${tabId}`, {
          tabId,
          remainingTime: storedRemaining,
        });

        return true;
      } else {
        // Timer already expired, trigger immediately
        console.log(
          `⏰ Timer expired while paused for tab ${tabId}, triggering immediately`
        );
        await this.handleTimerExpiration(tabId);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to resume alarm timer for tab ${tabId}:`, error);
      await this.logEvent(
        'error',
        `Failed to resume alarm timer for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
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
    startTime?: number;
    intervalMs?: number;
    alarmName?: string;
  } {
    console.log(`AlarmTimerManager: Getting status for timer ${tabId}`);

    const timer = this.timers.get(tabId);
    const remainingMs = this.getTimeRemaining(tabId);

    console.log(`AlarmTimerManager: Timer ${tabId} raw data:`, {
      timerExists: !!timer,
      timerData: timer
        ? {
            tabId: timer.tabId,
            isActive: timer.isActive,
            startTime: new Date(timer.startTime).toLocaleTimeString(),
            intervalMs: timer.intervalMs,
            alarmName: timer.alarmName,
          }
        : null,
      remainingMs: remainingMs,
    });

    const result: {
      exists: boolean;
      isActive: boolean;
      remainingMs: number;
      remainingFormatted: string;
      startTime?: number;
      intervalMs?: number;
      alarmName?: string;
    } = {
      exists: !!timer,
      isActive: timer ? timer.isActive : false,
      remainingMs: remainingMs,
      remainingFormatted: this.getTimeRemainingFormatted(tabId),
    };

    if (timer) {
      result.startTime = timer.startTime;
      result.intervalMs = timer.intervalMs;
      result.alarmName = timer.alarmName;
    }

    console.log(`AlarmTimerManager: Timer ${tabId} final result:`, {
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
  public async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up all alarm timers...');

      // Clear all chrome alarms
      for (const timer of this.timers.values()) {
        if (timer.alarmName && timer.alarmName.includes('timer')) {
          await chrome.alarms.clear(timer.alarmName);
        }
      }

      // Clear all data
      this.timers.clear();
      this.callbacks.clear();

      console.log('All alarm timers cleaned up');
      await this.logEvent('info', 'All alarm timers cleaned up', {});
    } catch (error) {
      console.error('Failed to cleanup alarm timers:', error);
      await this.logEvent('error', 'Failed to cleanup alarm timers', {
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
        message: `AlarmTimerManager: ${message}`,
        data: data,
      });
    } catch (error) {
      console.error('Failed to log alarm timer event:', error);
    }
  }
}

// Export singleton instance
export const alarmTimerManager = new AlarmTimerManager();

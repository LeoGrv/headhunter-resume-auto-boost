// HeadHunter Resume Auto-Boost Extension
// Persistent Alarm Manager with State Recovery

import { addLogEntry } from './storage';

// Timer callback type
export type PersistentAlarmCallback = (tabId: number) => void | Promise<void>;

// Persistent timer data
interface PersistentTimer {
  tabId: number;
  intervalMs: number;
  startTime: number;
  expirationTime: number;
  isActive: boolean;
  alarmName: string;
  retryCount: number;
  lastError?: string;
}

/**
 * Persistent Alarm Manager with automatic state recovery
 */
export class PersistentAlarmManager {
  private callbacks: Map<number, PersistentAlarmCallback> = new Map();
  private globalCallback?: PersistentAlarmCallback;
  private timers: Map<number, PersistentTimer> = new Map();

  // ✅ CRITICAL: Prevent concurrent processing of the same timer
  private processingTimers: Set<number> = new Set();

  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private keepAliveAlarmName = 'keep_alive_alarm';

  constructor() {
    // Set up alarm listener
    chrome.alarms.onAlarm.addListener(alarm => {
      this.handleAlarmExpiration(alarm);
    });

    console.log('PersistentAlarmManager initialized');
    this.initialize();
  }

  /**
   * Initialize the manager and restore state
   */
  private async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing PersistentAlarmManager...');

      // Restore state from storage
      await this.restoreState();

      // Verify and sync chrome alarms
      await this.syncChromeAlarms();

      // Start health check
      this.startHealthCheck();

      // Start keep-alive mechanism
      this.startKeepAlive();

      console.log('✅ PersistentAlarmManager initialized successfully');

      await this.logEvent('info', 'PersistentAlarmManager initialized', {});
    } catch (error) {
      console.error('❌ Failed to initialize PersistentAlarmManager:', error);
      await this.logEvent(
        'error',
        'Failed to initialize PersistentAlarmManager',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Restore timer state from Chrome Storage
   */
  private async restoreState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('persistent_timers');
      const storedTimers = result.persistent_timers || {};

      console.log(
        '📥 Restoring timer state:',
        Object.keys(storedTimers).length,
        'timers'
      );

      for (const [tabIdStr, timerData] of Object.entries(storedTimers)) {
        const tabId = parseInt(tabIdStr, 10);
        const timer = timerData as PersistentTimer;

        // Check if timer should still be active
        const now = Date.now();
        if (timer.isActive && timer.expirationTime > now) {
          // Timer is still valid, restore it
          this.timers.set(tabId, timer);
          console.log(
            `✅ Restored timer for tab ${tabId}, expires in ${Math.round((timer.expirationTime - now) / 1000)}s`
          );
        } else if (timer.isActive && timer.expirationTime <= now) {
          // Timer expired while we were offline, trigger it now
          console.log(
            `⏰ Timer for tab ${tabId} expired while offline, triggering now`
          );
          await this.handleTimerExpiration(tabId);
        }
      }

      await this.logEvent('info', 'Timer state restored', {
        restoredCount: this.timers.size,
      });
    } catch (error) {
      console.error('❌ Failed to restore state:', error);
      await this.logEvent('error', 'Failed to restore state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sync our internal state with Chrome alarms
   */
  private async syncChromeAlarms(): Promise<void> {
    try {
      const chromeAlarms = await chrome.alarms.getAll();
      const ourAlarms = chromeAlarms.filter(
        alarm => alarm.name.startsWith('tab_') && alarm.name.endsWith('_timer')
      );

      console.log('🔄 Syncing with Chrome alarms:', ourAlarms.length, 'found');

      // Check for orphaned Chrome alarms (alarms without corresponding timers)
      for (const alarm of ourAlarms) {
        const match = alarm.name.match(/^tab_(\d+)_timer$/);
        if (match) {
          const tabId = parseInt(match[1] || '0', 10);
          if (!this.timers.has(tabId)) {
            console.log(`🧹 Cleaning up orphaned alarm: ${alarm.name}`);
            await chrome.alarms.clear(alarm.name);
          }
        }
      }

      // Check for timers without corresponding Chrome alarms
      for (const [tabId, timer] of this.timers.entries()) {
        if (timer.isActive && timer.alarmName.includes('timer')) {
          const alarmExists = ourAlarms.some(
            alarm => alarm.name === timer.alarmName
          );
          if (!alarmExists) {
            console.log(`🔧 Recreating missing alarm for tab ${tabId}`);
            const remainingMs = Math.max(0, timer.expirationTime - Date.now());
            if (remainingMs > 0) {
              await this.createChromeAlarm(timer.alarmName, remainingMs);
            } else {
              // Timer expired, trigger it
              await this.handleTimerExpiration(tabId);
            }
          }
        }
      }

      await this.logEvent('info', 'Chrome alarms synced', {
        chromeAlarms: ourAlarms.length,
        internalTimers: this.timers.size,
      });
    } catch (error) {
      console.error('❌ Failed to sync Chrome alarms:', error);
      await this.logEvent('error', 'Failed to sync Chrome alarms', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start health check system
   */
  private startHealthCheck(): void {
    // Run health check every 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthCheck();
      },
      5 * 60 * 1000
    );

    console.log('💓 Health check system started');
  }

  /**
   * Start keep-alive mechanism to prevent Service Worker from sleeping
   */
  private async startKeepAlive(): Promise<void> {
    try {
      // Create a keep-alive alarm that fires every 25 seconds
      // This keeps the Service Worker active even when Chrome loses focus
      await chrome.alarms.create(this.keepAliveAlarmName, {
        delayInMinutes: 1, // Start in 1 minute
        periodInMinutes: 1, // Repeat every minute
      });

      console.log('🔄 Keep-alive mechanism started (1-minute heartbeat)');
      await this.logEvent('info', 'Keep-alive mechanism started', {});
    } catch (error) {
      console.error('❌ Failed to start keep-alive mechanism:', error);
      await this.logEvent('error', 'Failed to start keep-alive mechanism', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('💓 Performing health check...');

      // Check if timers are still valid
      const now = Date.now();
      let expiredCount = 0;
      let activeCount = 0;

      for (const [tabId, timer] of this.timers.entries()) {
        if (timer.isActive) {
          activeCount++;
          if (timer.expirationTime <= now) {
            console.log(`⏰ Health check found expired timer for tab ${tabId}`);
            await this.handleTimerExpiration(tabId);
            expiredCount++;
          }
        }
      }

      // Sync with Chrome alarms
      await this.syncChromeAlarms();

      // Save current state
      await this.saveState();

      console.log(
        `💓 Health check completed: ${activeCount} active, ${expiredCount} expired`
      );

      await this.logEvent('info', 'Health check completed', {
        activeTimers: activeCount,
        expiredTimers: expiredCount,
      });
    } catch (error) {
      console.error('❌ Health check failed:', error);
      await this.logEvent('error', 'Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Save current state to Chrome Storage
   */
  private async saveState(): Promise<void> {
    try {
      const timersData: Record<string, PersistentTimer> = {};

      for (const [tabId, timer] of this.timers.entries()) {
        timersData[tabId.toString()] = timer;
      }

      await chrome.storage.local.set({ persistent_timers: timersData });
      console.log(
        '💾 Timer state saved:',
        Object.keys(timersData).length,
        'timers'
      );
    } catch (error) {
      console.error('❌ Failed to save state:', error);
      await this.logEvent('error', 'Failed to save state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create Chrome alarm with error handling
   */
  private async createChromeAlarm(
    alarmName: string,
    delayMs: number
  ): Promise<boolean> {
    try {
      // Convert to minutes, but use minimum 1 minute for Chrome alarms
      // For shorter intervals, we'll use 1 minute and check remaining time in callback
      const delayInMinutes = Math.max(1, delayMs / (1000 * 60));

      await chrome.alarms.create(alarmName, {
        delayInMinutes: delayInMinutes,
      });

      // Verify alarm was created
      const alarm = await chrome.alarms.get(alarmName);
      if (alarm) {
        console.log(
          `✅ Chrome alarm created: ${alarmName} (${delayInMinutes} min, original: ${delayMs}ms)`
        );
        return true;
      } else {
        console.error(`❌ Chrome alarm creation failed: ${alarmName}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to create Chrome alarm ${alarmName}:`, error);
      return false;
    }
  }

  /**
   * Start a timer for a specific tab with persistence
   */
  public async startTimer(
    tabId: number,
    intervalMs: number = 15 * 60 * 1000
  ): Promise<void> {
    try {
      console.log(
        `🚀 Starting persistent timer for tab ${tabId} with interval ${intervalMs}ms (${intervalMs / 1000 / 60} minutes)`
      );

      // Stop existing timer if any (clear Chrome alarm)
      await this.stopTimer(tabId);

      const alarmName = `tab_${tabId}_timer`;
      const now = Date.now();
      const expirationTime = now + intervalMs;

      // Create or update persistent timer data
      const existingTimer = this.timers.get(tabId);
      const timer: PersistentTimer = {
        tabId: tabId,
        intervalMs: intervalMs,
        startTime: now,
        expirationTime: expirationTime,
        isActive: true,
        alarmName: alarmName,
        retryCount: existingTimer?.retryCount || 0, // Preserve retry count
      };

      // Clear previous errors on new start (don't set undefined, just omit the property)
      if (existingTimer?.lastError) {
        // lastError will be omitted from the new timer object
      }

      // Store timer
      this.timers.set(tabId, timer);

      // Create Chrome alarm (always use alarms, no setTimeout fallback)
      const alarmCreated = await this.createChromeAlarm(alarmName, intervalMs);

      if (!alarmCreated) {
        console.error(
          `❌ Failed to create Chrome alarm for tab ${tabId}, timer will not work`
        );
        // Don't use setTimeout as fallback - it doesn't work when Service Worker sleeps
        timer.isActive = false;
        this.timers.delete(tabId);
        await this.logEvent(
          'error',
          `Failed to create alarm for tab ${tabId}`,
          { tabId, intervalMs }
        );
        return;
      }

      // Save state
      await this.saveState();

      console.log(`✅ Persistent timer started for tab ${tabId}:`, {
        alarmName: alarmName,
        intervalMinutes: intervalMs / 1000 / 60,
        expirationTime: new Date(expirationTime).toLocaleTimeString(),
        alarmCreated: alarmCreated,
        isRestart: !!existingTimer,
      });

      await this.logEvent('info', `Persistent timer started for tab ${tabId}`, {
        tabId,
        intervalMs,
        alarmName,
        alarmCreated,
        isRestart: !!existingTimer,
      });
    } catch (error) {
      console.error(
        `❌ Failed to start persistent timer for tab ${tabId}:`,
        error
      );
      await this.logEvent(
        'error',
        `Failed to start persistent timer for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
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
          console.log(`🗑️ Alarm cleared: ${timer.alarmName}`);
        }

        // Remove timer
        this.timers.delete(tabId);

        // Save state
        await this.saveState();

        console.log(`⏹️ Persistent timer stopped for tab ${tabId}`);
        await this.logEvent(
          'info',
          `Persistent timer stopped for tab ${tabId}`,
          { tabId }
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to stop persistent timer for tab ${tabId}:`,
        error
      );
      await this.logEvent(
        'error',
        `Failed to stop persistent timer for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Handle timer expiration with retry logic
   */
  private async handleTimerExpiration(tabId: number): Promise<void> {
    const startTime = Date.now();

    // ✅ CRITICAL: Prevent concurrent processing of the same timer
    if (this.processingTimers.has(tabId)) {
      console.warn(
        `⚠️ Timer for tab ${tabId} is already being processed, skipping duplicate`
      );
      return;
    }

    this.processingTimers.add(tabId);

    try {
      console.log(
        `⏰ [${new Date().toLocaleTimeString()}] Persistent timer expired for tab ${tabId} - STARTING PROCESSING`
      );

      const timer = this.timers.get(tabId);
      if (!timer) {
        console.warn(`⚠️ No timer found for expired tab ${tabId}`);
        return;
      }

      // ✅ CRITICAL: Log concurrent processing
      const activeTimers = Array.from(this.timers.values()).filter(
        t => t.isActive
      );
      console.log(
        `📊 Processing tab ${tabId} - Active timers: ${activeTimers.length}, Total timers: ${this.timers.size}`
      );
      console.log(
        `📊 Active timer tabs: [${activeTimers.map(t => t.tabId).join(', ')}]`
      );
      console.log(
        `📊 Currently processing tabs: [${Array.from(this.processingTimers).join(', ')}]`
      );

      // Check if timer actually expired (important for short intervals that use 1-minute alarms)
      const now = Date.now();
      const remainingMs = timer.expirationTime - now;

      if (remainingMs > 30000) {
        // More than 30 seconds remaining
        console.log(
          `⏰ Timer for tab ${tabId} fired early, ${Math.round(remainingMs / 1000)}s remaining. Rescheduling...`
        );

        // Reschedule with remaining time
        await this.createChromeAlarm(timer.alarmName, remainingMs);
        return;
      }

      // Mark timer as inactive temporarily during callback execution
      timer.isActive = false;

      // Execute callback if registered
      const callback = this.callbacks.get(tabId) || this.globalCallback;
      if (callback) {
        try {
          console.log(
            `🔔 Executing persistent timer callback for tab ${tabId}`
          );
          await callback(tabId);
          console.log(
            `✅ Persistent timer callback completed for tab ${tabId}`
          );

          // Reset retry count on success
          timer.retryCount = 0;

          // ✅ CRITICAL FIX: Don't delete timer here!
          // The Service Worker callback will call startTimer() again with new interval
          // We just mark it as inactive and let the callback handle restart
        } catch (callbackError) {
          console.error(
            `❌ Persistent timer callback failed for tab ${tabId}:`,
            callbackError
          );

          // Increment retry count
          timer.retryCount = (timer.retryCount || 0) + 1;
          timer.lastError =
            callbackError instanceof Error
              ? callbackError.message
              : 'Unknown callback error';

          await this.logEvent(
            'error',
            `Persistent timer callback failed for tab ${tabId}`,
            {
              tabId,
              retryCount: timer.retryCount,
              error: timer.lastError,
            }
          );

          // Retry logic: if retries < 5, try again with increasing intervals
          if (timer.retryCount < 5) {
            // Exponential backoff: 1min, 2min, 5min, 10min, 15min
            const retryIntervals = [1, 2, 5, 10, 15];
            const retryMinutes = retryIntervals[timer.retryCount - 1] || 15;
            const retryMs = retryMinutes * 60 * 1000;

            console.log(
              `🔄 Scheduling retry ${timer.retryCount}/5 for tab ${tabId} in ${retryMinutes} minutes`
            );

            // Update timer for retry
            timer.expirationTime = now + retryMs;
            timer.isActive = true;

            try {
              await this.createChromeAlarm(timer.alarmName, retryMs);
              await this.saveState();
              console.log(`✅ Retry timer scheduled for tab ${tabId}`);
              return;
            } catch (retryError) {
              console.error(
                `❌ Failed to schedule retry for tab ${tabId}:`,
                retryError
              );
              // Continue to fallback logic below
            }
          }

          // If max retries exceeded or retry scheduling failed, use fallback
          console.warn(
            `⚠️ Max retries exceeded or retry failed for tab ${tabId}, using fallback timer`
          );

          // Don't delete timer, instead set it to a long interval (30 minutes) as fallback
          timer.retryCount = 0; // Reset retry count
          timer.expirationTime = now + 30 * 60 * 1000; // 30 minutes fallback
          timer.isActive = true;

          try {
            await this.createChromeAlarm(timer.alarmName, 30 * 60 * 1000);
            await this.saveState();
            console.log(`✅ Fallback timer set for tab ${tabId} (30 minutes)`);
            return;
          } catch (fallbackError) {
            console.error(
              `❌ Even fallback timer failed for tab ${tabId}:`,
              fallbackError
            );
            // Only now delete the timer if everything failed
            this.timers.delete(tabId);
            await this.saveState();
            return;
          }
        }
      } else {
        console.warn(
          `⚠️ No callback registered for tab ${tabId}, removing timer`
        );
        // Only delete timer if no callback is registered
        this.timers.delete(tabId);
        await this.saveState();
        return;
      }

      // ✅ CRITICAL FIX: Don't delete timer automatically!
      // Save state but keep timer in memory for potential restart by Service Worker
      await this.saveState();

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ [${new Date().toLocaleTimeString()}] Timer processing COMPLETED for tab ${tabId} in ${processingTime}ms`
      );

      await this.logEvent('info', `Persistent timer expired for tab ${tabId}`, {
        tabId,
        retryCount: timer.retryCount,
        processingTimeMs: processingTime,
      });
    } catch (error) {
      console.error(
        `❌ Failed to handle persistent timer expiration for tab ${tabId}:`,
        error
      );
      await this.logEvent(
        'error',
        `Failed to handle persistent timer expiration for tab ${tabId}`,
        {
          tabId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );

      // ✅ CRITICAL: Emergency timer restart even if handleTimerExpiration failed
      try {
        const timer = this.timers.get(tabId);
        if (timer) {
          console.log(
            `🚨 Emergency timer restart for tab ${tabId} after critical error in handleTimerExpiration`
          );

          // Set emergency timer for 15 minutes
          timer.expirationTime = Date.now() + 15 * 60 * 1000;
          timer.isActive = true;
          timer.retryCount = Math.min((timer.retryCount || 0) + 1, 3); // Increment but cap at 3

          await this.createChromeAlarm(timer.alarmName, 15 * 60 * 1000);
          await this.saveState();

          console.log(`✅ Emergency timer set for tab ${tabId} (15 minutes)`);
        }
      } catch (emergencyError) {
        console.error(
          `❌ Emergency timer restart failed for tab ${tabId}:`,
          emergencyError
        );
        // If even emergency restart fails, health check will eventually recover
      }
    } finally {
      // ✅ CRITICAL: Always release the processing lock
      this.processingTimers.delete(tabId);
      console.log(`🔓 Released processing lock for tab ${tabId}`);
    }
  }

  /**
   * Handle chrome.alarms.onAlarm event
   */
  private async handleAlarmExpiration(
    alarm: chrome.alarms.Alarm
  ): Promise<void> {
    try {
      console.log(
        `🔔 Chrome alarm fired: ${alarm.name} at ${new Date().toLocaleTimeString()}`
      );

      // Handle keep-alive alarm
      if (alarm.name === this.keepAliveAlarmName) {
        console.log('💓 Keep-alive heartbeat');
        // Just log that we're alive - this keeps Service Worker active
        await this.logEvent('info', 'Keep-alive heartbeat', {
          activeTimers: this.timers.size,
        });
        return;
      }

      // Extract tab ID from alarm name
      const match = alarm.name.match(/^tab_(\d+)_timer$/);
      if (!match) {
        console.warn(`⚠️ Unknown alarm format: ${alarm.name}`);
        return;
      }

      const tabId = parseInt(match[1] || '0', 10);

      // ✅ CRITICAL: Process each timer independently and asynchronously
      // Don't await here to prevent blocking other timers
      this.handleTimerExpiration(tabId).catch(error => {
        console.error(
          `❌ Async timer expiration failed for tab ${tabId}:`,
          error
        );
      });

      console.log(
        `🚀 Timer expiration processing started for tab ${tabId} (non-blocking)`
      );
    } catch (error) {
      console.error(
        `❌ Failed to handle alarm expiration for ${alarm.name}:`,
        error
      );
    }
  }

  /**
   * Set global callback for all timers
   */
  public setGlobalCallback(callback: PersistentAlarmCallback): void {
    this.globalCallback = callback;
    console.log('🌐 Global callback set for persistent timers');
  }

  /**
   * Remove callback for a specific tab
   */
  public removeCallback(tabId: number): void {
    this.callbacks.delete(tabId);
    console.log(`🗑️ Callback removed for tab ${tabId}`);
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
    retryCount?: number;
  } {
    const timer = this.timers.get(tabId);

    if (!timer) {
      return {
        exists: false,
        isActive: false,
        remainingMs: 0,
        remainingFormatted: 'Timer not active',
      };
    }

    const now = Date.now();
    const remainingMs = Math.max(0, timer.expirationTime - now);

    const minutes = Math.floor(remainingMs / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    const remainingFormatted =
      remainingMs === 0
        ? 'Timer not active'
        : minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;

    return {
      exists: true,
      isActive: timer.isActive,
      remainingMs: remainingMs,
      remainingFormatted: remainingFormatted,
      startTime: timer.startTime,
      intervalMs: timer.intervalMs,
      alarmName: timer.alarmName,
      retryCount: timer.retryCount,
    };
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
    retryCount: number;
  }> {
    return Array.from(this.timers.values()).filter(timer => timer.isActive);
  }

  /**
   * Reset a timer for a specific tab with a new interval
   */
  public async resetTimer(
    tabId: number,
    intervalMs: number = 15 * 60 * 1000
  ): Promise<void> {
    console.log(
      `🔄 Resetting persistent timer for tab ${tabId} with interval ${intervalMs / 1000 / 60} minutes`
    );
    await this.stopTimer(tabId);
    await this.startTimer(tabId, intervalMs);
  }

  /**
   * Pause a timer (stop without removing)
   */
  public async pauseTimer(tabId: number): Promise<boolean> {
    try {
      const timer = this.timers.get(tabId);
      if (!timer || !timer.isActive) {
        return false;
      }

      // Clear alarm
      if (timer.alarmName && timer.alarmName.includes('timer')) {
        await chrome.alarms.clear(timer.alarmName);
      }

      // Calculate remaining time and store it
      const remainingMs = Math.max(0, timer.expirationTime - Date.now());
      timer.isActive = false;
      (timer as any).remainingMs = remainingMs;

      await this.saveState();

      console.log(
        `⏸️ Persistent timer paused for tab ${tabId}, ${remainingMs}ms remaining`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ Failed to pause persistent timer for tab ${tabId}:`,
        error
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
      if (!timer || timer.isActive) {
        return timer?.isActive || false;
      }

      const storedRemaining = (timer as any).remainingMs || 0;

      if (storedRemaining > 0) {
        await this.startTimer(tabId, storedRemaining);
        console.log(`▶️ Persistent timer resumed for tab ${tabId}`);
        return true;
      } else {
        await this.handleTimerExpiration(tabId);
        return true;
      }
    } catch (error) {
      console.error(
        `❌ Failed to resume persistent timer for tab ${tabId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Handle tab closure - clean up associated timer
   */
  public async handleTabClosure(tabId: number): Promise<void> {
    console.log(`🗑️ Handling tab closure for tab ${tabId}`);
    await this.stopTimer(tabId);
    this.callbacks.delete(tabId);
  }

  /**
   * Clean up all timers
   */
  public async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up all persistent timers...');

      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Clear all chrome alarms
      for (const timer of this.timers.values()) {
        if (timer.alarmName && timer.alarmName.includes('timer')) {
          await chrome.alarms.clear(timer.alarmName);
        }
      }

      // Clear keep-alive alarm
      await chrome.alarms.clear(this.keepAliveAlarmName);

      // Clear all data
      this.timers.clear();
      this.callbacks.clear();

      // Clear storage
      await chrome.storage.local.remove('persistent_timers');

      console.log('✅ All persistent timers cleaned up');
      await this.logEvent('info', 'All persistent timers cleaned up', {});
    } catch (error) {
      console.error('❌ Failed to cleanup persistent timers:', error);
      await this.logEvent('error', 'Failed to cleanup persistent timers', {
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
        message: `PersistentAlarmManager: ${message}`,
        data: data,
      });
    } catch (error) {
      console.error('Failed to log persistent timer event:', error);
    }
  }
}

// Export singleton instance
export const persistentAlarmManager = new PersistentAlarmManager();

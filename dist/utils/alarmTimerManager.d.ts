export type AlarmTimerCallback = (tabId: number) => void | Promise<void>;
/**
 * Alarm-based Timer Manager Class
 * Uses chrome.alarms API for reliable background timers that work even when Service Worker sleeps
 */
export declare class AlarmTimerManager {
    private callbacks;
    private globalCallback?;
    private timers;
    constructor();
    /**
     * Start a timer for a specific tab using chrome.alarms
     */
    startTimer(tabId: number, intervalMs?: number): Promise<void>;
    /**
     * Fallback setTimeout timer for intervals < 1 minute
     */
    private startTimeoutTimer;
    /**
     * Stop a timer for a specific tab
     */
    stopTimer(tabId: number): Promise<void>;
    /**
     * Reset a timer for a specific tab with a new interval
     */
    resetTimer(tabId: number, intervalMs?: number): Promise<void>;
    /**
     * Get time remaining for a specific tab timer (in milliseconds)
     */
    getTimeRemaining(tabId: number): number;
    /**
     * Get time remaining in a human-readable format
     */
    getTimeRemainingFormatted(tabId: number): string;
    /**
     * Check if a timer is active for a specific tab
     */
    isTimerActive(tabId: number): boolean;
    /**
     * Get all active timers
     */
    getActiveTimers(): Array<{
        tabId: number;
        intervalMs: number;
        startTime: number;
        alarmName: string;
    }>;
    /**
     * Register a callback for timer expiration
     */
    setCallback(tabId: number, callback: AlarmTimerCallback): void;
    /**
     * Remove callback for a specific tab
     */
    removeCallback(tabId: number): void;
    /**
     * Set global callback for all timers
     */
    setGlobalCallback(callback: AlarmTimerCallback): void;
    /**
     * Handle chrome.alarms.onAlarm event
     */
    private handleAlarmExpiration;
    /**
     * Handle timer expiration (both alarm and timeout)
     */
    private handleTimerExpiration;
    /**
     * Handle tab closure - clean up associated timer
     */
    handleTabClosure(tabId: number): Promise<void>;
    /**
     * Pause a timer (stop without removing)
     */
    pauseTimer(tabId: number): Promise<boolean>;
    /**
     * Resume a paused timer
     */
    resumeTimer(tabId: number): Promise<boolean>;
    /**
     * Get timer status for a specific tab
     */
    getTimerStatus(tabId: number): {
        exists: boolean;
        isActive: boolean;
        remainingMs: number;
        remainingFormatted: string;
        startTime?: number;
        intervalMs?: number;
        alarmName?: string;
    };
    /**
     * Clean up all timers
     */
    cleanup(): Promise<void>;
    /**
     * Log events for debugging and monitoring
     */
    private logEvent;
}
export declare const alarmTimerManager: AlarmTimerManager;
//# sourceMappingURL=alarmTimerManager.d.ts.map
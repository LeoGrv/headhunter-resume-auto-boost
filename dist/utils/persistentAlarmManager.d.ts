export type PersistentAlarmCallback = (tabId: number) => void | Promise<void>;
/**
 * Persistent Alarm Manager with automatic state recovery
 */
export declare class PersistentAlarmManager {
    private callbacks;
    private globalCallback?;
    private timers;
    private processingTimers;
    private healthCheckInterval?;
    private keepAliveAlarmName;
    constructor();
    /**
     * Initialize the manager and restore state
     */
    private initialize;
    /**
     * Restore timer state from Chrome Storage
     */
    private restoreState;
    /**
     * Sync our internal state with Chrome alarms
     */
    private syncChromeAlarms;
    /**
     * Start health check system
     */
    private startHealthCheck;
    /**
     * Start keep-alive mechanism to prevent Service Worker from sleeping
     */
    private startKeepAlive;
    /**
     * Perform health check
     */
    private performHealthCheck;
    /**
     * Save current state to Chrome Storage
     */
    private saveState;
    /**
     * Create Chrome alarm with error handling
     */
    private createChromeAlarm;
    /**
     * Start a timer for a specific tab with persistence
     */
    startTimer(tabId: number, intervalMs?: number): Promise<void>;
    /**
     * Stop a timer for a specific tab
     */
    stopTimer(tabId: number): Promise<void>;
    /**
     * Handle timer expiration with retry logic
     */
    private handleTimerExpiration;
    /**
     * Handle chrome.alarms.onAlarm event
     */
    private handleAlarmExpiration;
    /**
     * Set global callback for all timers
     */
    setGlobalCallback(callback: PersistentAlarmCallback): void;
    /**
     * Remove callback for a specific tab
     */
    removeCallback(tabId: number): void;
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
        retryCount?: number;
    };
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
        retryCount: number;
    }>;
    /**
     * Reset a timer for a specific tab with a new interval
     */
    resetTimer(tabId: number, intervalMs?: number): Promise<void>;
    /**
     * Pause a timer (stop without removing)
     */
    pauseTimer(tabId: number): Promise<boolean>;
    /**
     * Resume a paused timer
     */
    resumeTimer(tabId: number): Promise<boolean>;
    /**
     * Handle tab closure - clean up associated timer
     */
    handleTabClosure(tabId: number): Promise<void>;
    /**
     * Clean up all timers
     */
    cleanup(): Promise<void>;
    /**
     * Log events for debugging and monitoring
     */
    private logEvent;
}
export declare const persistentAlarmManager: PersistentAlarmManager;
//# sourceMappingURL=persistentAlarmManager.d.ts.map
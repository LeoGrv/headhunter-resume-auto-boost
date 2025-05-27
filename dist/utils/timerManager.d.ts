export interface Timer {
    id: number;
    tabId: number;
    expirationTime: number;
    intervalMs: number;
    callback?: () => void;
    isActive: boolean;
}
export type TimerCallback = (tabId: number) => void | Promise<void>;
/**
 * Timer Manager Class
 * Manages individual timers for each resume tab
 */
export declare class TimerManager {
    private timers;
    private timeoutIds;
    private callbacks;
    private nextTimerId;
    /**
     * Start a timer for a specific tab
     */
    startTimer(tabId: number, intervalMs?: number): void;
    /**
     * Stop a timer for a specific tab
     */
    stopTimer(tabId: number): void;
    /**
     * Reset a timer for a specific tab with a new interval
     */
    resetTimer(tabId: number, intervalMs?: number): void;
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
    getActiveTimers(): Timer[];
    /**
     * Register a callback for timer expiration
     */
    setCallback(tabId: number, callback: TimerCallback): void;
    /**
     * Remove callback for a specific tab
     */
    removeCallback(tabId: number): void;
    /**
     * Set global callback for all timers
     */
    setGlobalCallback(callback: TimerCallback): void;
    private globalCallback?;
    /**
     * Handle timer expiration
     */
    private handleTimerExpiration;
    /**
     * Handle tab closure - clean up associated timer
     */
    handleTabClosure(tabId: number): void;
    /**
     * Pause a timer (stop without removing)
     */
    pauseTimer(tabId: number): boolean;
    /**
     * Resume a paused timer
     */
    resumeTimer(tabId: number): boolean;
    /**
     * Get timer status for a specific tab
     */
    getTimerStatus(tabId: number): {
        exists: boolean;
        isActive: boolean;
        remainingMs: number;
        remainingFormatted: string;
        expirationTime?: number;
        intervalMs?: number;
    };
    /**
     * Clean up all timers
     */
    cleanup(): void;
    /**
     * Log events for debugging and monitoring
     */
    private logEvent;
}
export declare const timerManager: TimerManager;
//# sourceMappingURL=timerManager.d.ts.map
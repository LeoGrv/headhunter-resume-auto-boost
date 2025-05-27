import { AppSettings, TabInfo, LogEntry } from './types';
/**
 * Settings Management Functions
 */
/**
 * Save extension settings to Chrome Storage
 */
export declare function saveSettings(settings: Partial<AppSettings>): Promise<void>;
/**
 * Get extension settings from Chrome Storage
 */
export declare function getSettings(): Promise<AppSettings>;
/**
 * Save boost interval setting
 */
export declare function saveInterval(interval: number): Promise<void>;
/**
 * Get boost interval setting
 */
export declare function getInterval(): Promise<number>;
/**
 * Save global pause state
 */
export declare function saveGlobalPauseState(isPaused: boolean): Promise<void>;
/**
 * Get global pause state
 */
export declare function getGlobalPauseState(): Promise<boolean>;
/**
 * Tab Management Functions
 */
/**
 * Save managed tabs information
 */
export declare function saveManagedTabs(tabs: TabInfo[]): Promise<void>;
/**
 * Get managed tabs information
 */
export declare function getManagedTabs(): Promise<TabInfo[]>;
/**
 * Logging Functions
 */
/**
 * Add log entry to storage
 */
export declare function addLogEntry(entry: Omit<LogEntry, 'timestamp'>): Promise<void>;
/**
 * Get activity logs
 */
export declare function getLogs(): Promise<LogEntry[]>;
/**
 * Clear activity logs
 */
export declare function clearLogs(): Promise<void>;
/**
 * Initialize storage with default settings if not exists
 */
export declare function initializeStorage(): Promise<void>;
//# sourceMappingURL=storage.d.ts.map
export declare enum TabState {
    DISCOVERED = "discovered",
    ACTIVE = "active",
    PAUSED = "paused",
    COOLDOWN = "cooldown",
    ERROR = "error",
    REMOVED = "removed"
}
export interface TimerStatus {
    exists: boolean;
    isActive: boolean;
    remainingMs: number;
    remainingFormatted: string;
    expirationTime?: number;
    intervalMs?: number;
    alarmName?: string;
    startTime?: number;
    timeRemaining?: number;
    endTime?: number;
}
export interface TabInfo {
    tabId: number;
    url: string;
    title: string;
    state: TabState;
    lastBoostTime?: number;
    lastClickTime?: number;
    nextBoostTime?: number;
    nextClickTime?: number;
    cooldownUntil?: number;
    errorCount: number;
    lastError?: string;
    timerStatus?: TimerStatus;
}
export interface AppSettings {
    clickInterval: number;
    maxTabs: number;
    globalPaused: boolean;
    loggingEnabled: boolean;
    refreshInterval: number;
}
export interface ExtensionSettings extends AppSettings {
    interval: number;
}
export type Settings = AppSettings;
export interface LogEntry {
    timestamp: number;
    level: 'info' | 'warning' | 'error';
    message: string;
    tabId?: number;
    data?: unknown;
}
export interface BackgroundMessage {
    type: 'BOOST_RESUME' | 'CHECK_BUTTON_STATE' | 'REFRESH_PAGE' | 'GET_STATE' | 'GLOBAL_PAUSE_TOGGLE' | 'SET_GLOBAL_PAUSE' | 'SETTINGS_UPDATE' | 'TAB_PAUSE_TOGGLE' | 'TAB_REMOVE' | 'GET_EXTENSION_STATE' | 'SET_TAB_PAUSE' | 'SET_INTERVAL' | 'REFRESH_TABS' | 'TEST_MESSAGE';
    tabId?: number;
    data?: unknown;
    paused?: boolean;
    interval?: number;
}
export interface ContentMessage {
    type: 'BUTTON_CLICKED' | 'BUTTON_STATE' | 'PAGE_REFRESHED' | 'ERROR' | 'TEST_RESPONSE';
    success: boolean;
    data?: unknown;
}
export interface PopupMessage {
    type: 'GET_STATE' | 'SET_INTERVAL' | 'PAUSE_TAB' | 'RESUME_TAB' | 'GLOBAL_PAUSE' | 'CLEAR_LOGS';
    data?: unknown;
}
export declare const DEFAULT_SETTINGS: AppSettings;
export declare function toExtensionSettings(settings: AppSettings): ExtensionSettings;
export declare function fromExtensionSettings(settings: ExtensionSettings): AppSettings;
//# sourceMappingURL=types.d.ts.map
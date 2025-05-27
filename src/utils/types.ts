// HeadHunter Resume Auto-Boost Extension
// Type Definitions

// Tab States
export enum TabState {
  DISCOVERED = 'discovered',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COOLDOWN = 'cooldown',
  ERROR = 'error',
  REMOVED = 'removed',
}

// Timer Status
export interface TimerStatus {
  exists: boolean;
  isActive: boolean;
  remainingMs: number; // milliseconds
  remainingFormatted: string;
  expirationTime?: number;
  intervalMs?: number;
  // Alarm timer specific fields
  alarmName?: string;
  startTime?: number;
  // Legacy fields for backward compatibility
  timeRemaining?: number; // alias for remainingMs
  endTime?: number;
}

// Tab Information
export interface TabInfo {
  tabId: number; // Chrome tab ID
  url: string;
  title: string;
  state: TabState;
  lastBoostTime?: number;
  lastClickTime?: number; // Alias for lastBoostTime
  nextBoostTime?: number;
  nextClickTime?: number; // Alias for nextBoostTime
  cooldownUntil?: number;
  errorCount: number;
  lastError?: string;
  timerStatus?: TimerStatus; // Timer information from Service Worker
}

// Unified Settings Interface - используется везде
export interface AppSettings {
  clickInterval: number; // minutes - основной интервал кликов
  maxTabs: number;
  globalPaused: boolean;
  loggingEnabled: boolean;
  refreshInterval: number; // minutes - интервал обновления страницы
}

// Legacy interfaces for backward compatibility
export interface ExtensionSettings extends AppSettings {
  interval: number; // alias for clickInterval
}

// Legacy type alias for backward compatibility
export type Settings = AppSettings;

// Log Entry
export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  tabId?: number;
  data?: unknown;
}

// Message Types
export interface BackgroundMessage {
  type:
    | 'BOOST_RESUME'
    | 'CHECK_BUTTON_STATE'
    | 'REFRESH_PAGE'
    | 'GET_STATE'
    | 'GLOBAL_PAUSE_TOGGLE'
    | 'SET_GLOBAL_PAUSE'
    | 'SETTINGS_UPDATE'
    | 'TAB_PAUSE_TOGGLE'
    | 'TAB_REMOVE'
    | 'GET_EXTENSION_STATE'
    | 'SET_TAB_PAUSE'
    | 'SET_INTERVAL'
    | 'REFRESH_TABS'
    | 'TEST_MESSAGE';
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
  type:
    | 'GET_STATE'
    | 'SET_INTERVAL'
    | 'PAUSE_TAB'
    | 'RESUME_TAB'
    | 'GLOBAL_PAUSE'
    | 'CLEAR_LOGS';
  data?: unknown;
}

// Default Settings
export const DEFAULT_SETTINGS: AppSettings = {
  clickInterval: 2, // 2 minutes (for easier testing)
  maxTabs: 2,
  globalPaused: false,
  loggingEnabled: true,
  refreshInterval: 10, // 10 minutes (for easier testing)
};

// Utility functions for settings conversion
export function toExtensionSettings(settings: AppSettings): ExtensionSettings {
  return {
    ...settings,
    interval: settings.clickInterval, // Add legacy field
  };
}

export function fromExtensionSettings(
  settings: ExtensionSettings
): AppSettings {
  return {
    clickInterval:
      settings.interval ||
      settings.clickInterval ||
      DEFAULT_SETTINGS.clickInterval,
    maxTabs: settings.maxTabs,
    globalPaused: settings.globalPaused,
    loggingEnabled: settings.loggingEnabled,
    refreshInterval: settings.refreshInterval,
  };
}

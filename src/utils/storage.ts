// HeadHunter Resume Auto-Boost Extension
// Chrome Storage Management Module

import {
  AppSettings,
  ExtensionSettings,
  DEFAULT_SETTINGS,
  TabInfo,
  LogEntry,
  toExtensionSettings,
  fromExtensionSettings,
} from './types';

// Storage Keys
const STORAGE_KEYS = {
  SETTINGS: 'extension_settings',
  TABS: 'managed_tabs',
  LOGS: 'activity_logs',
} as const;

/**
 * Settings Management Functions
 */

/**
 * Save extension settings to Chrome Storage
 */
export async function saveSettings(
  settings: Partial<AppSettings>
): Promise<void> {
  try {
    console.log('💾 STORAGE SAVE - Input settings:', settings);

    const currentSettings = await getSettings();
    console.log(
      '💾 STORAGE SAVE - Current settings from storage:',
      currentSettings
    );

    const updatedSettings = { ...currentSettings, ...settings };
    console.log('💾 STORAGE SAVE - Merged settings:', updatedSettings);

    // Convert to storage format
    const storageSettings = toExtensionSettings(updatedSettings);
    console.log(
      '💾 STORAGE SAVE - Converted to storage format:',
      storageSettings
    );

    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: storageSettings,
    });

    console.log('💾 STORAGE SAVE - Successfully saved to Chrome Storage');

    // Verify what was actually saved
    const verification = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    console.log(
      '💾 STORAGE SAVE - Verification read from Chrome Storage:',
      verification
    );
  } catch (error) {
    console.error('❌ STORAGE SAVE - Failed:', error);
    throw new Error(`Storage save failed: ${error}`);
  }
}

/**
 * Get extension settings from Chrome Storage
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    console.log('📥 STORAGE GET - Reading from Chrome Storage...');
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    console.log('📥 STORAGE GET - Raw result from Chrome Storage:', result);

    const storedSettings = result[STORAGE_KEYS.SETTINGS];
    console.log('📥 STORAGE GET - Extracted stored settings:', storedSettings);

    // Merge with defaults to ensure all properties exist
    const defaultsInLegacyFormat = toExtensionSettings(DEFAULT_SETTINGS);
    console.log(
      '📥 STORAGE GET - Defaults in legacy format:',
      defaultsInLegacyFormat
    );

    const legacySettings: ExtensionSettings = {
      ...defaultsInLegacyFormat,
      ...storedSettings,
    };
    console.log('📥 STORAGE GET - Merged legacy settings:', legacySettings);

    // Convert to modern format and validate
    const modernSettings = fromExtensionSettings(legacySettings);
    console.log('📥 STORAGE GET - Converted to modern format:', modernSettings);

    const validatedSettings = validateSettings(modernSettings);
    console.log(
      '📥 STORAGE GET - Final validated settings:',
      validatedSettings
    );

    return validatedSettings;
  } catch (error) {
    console.error('❌ STORAGE GET - Failed:', error);
    // Return defaults on error
    const defaults = { ...DEFAULT_SETTINGS };
    console.log('📥 STORAGE GET - Returning defaults due to error:', defaults);
    return defaults;
  }
}

/**
 * Save boost interval setting
 */
export async function saveInterval(interval: number): Promise<void> {
  if (!isValidInterval(interval)) {
    throw new Error(
      `Invalid interval: ${interval}. Must be between 1 and 600 minutes.`
    );
  }

  await saveSettings({ clickInterval: interval });
}

/**
 * Get boost interval setting
 */
export async function getInterval(): Promise<number> {
  const settings = await getSettings();
  return settings.clickInterval;
}

/**
 * Save global pause state
 */
export async function saveGlobalPauseState(isPaused: boolean): Promise<void> {
  await saveSettings({ globalPaused: isPaused });
}

/**
 * Get global pause state
 */
export async function getGlobalPauseState(): Promise<boolean> {
  const settings = await getSettings();
  return settings.globalPaused;
}

/**
 * Tab Management Functions
 */

/**
 * Save managed tabs information
 */
export async function saveManagedTabs(tabs: TabInfo[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.TABS]: tabs,
    });

    console.log('Managed tabs saved:', tabs.length);
  } catch (error) {
    console.error('Failed to save managed tabs:', error);
    throw new Error(`Failed to save tabs: ${error}`);
  }
}

/**
 * Get managed tabs information
 */
export async function getManagedTabs(): Promise<TabInfo[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TABS);
    return result[STORAGE_KEYS.TABS] || [];
  } catch (error) {
    console.error('Failed to get managed tabs:', error);
    return [];
  }
}

/**
 * Logging Functions
 */

/**
 * Add log entry to storage
 */
export async function addLogEntry(
  entry: Omit<LogEntry, 'timestamp'>
): Promise<void> {
  try {
    const logs = await getLogs();
    const newEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    // Keep only last 10 entries
    const updatedLogs = [newEntry, ...logs].slice(0, 10);

    await chrome.storage.local.set({
      [STORAGE_KEYS.LOGS]: updatedLogs,
    });
  } catch (error) {
    console.error('Failed to add log entry:', error);
  }
}

/**
 * Get activity logs
 */
export async function getLogs(): Promise<LogEntry[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
    return result[STORAGE_KEYS.LOGS] || [];
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
}

/**
 * Clear activity logs
 */
export async function clearLogs(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LOGS]: [],
    });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    throw new Error(`Failed to clear logs: ${error}`);
  }
}

/**
 * Utility Functions
 */

/**
 * Validate settings object
 */
function validateSettings(settings: any): AppSettings {
  const validated: AppSettings = {
    clickInterval: isValidInterval(settings.clickInterval)
      ? settings.clickInterval
      : DEFAULT_SETTINGS.clickInterval,
    maxTabs: isValidMaxTabs(settings.maxTabs)
      ? settings.maxTabs
      : DEFAULT_SETTINGS.maxTabs,
    globalPaused:
      typeof settings.globalPaused === 'boolean'
        ? settings.globalPaused
        : DEFAULT_SETTINGS.globalPaused,
    loggingEnabled:
      typeof settings.loggingEnabled === 'boolean'
        ? settings.loggingEnabled
        : DEFAULT_SETTINGS.loggingEnabled,
    refreshInterval: isValidRefreshInterval(settings.refreshInterval)
      ? settings.refreshInterval
      : DEFAULT_SETTINGS.refreshInterval,
  };

  return validated;
}

/**
 * Validate interval value
 */
function isValidInterval(interval: any): boolean {
  return typeof interval === 'number' && interval >= 1 && interval <= 600;
}

/**
 * Validate max tabs value
 */
function isValidMaxTabs(maxTabs: any): boolean {
  return typeof maxTabs === 'number' && maxTabs >= 1 && maxTabs <= 5;
}

/**
 * Validate refresh interval value
 */
function isValidRefreshInterval(refreshInterval: any): boolean {
  return (
    typeof refreshInterval === 'number' &&
    refreshInterval >= 1 &&
    refreshInterval <= 600
  );
}

/**
 * Initialize storage with default settings if not exists
 */
export async function initializeStorage(): Promise<void> {
  try {
    const settings = await getSettings();
    console.log('Storage initialized with settings:', settings);
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
}

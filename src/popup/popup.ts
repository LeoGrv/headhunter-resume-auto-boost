// HeadHunter Resume Auto-Boost Extension
// Popup Interface Logic

import {
  getSettings,
  saveSettings,
  getManagedTabs,
  getLogs,
  clearLogs,
  saveGlobalPauseState,
  getGlobalPauseState,
} from '../utils/storage';
import {
  TabInfo,
  TabState,
  AppSettings,
  LogEntry,
  BackgroundMessage,
} from '../utils/types';
import { logger } from '../utils/logger';

console.log('🚀 HeadHunter Resume Auto-Boost Extension: Popup script loaded');
console.log('🚀 Current URL:', window.location.href);
console.log('🚀 Document ready state:', document.readyState);

/**
 * Update version info in popup
 */
function updateVersionInfo(): void {
  const versionElement = document.querySelector('.version-info') as HTMLElement;
  if (versionElement) {
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = `v${manifest.version} - Final Release ✅`;
    console.log('📋 Version updated to:', manifest.version);
  }
}

// DOM Elements
let statusDot: HTMLElement;
let statusText: HTMLElement;
let tabsList: HTMLElement;
let logsList: HTMLElement;
let globalPauseBtn: HTMLButtonElement;
let settingsBtn: HTMLButtonElement;
let clearLogsBtn: HTMLButtonElement;
let exportLogsBtn: HTMLButtonElement;

// State
let currentSettings: AppSettings;
let managedTabs: TabInfo[] = [];
let isGlobalPaused = false;

/**
 * Send message to Service Worker with retry mechanism
 */
async function sendMessageToServiceWorker(
  message: any,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `📤 Popup attempt ${attempt}/${maxRetries}: Sending message to Service Worker:`,
        message.type
      );

      const response = await chrome.runtime.sendMessage(message);

      if (response && response.success !== false) {
        console.log(
          `✅ Message sent successfully to Service Worker on attempt ${attempt}`
        );
        return response;
      } else {
        throw new Error(
          response?.error || 'Service Worker returned unsuccessful response'
        );
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Popup attempt ${attempt}/${maxRetries} failed:`, error);

      // If this is the last attempt, don't wait
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retry (exponential backoff)
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Popup waiting ${delay}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  console.error(
    `❌ Popup: All ${maxRetries} attempts failed. Last error:`,
    lastError
  );
  throw (
    lastError ||
    new Error(
      `Failed to send message to Service Worker after ${maxRetries} attempts`
    )
  );
}

/**
 * Initialize the popup interface
 */
async function initializePopup(): Promise<void> {
  try {
    console.log('🚀 POPUP INIT - Starting initialization...');
    console.log('🚀 POPUP INIT - DOM ready state:', document.readyState);

    // Get DOM elements
    statusDot = document.querySelector('.status-dot') as HTMLElement;
    statusText = document.querySelector('.status-text') as HTMLElement;
    tabsList = document.querySelector('.tabs-list') as HTMLElement;
    logsList = document.querySelector('.logs-list') as HTMLElement;
    globalPauseBtn = document.getElementById(
      'global-pause'
    ) as HTMLButtonElement;
    settingsBtn = document.getElementById('settings') as HTMLButtonElement;
    clearLogsBtn = document.getElementById('clear-logs') as HTMLButtonElement;
    exportLogsBtn = document.getElementById('export-logs') as HTMLButtonElement;

    console.log('🚀 POPUP INIT - DOM elements found:', {
      statusDot: !!statusDot,
      statusText: !!statusText,
      tabsList: !!tabsList,
      logsList: !!logsList,
      globalPauseBtn: !!globalPauseBtn,
      settingsBtn: !!settingsBtn,
      clearLogsBtn: !!clearLogsBtn,
      exportLogsBtn: !!exportLogsBtn,
    });

    if (
      !statusDot ||
      !statusText ||
      !tabsList ||
      !logsList ||
      !globalPauseBtn ||
      !settingsBtn ||
      !clearLogsBtn ||
      !exportLogsBtn
    ) {
      console.error('🚀 POPUP INIT - Missing DOM elements!');
      throw new Error('Required DOM elements not found');
    }

    // Load initial data
    await loadSettings();
    await loadManagedTabs();
    await loadGlobalPauseState();
    await loadLogs();

    // Set up event listeners
    setupEventListeners();

    // Update UI
    updateVersionInfo();
    updateStatusIndicator();
    renderManagedTabs();
    renderLogs();

    console.log('🚀 POPUP INIT - Popup interface initialized successfully');
  } catch (error) {
    console.error('🚀 POPUP INIT - Failed to initialize popup:', error);
    updateStatusIndicator('error', 'Initialization failed');
  }
}

/**
 * Load settings from storage
 */
async function loadSettings(): Promise<void> {
  try {
    console.log('📥 LOAD SETTINGS - Calling getSettings()...');
    currentSettings = await getSettings();
    console.log('📥 LOAD SETTINGS - Received from storage:', currentSettings);
  } catch (error) {
    console.error('❌ Failed to load settings:', error);
    // Use default settings
    currentSettings = {
      clickInterval: 15,
      maxTabs: 2,
      refreshInterval: 15,
      globalPaused: false,
      loggingEnabled: true,
    };
    console.log('📥 LOAD SETTINGS - Using defaults:', currentSettings);
  }
}

/**
 * Load managed tabs with timer information from Service Worker
 */
async function loadManagedTabs(): Promise<void> {
  try {
    console.log('=== Loading Managed Tabs ===');

    // Get data from Service Worker which has timer information
    const response = await sendMessageToServiceWorker({
      type: 'GET_EXTENSION_STATE',
    });
    console.log('Service Worker response:', response);

    if (response.success && response.data.managedTabs) {
      console.log(
        'Raw managedTabs from Service Worker:',
        response.data.managedTabs
      );

      // Convert Service Worker data to popup format with timer info
      managedTabs = response.data.managedTabs.map((tab: any) => {
        const convertedTab = {
          tabId: tab.tabId, // Use correct tabId field
          title: tab.title,
          url: tab.url,
          state: tab.state,
          lastClickTime: tab.lastClickTime,
          errorCount: tab.errorCount || 0,
          timerStatus: tab.timerStatus, // Keep timer status from Service Worker
          // Calculate nextClickTime from timer status for backward compatibility
          nextClickTime: tab.timerStatus?.isActive
            ? Date.now() + (tab.timerStatus.remainingMs || 0)
            : null,
        };

        console.log('Converted tab:', {
          tabId: convertedTab.tabId,
          title: convertedTab.title,
          timerStatus: convertedTab.timerStatus,
        });

        return convertedTab;
      });

      console.log(
        '✅ Managed tabs loaded with timer info:',
        managedTabs.length,
        'tabs'
      );
    } else {
      console.log('❌ Service Worker response failed, using storage fallback');
      console.log('Response details:', {
        success: response.success,
        hasData: !!response.data,
        hasManagedTabs: !!(response.data && response.data.managedTabs),
      });

      // Fallback to storage if Service Worker is not available
      managedTabs = await getManagedTabs();
      console.log('Managed tabs loaded from storage (fallback):', managedTabs);
    }

    console.log('=== End Loading Managed Tabs ===');
  } catch (error) {
    console.error('❌ Failed to load managed tabs:', error);
    // Fallback to storage
    try {
      managedTabs = await getManagedTabs();
      console.log('Storage fallback successful:', managedTabs.length, 'tabs');
    } catch (storageError) {
      console.error('❌ Storage fallback also failed:', storageError);
      managedTabs = [];
    }
  }
}

/**
 * Load global pause state from Service Worker
 */
async function loadGlobalPauseState(): Promise<void> {
  try {
    console.log('📥 LOAD GLOBAL PAUSE - Getting state from Service Worker...');

    // Get state from Service Worker (authoritative source)
    const response = await sendMessageToServiceWorker({
      type: 'GET_EXTENSION_STATE',
    });

    if (response.success && response.data) {
      isGlobalPaused = response.data.globalPaused;
      console.log(
        '📥 LOAD GLOBAL PAUSE - From Service Worker:',
        isGlobalPaused
      );
    } else {
      console.log(
        '📥 LOAD GLOBAL PAUSE - Service Worker failed, using storage fallback'
      );
      // Fallback to storage
      isGlobalPaused = await getGlobalPauseState();
      console.log('📥 LOAD GLOBAL PAUSE - From storage:', isGlobalPaused);
    }

    // Update button to match state
    updateGlobalPauseButton();

    console.log('✅ Global pause state loaded:', isGlobalPaused);
  } catch (error) {
    console.error('❌ Failed to load global pause state:', error);
    isGlobalPaused = false;
    updateGlobalPauseButton();
  }
}

/**
 * Load logs from storage
 */
async function loadLogs(): Promise<LogEntry[]> {
  try {
    const logs = await getLogs();
    console.log('Logs loaded:', logs.length, 'entries');
    return logs;
  } catch (error) {
    console.error('Failed to load logs:', error);
    return [];
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Global pause button
  globalPauseBtn.addEventListener('click', handleGlobalPauseToggle);

  // Settings button
  settingsBtn.addEventListener('click', async () => {
    await handleSettingsClick();
  });

  // Clear logs button
  clearLogsBtn.addEventListener('click', handleClearLogs);
  exportLogsBtn.addEventListener('click', handleExportLogs);

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);

  console.log('Event listeners set up');
}

/**
 * Handle global pause toggle
 */
async function handleGlobalPauseToggle(): Promise<void> {
  try {
    isGlobalPaused = !isGlobalPaused;

    // Save state
    await saveGlobalPauseState(isGlobalPaused);

    // Update settings
    currentSettings.globalPaused = isGlobalPaused;

    await saveSettings(currentSettings);

    // Send message to background script
    const message: BackgroundMessage = {
      type: 'SET_GLOBAL_PAUSE',
      paused: isGlobalPaused,
    };

    const response = await sendMessageToServiceWorker(message);

    if (!response?.success) {
      console.error(
        'Failed to set global pause in background script:',
        response
      );
      // Revert state on failure
      isGlobalPaused = !isGlobalPaused;
      await saveGlobalPauseState(isGlobalPaused);
      return;
    }

    // Update UI
    updateGlobalPauseButton();
    updateStatusIndicator();

    console.log('Global pause toggled:', isGlobalPaused);
  } catch (error) {
    console.error('Failed to toggle global pause:', error);
    // Revert state on error
    isGlobalPaused = !isGlobalPaused;
    updateGlobalPauseButton();
    updateStatusIndicator();
  }
}

/**
 * Debug function to check Chrome Storage directly
 */
async function debugChromeStorage(): Promise<void> {
  try {
    console.log('🔍 DIRECT CHROME STORAGE CHECK:');
    const result = await chrome.storage.sync.get();
    console.log('🔍 ALL Chrome Storage data:', result);

    const settingsResult = await chrome.storage.sync.get('extension_settings');
    console.log('🔍 Settings from Chrome Storage:', settingsResult);
  } catch (error) {
    console.error('🔍 Failed to check Chrome Storage:', error);
  }
}

/**
 * Simple test function to save data directly to Chrome Storage
 */
async function testDirectSave(interval: number): Promise<void> {
  try {
    console.log('🧪 DIRECT SAVE TEST - Saving interval:', interval);

    // Save directly without any conversions
    await chrome.storage.sync.set({
      test_interval: interval,
      extension_settings: {
        clickInterval: interval,
        maxTabs: 2,
        globalPaused: false,
        loggingEnabled: true,
        refreshInterval: 10,
      },
    });

    console.log('🧪 DIRECT SAVE TEST - Save completed');

    // Verify immediately
    const verification = await chrome.storage.sync.get([
      'test_interval',
      'extension_settings',
    ]);
    console.log('🧪 DIRECT SAVE TEST - Verification:', verification);
  } catch (error) {
    console.error('🧪 DIRECT SAVE TEST - Failed:', error);
  }
}

/**
 * Handle settings button click
 */
async function handleSettingsClick(): Promise<void> {
  console.log(
    '🔧 SETTINGS CLICK - Current settings before reload:',
    currentSettings
  );

  // Debug Chrome Storage directly
  await debugChromeStorage();

  // Reload settings to ensure we have the latest data
  await loadSettings();
  console.log(
    '🔧 SETTINGS CLICK - Current settings after reload:',
    currentSettings
  );

  // Show settings dialog with multiple options
  const settingsDialog = `
Current Settings:
• Click interval: ${currentSettings.clickInterval} minutes
• Page refresh interval: ${currentSettings.refreshInterval} minutes

What would you like to change?
1. Click interval (1-600 minutes)
2. Page refresh interval (1-600 minutes)
3. Cancel

Enter 1, 2, or 3:`;

  const choice = prompt(settingsDialog, '1');
  console.log('🔧 User choice:', choice);

  if (choice === '1') {
    // Change click interval
    const newInterval = prompt(
      `Current click interval: ${currentSettings.clickInterval} minutes\nEnter new interval (1-600 minutes):`,
      currentSettings.clickInterval.toString()
    );

    console.log('🔧 User entered new interval:', newInterval);

    if (newInterval) {
      const interval = parseInt(newInterval, 10);
      console.log('🔧 Parsed interval:', interval);

      if (interval >= 1 && interval <= 600) {
        console.log('🔧 Calling updateSettings with clickInterval:', interval);

        // Test direct save first
        await testDirectSave(interval);

        await updateSettings({ clickInterval: interval });
        console.log('🔧 updateSettings completed, settings should be updated');

        // Debug Chrome Storage after saving
        console.log('🔧 Checking Chrome Storage after save:');
        await debugChromeStorage();
      } else {
        alert('Interval must be between 1 and 600 minutes');
      }
    }
  } else if (choice === '2') {
    // Change refresh interval
    const newRefreshInterval = prompt(
      `Current page refresh interval: ${currentSettings.refreshInterval} minutes\nEnter new interval (1-600 minutes):`,
      currentSettings.refreshInterval.toString()
    );

    if (newRefreshInterval) {
      const interval = parseInt(newRefreshInterval, 10);
      if (interval >= 1 && interval <= 600) {
        await updateSettings({ refreshInterval: interval });
      } else {
        alert('Refresh interval must be between 1 and 600 minutes');
      }
    }
  }
}

/**
 * Update settings
 */
async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
  try {
    console.log('💾 UPDATE SETTINGS - Input updates:', updates);
    console.log(
      '💾 UPDATE SETTINGS - Current settings before merge:',
      currentSettings
    );

    currentSettings = { ...currentSettings, ...updates };
    console.log('💾 UPDATE SETTINGS - Settings after merge:', currentSettings);

    console.log('💾 UPDATE SETTINGS - Calling saveSettings...');
    await saveSettings(currentSettings);
    console.log('💾 UPDATE SETTINGS - saveSettings completed');

    // Send message to background script
    const message: BackgroundMessage = {
      type: 'SETTINGS_UPDATE',
      data: currentSettings,
    };

    console.log('💾 UPDATE SETTINGS - Sending message to background:', message);
    sendMessageToServiceWorker(message).catch(error => {
      console.error('Failed to send settings update to Service Worker:', error);
    });

    // Reload data to reflect new settings
    console.log('💾 UPDATE SETTINGS - Reloading settings...');
    await loadSettings();
    console.log('💾 UPDATE SETTINGS - Settings after reload:', currentSettings);

    await loadManagedTabs();
    renderManagedTabs();
    updateStatusIndicator();

    console.log('💾 UPDATE SETTINGS - Final settings:', currentSettings);
  } catch (error) {
    console.error('❌ Failed to update settings:', error);
  }
}

/**
 * Handle clear logs
 */
async function handleClearLogs(): Promise<void> {
  try {
    await clearLogs();
    renderLogs();
    console.log('Logs cleared');
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}

/**
 * Handle export logs button click
 */
async function handleExportLogs(): Promise<void> {
  try {
    const logsText = await logger.exportLogs();
    
    if (!logsText.trim()) {
      alert('No logs to export');
      return;
    }
    
    // Create and download file
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hh-extension-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Logs exported successfully');
  } catch (error) {
    console.error('❌ Failed to export logs:', error);
    alert('Failed to export logs');
  }
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessage(message: any): void {
  console.log('Received message from background:', message);

  switch (message.type) {
    case 'TAB_UPDATE':
      loadManagedTabs().then(() => {
        renderManagedTabs();
        updateStatusIndicator();
      });
      break;

    case 'LOG_UPDATE':
      renderLogs();
      break;

    case 'STATUS_UPDATE':
      updateStatusIndicator();
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Update status indicator
 */
function updateStatusIndicator(status?: string, text?: string): void {
  if (status && text) {
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
    return;
  }

  // Determine status based on current state
  if (isGlobalPaused) {
    statusDot.className = 'status-dot paused';
    statusText.textContent = 'Paused';
  } else if (managedTabs.length === 0) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'No tabs found';
  } else if (managedTabs.some(tab => tab.state === TabState.ERROR)) {
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Error detected';
  } else if (managedTabs.some(tab => tab.state === TabState.ACTIVE)) {
    statusDot.className = 'status-dot active';
    statusText.textContent = `Active (${managedTabs.filter(tab => tab.state === TabState.ACTIVE).length} tabs)`;
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Inactive';
  }
}

/**
 * Update global pause button
 */
function updateGlobalPauseButton(): void {
  if (isGlobalPaused) {
    globalPauseBtn.innerHTML = `
      <div class="btn-icon">▶️</div>
      <div class="btn-content">
        <span class="btn-title">Resume All</span>
        <span class="btn-subtitle">Start automation</span>
      </div>
    `;
    globalPauseBtn.className = 'action-btn secondary';
  } else {
    globalPauseBtn.innerHTML = `
      <div class="btn-icon">⏸</div>
      <div class="btn-content">
        <span class="btn-title">Pause All</span>
        <span class="btn-subtitle">Stop all automation</span>
      </div>
    `;
    globalPauseBtn.className = 'action-btn primary';
  }
}

/**
 * Render managed tabs
 */
function renderManagedTabs(): void {
  const badgeCount = document.querySelector('.badge-count') as HTMLElement;
  if (badgeCount) {
    badgeCount.textContent = managedTabs.length.toString();
  }

  if (managedTabs.length === 0) {
    tabsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p class="empty-title">No active tabs</p>
        <p class="empty-subtitle">Open a HeadHunter resume page to start</p>
      </div>
    `;
    return;
  }

  const tabsHTML = managedTabs
    .map(tab => {
      const stateClass = getStateClass(tab.state);
      const stateText = getStateText(tab.state);
      const timeRemaining = getTimeRemaining(tab);
      const lastClick = getLastClickText(tab);

      return `
      <div class="tab-item" data-tab-id="${tab.tabId}">
        <div class="tab-info">
          <div class="tab-title" title="${tab.url}">
            ${truncateText(tab.title || tab.url, 35)}
          </div>
          <div class="tab-status ${stateClass}">
            ${stateText} • Next: ${timeRemaining} • Last: ${lastClick}
          </div>
        </div>
        <div class="tab-actions">
          <button class="tab-btn tab-pause-btn" data-tab-id="${tab.tabId}" title="${tab.state === TabState.PAUSED ? 'Resume' : 'Pause'}">
            ${tab.state === TabState.PAUSED ? '▶️' : '⏸️'}
          </button>
          <button class="tab-btn tab-remove-btn" data-tab-id="${tab.tabId}" title="Remove">
            🗑️
          </button>
        </div>
      </div>
    `;
    })
    .join('');

  tabsList.innerHTML = tabsHTML;

  // Add event listeners for tab actions
  setupTabActionListeners();
}

/**
 * Set up event listeners for tab actions
 */
function setupTabActionListeners(): void {
  // Pause/Resume buttons
  const pauseButtons = tabsList.querySelectorAll('.tab-pause-btn');
  pauseButtons.forEach(button => {
    button.addEventListener('click', handleTabPauseToggle);
  });

  // Remove buttons
  const removeButtons = tabsList.querySelectorAll('.tab-remove-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', handleTabRemove);
  });
}

/**
 * Handle tab pause toggle
 */
async function handleTabPauseToggle(event: Event): Promise<void> {
  const button = event.target as HTMLButtonElement;
  const tabId = parseInt(button.dataset.tabId || '0', 10);

  try {
    // Find the tab to determine current state
    const tab = managedTabs.find(t => t.tabId === tabId);
    if (!tab) {
      console.error('Tab not found:', tabId);
      return;
    }

    const isPaused = tab.state === TabState.PAUSED;
    const newPausedState = !isPaused;

    const message: BackgroundMessage = {
      type: 'SET_TAB_PAUSE',
      tabId: tabId,
      paused: newPausedState,
    };

    const response = await sendMessageToServiceWorker(message);

    if (response?.success) {
      console.log(`Tab ${newPausedState ? 'paused' : 'resumed'}:`, tabId);
      // Refresh UI to show updated state
      await loadManagedTabs();
      renderManagedTabs();
    } else {
      console.error('Failed to toggle tab pause:', response);
    }
  } catch (error) {
    console.error('Failed to toggle tab pause:', error);
  }
}

/**
 * Handle tab removal
 */
async function handleTabRemove(event: Event): Promise<void> {
  const button = event.target as HTMLButtonElement;
  const tabId = parseInt(button.dataset.tabId || '0', 10);

  if (confirm('Remove this tab from auto-boosting?')) {
    try {
      // Remove tab from managed tabs locally first
      managedTabs = managedTabs.filter(tab => tab.tabId !== tabId);

      // Update UI immediately
      renderManagedTabs();
      updateStatusIndicator();

      // Send message to background script to clean up
      const message: BackgroundMessage = {
        type: 'TAB_REMOVE',
        tabId: tabId,
      };

      const response = await sendMessageToServiceWorker(message);

      if (response?.success) {
        console.log('Tab removed successfully:', tabId);
      } else {
        console.error('Failed to remove tab from background:', response);
        // Reload tabs on failure to sync state
        await loadManagedTabs();
        renderManagedTabs();
      }
    } catch (error) {
      console.error('Failed to remove tab:', error);
      // Reload tabs on error to sync state
      await loadManagedTabs();
      renderManagedTabs();
    }
  }
}

/**
 * Render logs
 */
async function renderLogs(): Promise<void> {
  try {
    const logs = await loadLogs();

    if (logs.length === 0) {
      logsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-title">No recent activity</p>
          <p class="empty-subtitle">Activity will appear here when automation starts</p>
        </div>
      `;
      return;
    }

    // Show last 15 logs
    const recentLogs = logs.slice(-15).reverse();

    const logsHTML = recentLogs
      .map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const levelClass = getLevelClass(log.level);

        return `
        <div class="log-item">
          <div class="log-level ${levelClass}"></div>
          <div class="log-content">
            <div class="log-message">${truncateText(log.message, 60)}</div>
            <div class="log-time">${time}</div>
          </div>
        </div>
      `;
      })
      .join('');

    logsList.innerHTML = logsHTML;
  } catch (error) {
    console.error('Failed to render logs:', error);
    logsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="empty-title">Failed to load logs</p>
        <p class="empty-subtitle">Please try refreshing the extension</p>
      </div>
    `;
  }
}

/**
 * Helper functions
 */
function getStateClass(state: TabState): string {
  switch (state) {
    case TabState.ACTIVE:
      return 'state-active';
    case TabState.PAUSED:
      return 'state-paused';
    case TabState.COOLDOWN:
      return 'state-cooldown';
    case TabState.ERROR:
      return 'state-error';
    default:
      return 'state-inactive';
  }
}

function getStateText(state: TabState): string {
  switch (state) {
    case TabState.ACTIVE:
      return 'Active';
    case TabState.PAUSED:
      return 'Paused';
    case TabState.COOLDOWN:
      return 'Cooldown';
    case TabState.ERROR:
      return 'Error';
    case TabState.DISCOVERED:
      return 'Discovered';
    case TabState.REMOVED:
      return 'Removed';
    default:
      return 'Unknown';
  }
}

function getTimeRemaining(tab: TabInfo): string {
  // Comprehensive debugging for timer issues
  console.log('=== Timer Debug Info ===');
  console.log('Tab:', {
    tabId: tab.tabId,
    title: tab.title,
    state: tab.state,
  });

  // Use timer status directly from Service Worker data
  const tabData = managedTabs.find(t => t.tabId === tab.tabId);
  console.log('Found tabData:', tabData ? 'YES' : 'NO');

  if (!tabData) {
    console.log('❌ No tabData found for tabId:', tab.tabId);
    console.log(
      'Available managedTabs:',
      managedTabs.map(t => ({ tabId: t.tabId, title: t.title }))
    );
    return 'Not scheduled';
  }

  console.log('TabData timerStatus:', tabData.timerStatus);

  if (!tabData.timerStatus) {
    console.log('❌ No timerStatus in tabData');
    return 'Not scheduled';
  }

  const timerStatus = tabData.timerStatus;
  console.log('Timer status details:', {
    exists: timerStatus.exists,
    isActive: timerStatus.isActive,
    remainingMs: timerStatus.remainingMs,
    remainingFormatted: timerStatus.remainingFormatted,
    alarmName: timerStatus.alarmName,
  });

  if (!timerStatus.exists) {
    console.log('❌ Timer does not exist');
    return 'Not scheduled';
  }

  if (!timerStatus.isActive) {
    console.log('❌ Timer is not active');
    return 'Not scheduled';
  }

  const remaining = timerStatus.remainingMs || 0;
  console.log('Remaining milliseconds:', remaining);

  if (remaining <= 0) {
    console.log('✅ Timer ready (remaining <= 0)');
    return 'Ready';
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const result = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  console.log('✅ Alarm timer result:', result);
  console.log('=== End Timer Debug ===');

  return result;
}

function getLastClickText(tab: TabInfo): string {
  if (!tab.lastClickTime) return 'Never';

  const now = Date.now();
  const elapsed = now - tab.lastClickTime;
  const minutes = Math.floor(elapsed / (1000 * 60));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Get CSS class for log level
 */
function getLevelClass(level: string): string {
  switch (level.toLowerCase()) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'info':
    default:
      return 'info';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Initialize when DOM is loaded
console.log('🚀 POPUP - Adding DOMContentLoaded listener...');
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 POPUP - DOMContentLoaded fired, calling initializePopup...');
  initializePopup();
});

// Refresh data periodically
setInterval(() => {
  loadManagedTabs().then(() => {
    renderManagedTabs();
    updateStatusIndicator();
  });
  renderLogs();
}, 5000); // Refresh every 5 seconds

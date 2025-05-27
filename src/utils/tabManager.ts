// HeadHunter Resume Auto-Boost Extension
// Tab Management Module

import { TabInfo, TabState } from './types';
import { saveManagedTabs, getManagedTabs, addLogEntry } from './storage';

// Internal state
let managedTabs: TabInfo[] = [];
let isInitialized = false;

/**
 * Initialize the tab manager
 */
export async function initializeTabManager(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Load previously managed tabs from storage
    managedTabs = await getManagedTabs();

    // Clean up tabs that no longer exist
    await cleanupInvalidTabs();

    // Discover new resume tabs
    await updateTabList();

    // Set up event listeners
    setupEventListeners();

    isInitialized = true;

    await addLogEntry({
      level: 'info',
      message: `Tab manager initialized with ${managedTabs.length} tabs`,
    });

    console.log('Tab manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize tab manager:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to initialize tab manager: ${error}`,
    });
  }
}

/**
 * Find all tabs with HeadHunter resume URLs
 */
export async function findResumeTabs(): Promise<chrome.tabs.Tab[]> {
  try {
    console.log('🔍 Searching for HeadHunter resume tabs...');

    // Try multiple approaches to get tabs
    let allTabs: chrome.tabs.Tab[] = [];

    // Method 1: Get all tabs from all windows
    try {
      allTabs = await chrome.tabs.query({});
      console.log(
        `📋 Method 1 - Found ${allTabs.length} total tabs (all windows)`
      );
    } catch (error) {
      console.error('Method 1 failed:', error);
    }

    // Method 2: If no tabs found, try current window only
    if (allTabs.length === 0) {
      try {
        allTabs = await chrome.tabs.query({ currentWindow: true });
        console.log(
          `📋 Method 2 - Found ${allTabs.length} total tabs (current window)`
        );
      } catch (error) {
        console.error('Method 2 failed:', error);
      }
    }

    // Method 3: If still no tabs, try getting windows first
    if (allTabs.length === 0) {
      try {
        const windows = await chrome.windows.getAll({ populate: true });
        console.log(`📋 Method 3 - Found ${windows.length} windows`);

        allTabs = [];
        for (const window of windows) {
          if (window.tabs) {
            allTabs.push(...window.tabs);
          }
        }
        console.log(
          `📋 Method 3 - Found ${allTabs.length} total tabs from windows`
        );
      } catch (error) {
        console.error('Method 3 failed:', error);
      }
    }

    // Log all tab URLs for debugging
    console.log('🔍 All tab URLs:');
    allTabs.forEach((tab, index) => {
      console.log(`  ${index + 1}. ${tab.url} (ID: ${tab.id})`);
    });

    // Filter for HeadHunter resume tabs using our improved function
    const resumeTabs = allTabs.filter(tab => {
      if (!tab.url || tab.id === undefined) return false;

      // Additional validation: check if tab is not discarded/suspended
      const isValidTab = !tab.discarded && tab.status !== 'unloaded';
      const isResume = isResumeUrl(tab.url);

      if (isResume && isValidTab) {
        console.log(
          `✅ Found valid resume tab: ${tab.title} (${tab.url}) - Status: ${tab.status}`
        );
      } else if (isResume && !isValidTab) {
        console.log(
          `⚠️ Found resume tab but invalid state: ${tab.title} (${tab.url}) - Status: ${tab.status}, Discarded: ${tab.discarded}`
        );
      } else {
        // Log why it's not a resume tab
        if (tab.url.includes('hh.kz') || tab.url.includes('hh.ru')) {
          console.log(`❌ HH tab but not resume: ${tab.url}`);
        }
      }

      return isResume && isValidTab;
    });

    console.log(`🎯 Found ${resumeTabs.length} HeadHunter resume tabs`);

    // Limit to maximum 2 tabs (as per requirements)
    const limitedTabs = resumeTabs.slice(0, 2);

    if (limitedTabs.length !== resumeTabs.length) {
      console.log(`⚠️ Limited to ${limitedTabs.length} tabs (max 2 allowed)`);
    }

    return limitedTabs;
  } catch (error) {
    console.error('Failed to find resume tabs:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to find resume tabs: ${error}`,
    });
    return [];
  }
}

/**
 * Update the list of managed tabs
 */
export async function updateTabList(): Promise<void> {
  try {
    const currentTabs = await findResumeTabs();
    const currentTabIds = currentTabs
      .map(tab => tab.id)
      .filter(id => id !== undefined) as number[];

    // Remove tabs that no longer exist
    managedTabs = managedTabs.filter(managedTab =>
      currentTabIds.includes(managedTab.tabId)
    );

    // Add new tabs
    for (const tab of currentTabs) {
      if (tab.id === undefined || tab.url === undefined) continue;

      const existingTab = managedTabs.find(
        managedTab => managedTab.tabId === tab.id
      );

      if (!existingTab) {
        const newTabInfo: TabInfo = {
          tabId: tab.id, // Chrome tab ID
          url: tab.url,
          title: tab.title || 'Unknown Resume',
          state: TabState.DISCOVERED,
          errorCount: 0,
        };

        managedTabs.push(newTabInfo);

        await addLogEntry({
          level: 'info',
          message: `New resume tab discovered: ${newTabInfo.title}`,
          tabId: tab.id,
        });
      } else {
        // Update existing tab info
        existingTab.url = tab.url;
        existingTab.title = tab.title || existingTab.title;
      }
    }

    // Save updated tabs to storage
    await saveManagedTabs(managedTabs);

    console.log(`Tab list updated: ${managedTabs.length} managed tabs`);
  } catch (error) {
    console.error('Failed to update tab list:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to update tab list: ${error}`,
    });
  }
}

/**
 * Handle tab update events
 */
export async function onTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  try {
    const managedTab = managedTabs.find(t => t.tabId === tabId);

    if (!managedTab) {
      // Check if this is a new resume tab
      if (tab.url && isResumeUrl(tab.url)) {
        await updateTabList();
      }
      return;
    }

    // Update tab information
    if (changeInfo.url) {
      if (isResumeUrl(changeInfo.url)) {
        managedTab.url = changeInfo.url;
        await addLogEntry({
          level: 'info',
          message: `Tab URL updated: ${managedTab.title}`,
          tabId: tabId,
        });
      } else {
        // Tab navigated away from resume page
        await removeTab(tabId);
        return;
      }
    }

    if (changeInfo.title) {
      managedTab.title = changeInfo.title;
    }

    // Save updated tabs
    await saveManagedTabs(managedTabs);
  } catch (error) {
    console.error('Failed to handle tab update:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to handle tab update: ${error}`,
      tabId: tabId,
    });
  }
}

/**
 * Handle tab removal events
 */
export async function onTabRemoved(tabId: number): Promise<void> {
  try {
    await removeTab(tabId);
  } catch (error) {
    console.error('Failed to handle tab removal:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to handle tab removal: ${error}`,
      tabId: tabId,
    });
  }
}

/**
 * Remove a tab from management
 */
export async function removeTab(tabId: number): Promise<void> {
  const tabIndex = managedTabs.findIndex(tab => tab.tabId === tabId);

  if (tabIndex !== -1) {
    const removedTab = managedTabs[tabIndex];
    if (removedTab) {
      managedTabs.splice(tabIndex, 1);

      await saveManagedTabs(managedTabs);

      await addLogEntry({
        level: 'info',
        message: `Tab removed from management: ${removedTab.title}`,
        tabId: tabId,
      });

      console.log(`Tab ${tabId} removed from management`);
    }
  }
}

/**
 * Get all currently managed tabs
 */
export function getManagedTabsSync(): TabInfo[] {
  return [...managedTabs];
}

/**
 * Get a specific managed tab by ID
 */
export function getManagedTab(tabId: number): TabInfo | undefined {
  return managedTabs.find(tab => tab.tabId === tabId);
}

/**
 * Update tab state
 */
export async function updateTabState(
  tabId: number,
  state: TabState
): Promise<void> {
  const tab = managedTabs.find(t => t.tabId === tabId);

  if (tab) {
    const oldState = tab.state;
    tab.state = state;

    await saveManagedTabs(managedTabs);

    await addLogEntry({
      level: 'info',
      message: `Tab state changed from ${oldState} to ${state}: ${tab.title}`,
      tabId: tabId,
    });
  }
}

/**
 * Handle window focus change events
 */
async function onWindowFocusChanged(windowId: number): Promise<void> {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // No window has focus
      return;
    }

    console.log(`Window focus changed to: ${windowId}, updating tab list...`);

    // Update tab list when window focus changes
    await updateTabList();

    await addLogEntry({
      level: 'info',
      message: `Window focus changed, tab list updated`,
      data: { windowId, managedTabsCount: managedTabs.length },
    });
  } catch (error) {
    console.error('Failed to handle window focus change:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to handle window focus change: ${error}`,
      data: { windowId },
    });
  }
}

/**
 * Set up event listeners for tab events
 */
function setupEventListeners(): void {
  // Remove existing listeners to prevent duplicates
  if (chrome.tabs.onUpdated.hasListener(onTabUpdated)) {
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
  }
  if (chrome.tabs.onRemoved.hasListener(onTabRemoved)) {
    chrome.tabs.onRemoved.removeListener(onTabRemoved);
  }
  if (chrome.windows.onFocusChanged.hasListener(onWindowFocusChanged)) {
    chrome.windows.onFocusChanged.removeListener(onWindowFocusChanged);
  }

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(onTabUpdated);

  // Listen for tab removals
  chrome.tabs.onRemoved.addListener(onTabRemoved);

  // Listen for window focus changes
  chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

  console.log('Tab event listeners set up (including window focus tracking)');
}

/**
 * Clean up tabs that no longer exist or are no longer valid resume tabs
 */
async function cleanupInvalidTabs(): Promise<void> {
  const validTabIds: number[] = [];

  try {
    // Get all current tabs from ALL windows
    const allTabs = await chrome.tabs.query({
      currentWindow: false, // Search in all windows
    });

    // Filter for valid resume tabs only
    const validResumeTabs = allTabs.filter(tab => {
      if (!tab.url || tab.id === undefined) return false;
      const isValidTab = !tab.discarded && tab.status !== 'unloaded';
      const isResume = isResumeUrl(tab.url);
      return isResume && isValidTab;
    });

    validTabIds.push(
      ...(validResumeTabs
        .map(tab => tab.id)
        .filter(id => id !== undefined) as number[])
    );
    console.log(
      `🧹 Cleanup found ${validTabIds.length} valid resume tabs out of ${allTabs.length} total tabs`
    );
  } catch (error) {
    console.error('Failed to get current tabs for cleanup:', error);
    return;
  }

  // Remove tabs that no longer exist or are no longer valid resume tabs
  const initialCount = managedTabs.length;
  const removedTabs: TabInfo[] = [];

  managedTabs = managedTabs.filter(tab => {
    const isValid = validTabIds.includes(tab.tabId);
    if (!isValid) {
      removedTabs.push(tab);
    }
    return isValid;
  });

  if (managedTabs.length !== initialCount) {
    await saveManagedTabs(managedTabs);
    console.log(
      `🧹 Cleaned up ${initialCount - managedTabs.length} invalid tabs:`
    );
    removedTabs.forEach(tab => {
      console.log(`  - Removed: ${tab.title} (ID: ${tab.tabId})`);
    });

    await addLogEntry({
      level: 'info',
      message: `Cleaned up ${removedTabs.length} invalid tabs during initialization`,
      data: { removedTabIds: removedTabs.map(t => t.tabId) },
    });
  }
}

/**
 * Check if URL is a HeadHunter resume URL
 */
function isResumeUrl(url: string): boolean {
  if (!url) {
    console.log('❌ isResumeUrl: URL is empty or undefined');
    return false;
  }

  const hasHttps = url.startsWith('https://');
  const hasHttp = url.startsWith('http://');
  const hasHhKz = url.includes('hh.kz/resume/');
  const hasHhRu = url.includes('hh.ru/resume/');

  const isValid = (hasHhKz || hasHhRu) && (hasHttps || hasHttp);

  if (url.includes('hh.kz') || url.includes('hh.ru')) {
    console.log(`🔍 isResumeUrl check for: ${url}`);
    console.log(`  - HTTPS: ${hasHttps}, HTTP: ${hasHttp}`);
    console.log(`  - HH.KZ resume: ${hasHhKz}, HH.RU resume: ${hasHhRu}`);
    console.log(`  - Result: ${isValid}`);
  }

  return isValid;
}

/**
 * Get tab manager status
 */
export function getTabManagerStatus(): {
  isInitialized: boolean;
  managedTabsCount: number;
  managedTabs: TabInfo[];
} {
  return {
    isInitialized,
    managedTabsCount: managedTabs.length,
    managedTabs: [...managedTabs],
  };
}

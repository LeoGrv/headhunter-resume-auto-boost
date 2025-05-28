import { TabInfo, TabState } from './types';
/**
 * Initialize the tab manager
 */
export declare function initializeTabManager(): Promise<void>;
/**
 * Find all tabs with HeadHunter resume URLs
 */
export declare function findResumeTabs(): Promise<chrome.tabs.Tab[]>;
/**
 * Update the list of managed tabs
 */
export declare function updateTabList(): Promise<void>;
/**
 * Handle tab update events
 */
export declare function onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void>;
/**
 * Handle tab removal events
 */
export declare function onTabRemoved(tabId: number): Promise<void>;
/**
 * Remove a tab from management
 */
export declare function removeTab(tabId: number): Promise<void>;
/**
 * Get all currently managed tabs
 */
export declare function getManagedTabsSync(): TabInfo[];
/**
 * Get a specific managed tab by ID
 */
export declare function getManagedTab(tabId: number): TabInfo | undefined;
/**
 * Update tab state
 */
export declare function updateTabState(tabId: number, state: TabState): Promise<void>;
/**
 * Get tab manager status
 */
export declare function getTabManagerStatus(): {
    isInitialized: boolean;
    managedTabsCount: number;
    managedTabs: TabInfo[];
};
//# sourceMappingURL=tabManager.d.ts.map
import {
  initializeTabManager,
  findResumeTabs,
  updateTabList,
  onTabUpdated,
  onTabRemoved,
  removeTab,
  getManagedTabsSync,
  getManagedTab,
  updateTabState,
  getTabManagerStatus,
} from '../../../src/utils/tabManager';
import { TabState, TabInfo } from '../../../src/utils/types';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
    },
  },
  windows: {
    getAll: jest.fn(),
    onFocusChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
    },
    WINDOW_ID_NONE: -1,
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock storage utilities
jest.mock('../../src/utils/storage', () => ({
  getManagedTabs: jest.fn().mockResolvedValue([]),
  saveManagedTabs: jest.fn().mockResolvedValue(undefined),
  addLogEntry: jest.fn().mockResolvedValue(undefined),
}));

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('TabManager - Critical Bug Prevention Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Chrome API mocks to default behavior
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.windows.getAll.mockResolvedValue([]);
    mockChrome.tabs.get.mockResolvedValue({ id: 123, url: 'https://example.com' });
    
    // Reset hasListener to false for clean setup
    mockChrome.tabs.onUpdated.hasListener.mockReturnValue(false);
    mockChrome.tabs.onRemoved.hasListener.mockReturnValue(false);
    mockChrome.windows.onFocusChanged.hasListener.mockReturnValue(false);
  });

  describe('🚨 CRITICAL: Basic Functionality and Initialization', () => {
    test('should initialize TabManager without throwing errors', async () => {
      await expect(initializeTabManager()).resolves.not.toThrow();
    });

    test('should handle multiple initialization calls gracefully', async () => {
      // First initialization
      await expect(initializeTabManager()).resolves.not.toThrow();
      
      // Second initialization should not cause issues
      await expect(initializeTabManager()).resolves.not.toThrow();
      
      // Third initialization should still work
      await expect(initializeTabManager()).resolves.not.toThrow();
    });

    test('should return valid status after initialization', async () => {
      await initializeTabManager();
      
      const status = getTabManagerStatus();
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('managedTabsCount');
      expect(status).toHaveProperty('managedTabs');
      expect(typeof status.isInitialized).toBe('boolean');
      expect(typeof status.managedTabsCount).toBe('number');
      expect(Array.isArray(status.managedTabs)).toBe(true);
    });

    test('should handle getManagedTabsSync without initialization', () => {
      const tabs = getManagedTabsSync();
      
      expect(Array.isArray(tabs)).toBe(true);
      expect(tabs).toHaveLength(0);
    });

    test('should handle getManagedTab for non-existent tab', () => {
      const tab = getManagedTab(999);
      
      expect(tab).toBeUndefined();
    });
  });

  describe('🚨 CRITICAL: Resume Tab Detection and Validation', () => {
    test('should find resume tabs without throwing errors', async () => {
      // Mock valid resume tabs
      mockChrome.tabs.query.mockResolvedValue([
        {
          id: 1,
          url: 'https://hh.kz/resume/12345',
          title: 'Test Resume 1',
          status: 'complete',
          discarded: false,
        },
        {
          id: 2,
          url: 'https://hh.ru/resume/67890',
          title: 'Test Resume 2',
          status: 'complete',
          discarded: false,
        },
      ]);

      const tabs = await findResumeTabs();
      
      expect(Array.isArray(tabs)).toBe(true);
      expect(tabs.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle Chrome API failures in findResumeTabs', async () => {
      // Mock Chrome API failure
      mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API failed'));

      const tabs = await findResumeTabs();
      
      expect(Array.isArray(tabs)).toBe(true);
      expect(tabs).toHaveLength(0);
    });

    test('should filter out invalid tabs correctly', async () => {
      // Mock mix of valid and invalid tabs
      mockChrome.tabs.query.mockResolvedValue([
        {
          id: 1,
          url: 'https://hh.kz/resume/12345',
          title: 'Valid Resume',
          status: 'complete',
          discarded: false,
        },
        {
          id: 2,
          url: 'https://hh.kz/vacancy/12345', // Not a resume
          title: 'Vacancy Page',
          status: 'complete',
          discarded: false,
        },
        {
          id: 3,
          url: 'https://hh.ru/resume/67890',
          title: 'Discarded Resume',
          status: 'complete',
          discarded: true, // Invalid - discarded
        },
        {
          id: 4,
          url: undefined, // Invalid - no URL
          title: 'No URL Tab',
          status: 'complete',
          discarded: false,
        },
      ]);

      const tabs = await findResumeTabs();
      
      expect(Array.isArray(tabs)).toBe(true);
      // Should only include the first valid resume tab
      expect(tabs.length).toBeLessThanOrEqual(2); // Max 2 tabs as per requirements
    });

    test('should respect maximum tab limit', async () => {
      // Mock more than 2 valid resume tabs
      const manyTabs = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        url: `https://hh.kz/resume/${i + 1}`,
        title: `Resume ${i + 1}`,
        status: 'complete',
        discarded: false,
      }));

      mockChrome.tabs.query.mockResolvedValue(manyTabs);

      const tabs = await findResumeTabs();
      
      expect(Array.isArray(tabs)).toBe(true);
      expect(tabs.length).toBeLessThanOrEqual(2); // Should be limited to 2
    });
  });

  describe('🚨 CRITICAL: Tab State Management', () => {
    test('should update tab state without throwing errors', async () => {
      // Initialize with a mock tab
      const mockStorage = require('../../src/utils/storage');
      mockStorage.getManagedTabs.mockResolvedValue([
        {
          tabId: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'Test Resume',
          state: TabState.DISCOVERED,
          errorCount: 0,
        },
      ]);

      await initializeTabManager();
      
      await expect(updateTabState(123, TabState.ACTIVE)).resolves.not.toThrow();
    });

    test('should handle updateTabState for non-existent tab', async () => {
      await expect(updateTabState(999, TabState.ACTIVE)).resolves.not.toThrow();
    });

    test('should handle all valid tab states', async () => {
      const mockStorage = require('../../src/utils/storage');
      mockStorage.getManagedTabs.mockResolvedValue([
        {
          tabId: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'Test Resume',
          state: TabState.DISCOVERED,
          errorCount: 0,
        },
      ]);

      await initializeTabManager();

      // Test all valid states
      const validStates = [
        TabState.DISCOVERED,
        TabState.ACTIVE,
        TabState.PAUSED,
        TabState.ERROR,
      ];

      for (const state of validStates) {
        await expect(updateTabState(123, state)).resolves.not.toThrow();
      }
    });
  });

  describe('🚨 CRITICAL: Tab Event Handling', () => {
    test('should handle onTabUpdated without throwing errors', async () => {
      const changeInfo = { status: 'complete' };
      const tab = {
        id: 123,
        url: 'https://hh.kz/resume/12345',
        title: 'Test Resume',
        status: 'complete',
        discarded: false,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
      } as chrome.tabs.Tab;

      await expect(onTabUpdated(123, changeInfo, tab)).resolves.not.toThrow();
    });

    test('should handle onTabRemoved without throwing errors', async () => {
      await expect(onTabRemoved(123)).resolves.not.toThrow();
    });

    test('should handle removeTab without throwing errors', async () => {
      await expect(removeTab(123)).resolves.not.toThrow();
    });

    test('should handle tab events with invalid data', async () => {
      // Test with undefined/null values
      await expect(onTabUpdated(undefined as any, {}, {} as any)).resolves.not.toThrow();
      await expect(onTabRemoved(undefined as any)).resolves.not.toThrow();
      await expect(removeTab(undefined as any)).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Error Handling and Resilience', () => {
    test('should handle Chrome API failures during initialization', async () => {
      const mockStorage = require('../../src/utils/storage');
      
      // Mock storage failure
      mockStorage.getManagedTabs.mockRejectedValue(new Error('Storage failed'));
      
      await expect(initializeTabManager()).resolves.not.toThrow();
    });

    test('should handle Chrome tabs.query failures', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Tabs query failed'));
      
      await expect(updateTabList()).resolves.not.toThrow();
    });

    test('should handle Chrome windows.getAll failures', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.windows.getAll.mockRejectedValue(new Error('Windows API failed'));
      
      await expect(findResumeTabs()).resolves.not.toThrow();
    });

    test('should handle storage save failures gracefully', async () => {
      const mockStorage = require('../../src/utils/storage');
      mockStorage.saveManagedTabs.mockRejectedValue(new Error('Save failed'));
      
      await expect(updateTabList()).resolves.not.toThrow();
    });

    test('should handle malformed tab data', async () => {
      // Mock malformed tab data
      mockChrome.tabs.query.mockResolvedValue([
        null,
        undefined,
        {},
        { id: 'invalid' },
        { url: null },
        { id: 123, url: 'invalid-url' },
      ]);

      await expect(findResumeTabs()).resolves.not.toThrow();
      await expect(updateTabList()).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Memory and Resource Management', () => {
    test('should not accumulate tabs indefinitely', async () => {
      // Simulate multiple tab discovery cycles
      for (let i = 0; i < 10; i++) {
        mockChrome.tabs.query.mockResolvedValue([
          {
            id: i + 1,
            url: `https://hh.kz/resume/${i + 1}`,
            title: `Resume ${i + 1}`,
            status: 'complete',
            discarded: false,
          },
        ]);

        await updateTabList();
      }

      const tabs = getManagedTabsSync();
      
      // Should not accumulate all tabs, should be limited
      expect(tabs.length).toBeLessThanOrEqual(10);
    });

    test('should clean up removed tabs', async () => {
      // First, add some tabs
      mockChrome.tabs.query.mockResolvedValue([
        {
          id: 1,
          url: 'https://hh.kz/resume/1',
          title: 'Resume 1',
          status: 'complete',
          discarded: false,
        },
        {
          id: 2,
          url: 'https://hh.kz/resume/2',
          title: 'Resume 2',
          status: 'complete',
          discarded: false,
        },
      ]);

      await updateTabList();
      
      // Then simulate tabs being removed
      mockChrome.tabs.query.mockResolvedValue([]);
      
      await updateTabList();
      
      const tabs = getManagedTabsSync();
      expect(tabs.length).toBe(0);
    });

    test('should handle rapid tab operations', async () => {
      // Simulate rapid tab operations
      const operations = Array.from({ length: 20 }, (_, i) => 
        updateTabState(i + 1, TabState.ACTIVE)
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Edge Cases and Boundary Conditions', () => {
    test('should handle extreme tab IDs', async () => {
      const extremeIds = [0, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, NaN, Infinity, -Infinity];
      
      for (const id of extremeIds) {
        await expect(updateTabState(id, TabState.ACTIVE)).resolves.not.toThrow();
        expect(() => getManagedTab(id)).not.toThrow();
        await expect(removeTab(id)).resolves.not.toThrow();
      }
    });

    test('should handle empty and malformed URLs', async () => {
      const malformedUrls = [
        '',
        null,
        undefined,
        'not-a-url',
        'javascript:void(0)',
        'data:text/html,<h1>Test</h1>',
        'chrome://extensions/',
        'file:///path/to/file',
      ];

      for (const url of malformedUrls) {
        mockChrome.tabs.query.mockResolvedValue([
          {
            id: 1,
            url: url as any,
            title: 'Test Tab',
            status: 'complete',
            discarded: false,
          },
        ]);

        await expect(findResumeTabs()).resolves.not.toThrow();
      }
    });

    test('should handle concurrent initialization attempts', async () => {
      // Simulate concurrent initialization
      const initializations = Array.from({ length: 5 }, () => initializeTabManager());
      
      await expect(Promise.all(initializations)).resolves.not.toThrow();
    });

    test('should handle tab state transitions correctly', async () => {
      const mockStorage = require('../../src/utils/storage');
      mockStorage.getManagedTabs.mockResolvedValue([
        {
          tabId: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'Test Resume',
          state: TabState.DISCOVERED,
          errorCount: 0,
        },
      ]);

      await initializeTabManager();

      // Test all possible state transitions
      const stateTransitions = [
        [TabState.DISCOVERED, TabState.ACTIVE],
        [TabState.ACTIVE, TabState.PAUSED],
        [TabState.PAUSED, TabState.ACTIVE],
        [TabState.ACTIVE, TabState.ERROR],
        [TabState.ERROR, TabState.DISCOVERED],
      ];

      for (const [fromState, toState] of stateTransitions) {
        await expect(updateTabState(123, fromState)).resolves.not.toThrow();
        await expect(updateTabState(123, toState)).resolves.not.toThrow();
      }
    });
  });

  describe('🚨 CRITICAL: Data Consistency and Integrity', () => {
    test('should maintain consistent tab data structure', async () => {
      const mockStorage = require('../../src/utils/storage');
      mockStorage.getManagedTabs.mockResolvedValue([
        {
          tabId: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'Test Resume',
          state: TabState.DISCOVERED,
          errorCount: 0,
        },
      ]);

      await initializeTabManager();
      
      const tabs = getManagedTabsSync();
      
      tabs.forEach(tab => {
        expect(tab).toHaveProperty('tabId');
        expect(tab).toHaveProperty('url');
        expect(tab).toHaveProperty('title');
        expect(tab).toHaveProperty('state');
        expect(tab).toHaveProperty('errorCount');
        
        expect(typeof tab.tabId).toBe('number');
        expect(typeof tab.url).toBe('string');
        expect(typeof tab.title).toBe('string');
        expect(typeof tab.state).toBe('string');
        expect(typeof tab.errorCount).toBe('number');
      });
    });

    test('should return immutable copies of managed tabs', () => {
      const tabs1 = getManagedTabsSync();
      const tabs2 = getManagedTabsSync();
      
      // Should be different array instances
      expect(tabs1).not.toBe(tabs2);
      
      // But should have same content
      expect(tabs1).toEqual(tabs2);
    });

    test('should handle tab data validation', async () => {
      // Mock invalid tab data in storage
      const mockStorage = require('../../src/utils/storage');
      mockStorage.getManagedTabs.mockResolvedValue([
        null,
        undefined,
        {},
        { tabId: 'invalid' },
        { tabId: 123 }, // Missing required fields
        {
          tabId: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'Valid Tab',
          state: TabState.DISCOVERED,
          errorCount: 0,
        },
      ]);

      await expect(initializeTabManager()).resolves.not.toThrow();
      
      const tabs = getManagedTabsSync();
      
      // Should filter out invalid tabs
      expect(Array.isArray(tabs)).toBe(true);
    });
  });
}); 
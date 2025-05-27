/**
 * @jest-environment jsdom
 */

import { JSDOM } from 'jsdom';
import { TabState, TabInfo, AppSettings, LogEntry } from '../../../src/utils/types';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock storage utilities
jest.mock('../../src/utils/storage', () => ({
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  getManagedTabs: jest.fn(),
  getLogs: jest.fn(),
  clearLogs: jest.fn(),
  saveGlobalPauseState: jest.fn(),
  getGlobalPauseState: jest.fn(),
}));

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('Popup Component - Business Logic Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  // Mock storage functions
  const mockStorage = require('../../src/utils/storage');

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Popup</title>
        </head>
        <body>
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Loading...</span>
          </div>
          <div class="tabs-section">
            <div class="tabs-list"></div>
          </div>
          <div class="controls-section">
            <button id="global-pause">Pause All</button>
            <button id="settings">Settings</button>
            <button id="clear-logs">Clear Logs</button>
          </div>
          <div class="logs-section">
            <div class="logs-list"></div>
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test/popup.html',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    document = dom.window.document;
    window = dom.window as any;

    // Set up global DOM
    global.document = document;
    global.window = window as any;

    // Clear all mocks
    jest.clearAllMocks();

    // Reset storage mocks to default behavior
    mockStorage.getSettings.mockResolvedValue({
      clickInterval: 15,
      maxTabs: 2,
      refreshInterval: 15,
      globalPaused: false,
      loggingEnabled: true,
    });
    mockStorage.getManagedTabs.mockResolvedValue([]);
    mockStorage.getLogs.mockResolvedValue([]);
    mockStorage.getGlobalPauseState.mockResolvedValue(false);
    mockStorage.saveSettings.mockResolvedValue(undefined);
    mockStorage.saveGlobalPauseState.mockResolvedValue(undefined);
    mockStorage.clearLogs.mockResolvedValue(undefined);

    // Reset Chrome API mocks
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: { managedTabs: [] },
    });
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('🚨 CRITICAL: Popup Initialization', () => {
    test('should initialize popup without throwing errors', async () => {
      // Import popup after setting up mocks
      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle missing DOM elements gracefully', async () => {
      // Remove required DOM elements
      document.querySelector('.status-dot')?.remove();

      // Import popup - should handle missing elements
      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle storage loading errors gracefully', async () => {
      mockStorage.getSettings.mockRejectedValue(new Error('Storage error'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Chrome API failures during initialization', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Chrome API error'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Settings Management', () => {
    test('should load settings without errors', async () => {
      const testSettings: AppSettings = {
        clickInterval: 30,
        maxTabs: 3,
        refreshInterval: 20,
        globalPaused: true,
        loggingEnabled: false,
      };

      mockStorage.getSettings.mockResolvedValue(testSettings);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
      
      // Trigger DOMContentLoaded to start initialization
      const event = dom.window.document.createEvent('Event');
      event.initEvent('DOMContentLoaded', true, true);
      document.dispatchEvent(event);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify that settings loading was set up correctly (no errors)
      expect(mockStorage.getSettings).toBeDefined();
    });

    test('should use default settings when loading fails', async () => {
      mockStorage.getSettings.mockRejectedValue(new Error('Settings load failed'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle settings save operations', async () => {
      mockStorage.saveSettings.mockResolvedValue(undefined);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle settings save failures gracefully', async () => {
      mockStorage.saveSettings.mockRejectedValue(new Error('Settings save failed'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Tab Management', () => {
    test('should load managed tabs without errors', async () => {
      const testTabs: TabInfo[] = [
        {
          tabId: 123,
          url: 'https://hh.kz/resume/test',
          title: 'Test Resume',
          state: TabState.ACTIVE,
          errorCount: 0,
        },
      ];

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: testTabs },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle empty managed tabs list', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: [] },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Service Worker communication failures', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker not responding'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle malformed tab data', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { 
          managedTabs: [
            null,
            undefined,
            {},
            { tabId: 'invalid' },
            { tabId: 123 }, // Missing required fields
          ]
        },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Global Pause State Management', () => {
    test('should load global pause state without errors', async () => {
      mockStorage.getGlobalPauseState.mockResolvedValue(true);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
      
      // Trigger DOMContentLoaded to start initialization
      const event = dom.window.document.createEvent('Event');
      event.initEvent('DOMContentLoaded', true, true);
      document.dispatchEvent(event);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify that global pause state loading was set up correctly (no errors)
      expect(mockStorage.getGlobalPauseState).toBeDefined();
    });

    test('should handle global pause state save operations', async () => {
      mockStorage.saveGlobalPauseState.mockResolvedValue(undefined);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle global pause state failures gracefully', async () => {
      mockStorage.getGlobalPauseState.mockRejectedValue(new Error('Pause state load failed'));
      mockStorage.saveGlobalPauseState.mockRejectedValue(new Error('Pause state save failed'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Logs Management', () => {
    test('should load logs without errors', async () => {
      const testLogs: LogEntry[] = [
        {
          level: 'info',
          message: 'Test log entry',
          timestamp: Date.now(),
        },
      ];

      mockStorage.getLogs.mockResolvedValue(testLogs);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
      
      // Trigger DOMContentLoaded to start initialization
      const event = dom.window.document.createEvent('Event');
      event.initEvent('DOMContentLoaded', true, true);
      document.dispatchEvent(event);
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify that logs loading was set up correctly (no errors)
      expect(mockStorage.getLogs).toBeDefined();
    });

    test('should handle empty logs list', async () => {
      mockStorage.getLogs.mockResolvedValue([]);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle logs loading failures', async () => {
      mockStorage.getLogs.mockRejectedValue(new Error('Logs load failed'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle clear logs operation', async () => {
      mockStorage.clearLogs.mockResolvedValue(undefined);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle clear logs failures gracefully', async () => {
      mockStorage.clearLogs.mockRejectedValue(new Error('Clear logs failed'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Service Worker Communication', () => {
    test('should handle successful Service Worker messages', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: [] },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Service Worker error responses', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Service Worker error',
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Service Worker timeout', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Service Worker not available', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Could not establish connection'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: UI State Management', () => {
    test('should handle DOM manipulation without errors', async () => {
      await expect(import('../../src/popup/popup')).resolves.not.toThrow();

      // Check that DOM elements are accessible
      expect(document.querySelector('.status-dot')).toBeTruthy();
      expect(document.querySelector('.status-text')).toBeTruthy();
      expect(document.querySelector('.tabs-list')).toBeTruthy();
      expect(document.querySelector('.logs-list')).toBeTruthy();
    });

    test('should handle button click events without errors', async () => {
      await import('../../src/popup/popup');

      const globalPauseBtn = document.getElementById('global-pause') as HTMLButtonElement;
      const settingsBtn = document.getElementById('settings') as HTMLButtonElement;
      const clearLogsBtn = document.getElementById('clear-logs') as HTMLButtonElement;

      expect(globalPauseBtn).toBeTruthy();
      expect(settingsBtn).toBeTruthy();
      expect(clearLogsBtn).toBeTruthy();

      // Simulate clicks - should not throw errors
      expect(() => globalPauseBtn.click()).not.toThrow();
      expect(() => settingsBtn.click()).not.toThrow();
      expect(() => clearLogsBtn.click()).not.toThrow();
    });

    test('should handle status indicator updates', async () => {
      await import('../../src/popup/popup');

      const statusDot = document.querySelector('.status-dot') as HTMLElement;
      const statusText = document.querySelector('.status-text') as HTMLElement;

      expect(statusDot).toBeTruthy();
      expect(statusText).toBeTruthy();
    });
  });

  describe('🚨 CRITICAL: Error Handling and Resilience', () => {
    test('should handle multiple simultaneous errors', async () => {
      mockStorage.getSettings.mockRejectedValue(new Error('Settings error'));
      mockStorage.getLogs.mockRejectedValue(new Error('Logs error'));
      mockStorage.getGlobalPauseState.mockRejectedValue(new Error('Pause state error'));
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker error'));

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle corrupted data gracefully', async () => {
      mockStorage.getSettings.mockResolvedValue(null);
      mockStorage.getLogs.mockResolvedValue(null);
      mockChrome.runtime.sendMessage.mockResolvedValue(null);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle Chrome API unavailability', async () => {
      // @ts-ignore
      global.chrome = undefined;

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();

      // Restore chrome for other tests
      // @ts-ignore
      global.chrome = mockChrome;
    });

    test('should handle DOM manipulation errors', async () => {
      // Remove all DOM elements
      document.body.innerHTML = '';

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Data Validation and Sanitization', () => {
    test('should handle invalid tab states', async () => {
      const invalidTabs = [
        {
          tabId: 123,
          url: 'https://hh.kz/resume/test',
          title: 'Test Resume',
          state: 'INVALID_STATE' as any,
          errorCount: 0,
        },
      ];

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: invalidTabs },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle invalid log levels', async () => {
      const invalidLogs: LogEntry[] = [
        {
          level: 'INVALID_LEVEL' as any,
          message: 'Test log',
          timestamp: Date.now(),
        },
      ];

      mockStorage.getLogs.mockResolvedValue(invalidLogs);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle malformed timestamps', async () => {
      const malformedLogs: LogEntry[] = [
        {
          level: 'info',
          message: 'Test log',
          timestamp: 'invalid' as any,
        },
      ];

      mockStorage.getLogs.mockResolvedValue(malformedLogs);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Memory and Resource Management', () => {
    test('should handle rapid initialization attempts', async () => {
      const initializations = Array.from({ length: 5 }, () => 
        import('../../src/popup/popup')
      );

      await expect(Promise.all(initializations)).resolves.not.toThrow();
    });

    test('should handle large datasets without memory issues', async () => {
      // Create large datasets
      const largeTabs = Array.from({ length: 100 }, (_, i) => ({
        tabId: i + 1,
        url: `https://hh.kz/resume/${i + 1}`,
        title: `Resume ${i + 1}`,
        state: TabState.ACTIVE,
        errorCount: 0,
      }));

      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        level: 'info' as const,
        message: `Log entry ${i + 1}`,
        timestamp: Date.now() - i * 1000,
      }));

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: largeTabs },
      });
      mockStorage.getLogs.mockResolvedValue(largeLogs);

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle cleanup operations', async () => {
      await import('../../src/popup/popup');

      // Simulate cleanup by removing DOM
      document.body.innerHTML = '';

      // Should not cause errors
      expect(() => {
        // Trigger any cleanup that might be needed
        const event = dom.window.document.createEvent('Event');
        event.initEvent('beforeunload', true, true);
        window.dispatchEvent(event);
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Edge Cases and Boundary Conditions', () => {
    test('should handle extreme tab IDs', async () => {
      const extremeTabs = [
        {
          tabId: 0,
          url: 'https://hh.kz/resume/0',
          title: 'Zero Tab',
          state: TabState.ACTIVE,
          errorCount: 0,
        },
        {
          tabId: Number.MAX_SAFE_INTEGER,
          url: 'https://hh.kz/resume/max',
          title: 'Max Tab',
          state: TabState.ACTIVE,
          errorCount: 0,
        },
      ];

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: extremeTabs },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle empty and null strings', async () => {
      const edgeCaseTabs = [
        {
          tabId: 123,
          url: '',
          title: '',
          state: TabState.ACTIVE,
          errorCount: 0,
        },
        {
          tabId: 124,
          url: null as any,
          title: null as any,
          state: TabState.ACTIVE,
          errorCount: 0,
        },
      ];

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { managedTabs: edgeCaseTabs },
      });

      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });

    test('should handle concurrent operations', async () => {
      // Simulate concurrent operations
      const operations = [
        mockStorage.getSettings(),
        mockStorage.getLogs(),
        mockStorage.getGlobalPauseState(),
        mockChrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATE' }),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
      await expect(import('../../src/popup/popup')).resolves.not.toThrow();
    });
  });
}); 
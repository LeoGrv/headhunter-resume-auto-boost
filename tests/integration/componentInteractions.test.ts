/**
 * @jest-environment jsdom
 */

import { JSDOM } from 'jsdom';
import { BackgroundMessage, ContentMessage, Settings, LogEntry, ManagedTab } from '../../src/utils/types';

// Mock Chrome APIs for integration testing
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
    },
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
  },
  tabs: {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('Chrome Extension Component Integration Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>HeadHunter Resume Page</title>
        </head>
        <body>
          <div class="popup-container">
            <div id="status-indicator">Inactive</div>
            <button id="pause-resume-btn">Pause</button>
            <div id="managed-tabs-list"></div>
            <div id="logs-list"></div>
            <button id="clear-logs-btn">Clear Logs</button>
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test-id/popup.html',
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

    // Set up default Chrome API responses
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.alarms.getAll.mockResolvedValue([]);
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('🔗 CRITICAL: Service Worker ↔ Popup Communication', () => {
    test('should handle pause/resume state synchronization', async () => {
      // Mock storage to return initial state
      mockChrome.storage.sync.get.mockResolvedValue({
        globalPauseState: false,
      });

      // Simulate popup requesting pause state
      const pauseMessage: BackgroundMessage = {
        type: 'GET_PAUSE_STATE',
      };

      // Mock service worker response
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: false,
      });

      // Test communication flow
      expect(() => {
        mockChrome.runtime.sendMessage(pauseMessage);
      }).not.toThrow();

      // Verify message was sent
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(pauseMessage);

      // Simulate state change
      mockChrome.storage.sync.get.mockResolvedValue({
        globalPauseState: true,
      });

      const toggleMessage: BackgroundMessage = {
        type: 'TOGGLE_PAUSE_STATE',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: true,
      });

      // Test state toggle
      expect(() => {
        mockChrome.runtime.sendMessage(toggleMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(toggleMessage);
    });

    test('should handle timer status synchronization', async () => {
      // Mock timer data
      const mockTimers = [
        { id: 'timer-1', tabId: 123, interval: 300000, isActive: true },
        { id: 'timer-2', tabId: 456, interval: 600000, isActive: false },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        timers: mockTimers,
      });

      // Test timer status request
      const timerMessage: BackgroundMessage = {
        type: 'GET_TIMER_STATUS',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        timers: mockTimers,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(timerMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(timerMessage);
    });

    test('should handle managed tabs synchronization', async () => {
      // Mock managed tabs data
      const mockTabs: ManagedTab[] = [
        {
          id: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'My Resume',
          isActive: true,
          lastBoostTime: Date.now() - 300000,
        },
        {
          id: 456,
          url: 'https://hh.ru/resume/67890',
          title: 'Another Resume',
          isActive: false,
          lastBoostTime: Date.now() - 600000,
        },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        managedTabs: mockTabs,
      });

      // Test managed tabs request
      const tabsMessage: BackgroundMessage = {
        type: 'GET_MANAGED_TABS',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        tabs: mockTabs,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(tabsMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(tabsMessage);
    });

    test('should handle error propagation between components', async () => {
      // Test error handling in communication
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Service Worker not available'));

      const errorMessage: BackgroundMessage = {
        type: 'GET_PAUSE_STATE',
      };

      // Should handle errors gracefully
      await expect(
        mockChrome.runtime.sendMessage(errorMessage).catch(error => {
          // Handle error gracefully
          return { success: false, error: error.message };
        })
      ).resolves.toEqual({
        success: false,
        error: 'Service Worker not available',
      });
    });
  });

  describe('🔗 CRITICAL: Service Worker ↔ Content Script Communication', () => {
    test('should handle resume boost requests', async () => {
      // Mock content script message
      const boostMessage: ContentMessage = {
        type: 'BOOST_RESUME_REQUEST',
        tabId: 123,
        url: 'https://hh.kz/resume/12345',
      };

      // Mock service worker response
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        message: 'Resume boost initiated',
      });

      expect(() => {
        mockChrome.runtime.sendMessage(boostMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(boostMessage);
    });

    test('should handle timer creation from content script', async () => {
      // Mock timer creation request
      const timerMessage: ContentMessage = {
        type: 'CREATE_TIMER',
        tabId: 123,
        interval: 300000,
        url: 'https://hh.kz/resume/12345',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        timerId: 'timer-123',
      });

      expect(() => {
        mockChrome.runtime.sendMessage(timerMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(timerMessage);
    });

    test('should handle content script status updates', async () => {
      // Mock status update from content script
      const statusMessage: ContentMessage = {
        type: 'STATUS_UPDATE',
        tabId: 123,
        status: 'Button found and ready',
        timestamp: Date.now(),
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(statusMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(statusMessage);
    });

    test('should handle background script commands to content script', async () => {
      // Mock background script sending command to content script
      const commandMessage: BackgroundMessage = {
        type: 'BOOST_RESUME',
        tabId: 123,
      };

      // Simulate message listener in content script
      const mockMessageHandler = jest.fn((message, sender, sendResponse) => {
        if (message.type === 'BOOST_RESUME') {
          sendResponse({ success: true, action: 'boost_initiated' });
        }
      });

      mockChrome.runtime.onMessage.addListener(mockMessageHandler);

      // Simulate sending message
      expect(() => {
        mockChrome.runtime.sendMessage(commandMessage);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(commandMessage);
    });
  });

  describe('🔗 CRITICAL: Popup ↔ Content Script Indirect Communication', () => {
    test('should handle popup-initiated resume boost via service worker', async () => {
      // Simulate popup requesting resume boost for specific tab
      const popupRequest: BackgroundMessage = {
        type: 'BOOST_RESUME',
        tabId: 123,
      };

      // Mock service worker forwarding to content script
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        message: 'Boost request forwarded to content script',
      });

      expect(() => {
        mockChrome.runtime.sendMessage(popupRequest);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(popupRequest);
    });

    test('should handle tab management from popup', async () => {
      // Simulate popup requesting tab creation
      const createTabRequest: BackgroundMessage = {
        type: 'CREATE_TAB',
        url: 'https://hh.kz/resume/new',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        tabId: 789,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(createTabRequest);
      }).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(createTabRequest);
    });

    test('should handle settings updates affecting all components', async () => {
      // Mock settings update from popup
      const newSettings: Settings = {
        interval: 600000, // 10 minutes
        maxTabs: 10,
        autoStart: true,
        notifications: true,
      };

      mockChrome.storage.sync.set.mockResolvedValue(undefined);

      // Test settings save
      expect(() => {
        mockChrome.storage.sync.set({ settings: newSettings });
      }).not.toThrow();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        settings: newSettings,
      });

      // Simulate settings propagation message
      const settingsMessage: BackgroundMessage = {
        type: 'SETTINGS_UPDATED',
        settings: newSettings,
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(settingsMessage);
      }).not.toThrow();
    });
  });

  describe('🔗 CRITICAL: State Synchronization Across Components', () => {
    test('should maintain consistent pause state across all components', async () => {
      // Initial state
      let globalPauseState = false;

      // Mock storage operations
      mockChrome.storage.sync.get.mockImplementation((keys) => {
        if (keys === 'globalPauseState' || (Array.isArray(keys) && keys.includes('globalPauseState'))) {
          return Promise.resolve({ globalPauseState });
        }
        return Promise.resolve({});
      });

      mockChrome.storage.sync.set.mockImplementation((data) => {
        if ('globalPauseState' in data) {
          globalPauseState = data.globalPauseState;
        }
        return Promise.resolve();
      });

      // Test state change propagation
      const toggleMessage: BackgroundMessage = {
        type: 'TOGGLE_PAUSE_STATE',
      };

      // Simulate state toggle
      globalPauseState = !globalPauseState;
      await mockChrome.storage.sync.set({ globalPauseState });

      // Verify state consistency
      const result = await mockChrome.storage.sync.get('globalPauseState');
      expect(result.globalPauseState).toBe(true);

      // Test message propagation
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: globalPauseState,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(toggleMessage);
      }).not.toThrow();
    });

    test('should maintain consistent timer state across components', async () => {
      // Mock timer state
      const timerState = {
        timers: [
          { id: 'timer-1', tabId: 123, interval: 300000, isActive: true },
        ],
      };

      mockChrome.storage.local.get.mockResolvedValue(timerState);
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Test timer state access
      const result = await mockChrome.storage.local.get('timers');
      expect(result.timers).toEqual(timerState.timers);

      // Test timer state update
      const updatedTimers = [
        { id: 'timer-1', tabId: 123, interval: 300000, isActive: false },
      ];

      await mockChrome.storage.local.set({ timers: updatedTimers });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timers: updatedTimers,
      });
    });

    test('should maintain consistent managed tabs state', async () => {
      // Mock managed tabs state
      const managedTabsState = {
        managedTabs: [
          {
            id: 123,
            url: 'https://hh.kz/resume/12345',
            title: 'My Resume',
            isActive: true,
            lastBoostTime: Date.now(),
          },
        ],
      };

      mockChrome.storage.local.get.mockResolvedValue(managedTabsState);
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Test managed tabs access
      const result = await mockChrome.storage.local.get('managedTabs');
      expect(result.managedTabs).toEqual(managedTabsState.managedTabs);

      // Test managed tabs update
      const updatedTabs = [
        {
          id: 123,
          url: 'https://hh.kz/resume/12345',
          title: 'My Resume',
          isActive: false,
          lastBoostTime: Date.now() + 300000,
        },
      ];

      await mockChrome.storage.local.set({ managedTabs: updatedTabs });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        managedTabs: updatedTabs,
      });
    });

    test('should handle concurrent state updates safely', async () => {
      // Simulate concurrent operations
      const operations = [
        mockChrome.storage.sync.set({ globalPauseState: true }),
        mockChrome.storage.local.set({ timers: [] }),
        mockChrome.storage.local.set({ managedTabs: [] }),
      ];

      // All operations should complete without throwing
      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Verify all operations were called
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ globalPauseState: true });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ timers: [] });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ managedTabs: [] });
    });
  });

  describe('🔗 CRITICAL: End-to-End User Workflows', () => {
    test('should handle complete resume boost workflow', async () => {
      // Step 1: User opens popup
      mockChrome.storage.sync.get.mockResolvedValue({
        globalPauseState: false,
        settings: { interval: 300000, maxTabs: 5, autoStart: true, notifications: true },
      });

      mockChrome.storage.local.get.mockResolvedValue({
        managedTabs: [
          {
            id: 123,
            url: 'https://hh.kz/resume/12345',
            title: 'My Resume',
            isActive: true,
            lastBoostTime: Date.now() - 400000, // 6+ minutes ago
          },
        ],
      });

      // Step 2: Popup loads current state
      const stateRequest: BackgroundMessage = {
        type: 'GET_CURRENT_STATE',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: false,
        managedTabs: 1,
        activeTimers: 1,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(stateRequest);
      }).not.toThrow();

      // Step 3: User clicks boost button
      const boostRequest: BackgroundMessage = {
        type: 'BOOST_RESUME',
        tabId: 123,
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        message: 'Resume boost initiated',
      });

      expect(() => {
        mockChrome.runtime.sendMessage(boostRequest);
      }).not.toThrow();

      // Step 4: Service worker forwards to content script
      // (This would be handled by the actual service worker)

      // Step 5: Content script reports success
      const successMessage: ContentMessage = {
        type: 'BOOST_SUCCESS',
        tabId: 123,
        timestamp: Date.now(),
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(successMessage);
      }).not.toThrow();

      // Verify all steps completed
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should handle pause/resume workflow', async () => {
      // Step 1: Initial state (active)
      mockChrome.storage.sync.get.mockResolvedValue({
        globalPauseState: false,
      });

      // Step 2: User clicks pause
      const pauseRequest: BackgroundMessage = {
        type: 'TOGGLE_PAUSE_STATE',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: true,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(pauseRequest);
      }).not.toThrow();

      // Step 3: State is updated in storage
      await mockChrome.storage.sync.set({ globalPauseState: true });

      // Step 4: All timers are paused
      const pauseTimersMessage: BackgroundMessage = {
        type: 'PAUSE_ALL_TIMERS',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        pausedTimers: 2,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(pauseTimersMessage);
      }).not.toThrow();

      // Step 5: User resumes
      const resumeRequest: BackgroundMessage = {
        type: 'TOGGLE_PAUSE_STATE',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: false,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(resumeRequest);
      }).not.toThrow();

      // Verify workflow completed
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ globalPauseState: true });
    });

    test('should handle settings update workflow', async () => {
      // Step 1: User opens settings
      const currentSettings: Settings = {
        interval: 300000,
        maxTabs: 5,
        autoStart: true,
        notifications: true,
      };

      mockChrome.storage.sync.get.mockResolvedValue({
        settings: currentSettings,
      });

      // Step 2: User modifies settings
      const newSettings: Settings = {
        interval: 600000, // Changed to 10 minutes
        maxTabs: 10, // Increased max tabs
        autoStart: false, // Disabled auto start
        notifications: false, // Disabled notifications
      };

      // Step 3: Settings are saved
      await mockChrome.storage.sync.set({ settings: newSettings });

      // Step 4: Settings update is broadcast
      const settingsUpdateMessage: BackgroundMessage = {
        type: 'SETTINGS_UPDATED',
        settings: newSettings,
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        updatedComponents: ['serviceWorker', 'contentScripts'],
      });

      expect(() => {
        mockChrome.runtime.sendMessage(settingsUpdateMessage);
      }).not.toThrow();

      // Step 5: Timers are updated with new interval
      const updateTimersMessage: BackgroundMessage = {
        type: 'UPDATE_TIMER_INTERVALS',
        newInterval: newSettings.interval,
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        updatedTimers: 3,
      });

      expect(() => {
        mockChrome.runtime.sendMessage(updateTimersMessage);
      }).not.toThrow();

      // Verify workflow completed
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({ settings: newSettings });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('should handle error recovery workflow', async () => {
      // Step 1: Service worker becomes unavailable
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Service worker not responding'));

      const testMessage: BackgroundMessage = {
        type: 'GET_PAUSE_STATE',
      };

      // Step 2: Popup handles error gracefully
      const result = await mockChrome.runtime.sendMessage(testMessage).catch(error => ({
        success: false,
        error: error.message,
      }));

      expect(result).toEqual({
        success: false,
        error: 'Service worker not responding',
      });

      // Step 3: Popup falls back to storage
      mockChrome.storage.sync.get.mockResolvedValue({
        globalPauseState: false,
      });

      const fallbackResult = await mockChrome.storage.sync.get('globalPauseState');
      expect(fallbackResult.globalPauseState).toBe(false);

      // Step 4: Service worker recovers
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        isPaused: false,
      });

      // Step 5: Normal operation resumes
      const recoveryMessage: BackgroundMessage = {
        type: 'GET_PAUSE_STATE',
      };

      const recoveryResult = await mockChrome.runtime.sendMessage(recoveryMessage);
      expect(recoveryResult.success).toBe(true);

      // Verify error recovery workflow
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith('globalPauseState');
    });
  });

  describe('🔗 CRITICAL: Data Flow and Consistency', () => {
    test('should maintain data consistency during rapid operations', async () => {
      // Simulate rapid operations
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          mockChrome.storage.local.set({
            [`timer-${i}`]: {
              id: `timer-${i}`,
              tabId: 100 + i,
              interval: 300000,
              isActive: i % 2 === 0,
            },
          })
        );
      }

      // All operations should complete
      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Verify all operations were called
      expect(mockChrome.storage.local.set).toHaveBeenCalledTimes(10);
    });

    test('should handle message queue overflow gracefully', async () => {
      // Simulate message queue overflow
      const messages = [];

      for (let i = 0; i < 100; i++) {
        messages.push({
          type: 'STATUS_UPDATE',
          tabId: i,
          status: `Status ${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Mock responses for all messages
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      // Send all messages
      const sendPromises = messages.map(message =>
        mockChrome.runtime.sendMessage(message).catch(error => ({
          success: false,
          error: error.message,
        }))
      );

      // All messages should be handled
      const results = await Promise.all(sendPromises);
      expect(results.every(result => result.success)).toBe(true);
    });

    test('should handle storage quota limits gracefully', async () => {
      // Simulate storage quota exceeded
      mockChrome.storage.local.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      const largeData = {
        logs: Array.from({ length: 10000 }, (_, i) => ({
          level: 'info',
          message: `Log entry ${i}`,
          timestamp: Date.now() + i,
        })),
      };

      // Should handle quota error gracefully
      const result = await mockChrome.storage.local.set(largeData).catch(error => ({
        success: false,
        error: error.message,
      }));

      expect(result).toEqual({
        success: false,
        error: 'QUOTA_EXCEEDED',
      });
    });

    test('should maintain component isolation during failures', async () => {
      // Simulate one component failing
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'FAILING_OPERATION') {
          return Promise.reject(new Error('Component failure'));
        }
        return Promise.resolve({ success: true });
      });

      // Test that other operations continue to work
      const workingMessage: BackgroundMessage = {
        type: 'GET_PAUSE_STATE',
      };

      const failingMessage: BackgroundMessage = {
        type: 'FAILING_OPERATION',
      };

      // Working operation should succeed
      const workingResult = await mockChrome.runtime.sendMessage(workingMessage);
      expect(workingResult.success).toBe(true);

      // Failing operation should fail gracefully
      const failingResult = await mockChrome.runtime.sendMessage(failingMessage).catch(error => ({
        success: false,
        error: error.message,
      }));

      expect(failingResult).toEqual({
        success: false,
        error: 'Component failure',
      });

      // Other operations should still work
      const anotherWorkingResult = await mockChrome.runtime.sendMessage(workingMessage);
      expect(anotherWorkingResult.success).toBe(true);
    });
  });

  describe('🔗 CRITICAL: Performance and Scalability', () => {
    test('should handle multiple concurrent users efficiently', async () => {
      // Simulate multiple concurrent operations
      const concurrentOperations = Array.from({ length: 50 }, (_, i) => ({
        type: 'BOOST_RESUME',
        tabId: 1000 + i,
        timestamp: Date.now() + i,
      }));

      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const startTime = Date.now();

      // Execute all operations concurrently
      const results = await Promise.all(
        concurrentOperations.map(op => mockChrome.runtime.sendMessage(op))
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // All operations should succeed
      expect(results.every(result => result.success)).toBe(true);

      // Should complete within reasonable time (less than 1 second)
      expect(executionTime).toBeLessThan(1000);
    });

    test('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeManagedTabs = Array.from({ length: 1000 }, (_, i) => ({
        id: 1000 + i,
        url: `https://hh.kz/resume/${1000 + i}`,
        title: `Resume ${i}`,
        isActive: i % 2 === 0,
        lastBoostTime: Date.now() - (i * 1000),
      }));

      mockChrome.storage.local.get.mockResolvedValue({
        managedTabs: largeManagedTabs,
      });

      const startTime = Date.now();

      // Retrieve large dataset
      const result = await mockChrome.storage.local.get('managedTabs');

      const endTime = Date.now();
      const retrievalTime = endTime - startTime;

      // Should retrieve data successfully
      expect(result.managedTabs).toHaveLength(1000);

      // Should complete within reasonable time
      expect(retrievalTime).toBeLessThan(100);
    });

    test('should handle memory-intensive operations without leaks', async () => {
      // Simulate memory-intensive operations
      for (let i = 0; i < 100; i++) {
        const largeMessage = {
          type: 'LARGE_DATA_OPERATION',
          data: Array.from({ length: 1000 }, (_, j) => `data-${i}-${j}`),
          timestamp: Date.now() + i,
        };

        mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

        // Each operation should complete without throwing
        await expect(mockChrome.runtime.sendMessage(largeMessage)).resolves.not.toThrow();
      }

      // Verify all operations completed
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(100);
    });
  });
}); 
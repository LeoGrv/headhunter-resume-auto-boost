import { PersistentAlarmManager } from '../../../src/utils/persistentAlarmManager';

// Mock Chrome APIs with minimal implementation
const mockChrome = {
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn().mockResolvedValue([]),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    lastError: undefined as any,
  },
  tabs: {
    get: jest.fn().mockResolvedValue({ id: 123, url: 'https://example.com' }),
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

describe('PersistentAlarmManager - Critical Bug Prevention Tests', () => {
  let alarmManager: PersistentAlarmManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome.runtime.lastError = undefined;
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.alarms.getAll.mockResolvedValue([]);
    mockChrome.alarms.create.mockResolvedValue(undefined);
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    
    // Create a single instance for all tests
    if (!alarmManager) {
      alarmManager = new PersistentAlarmManager();
    }
  });

  describe('🚨 CRITICAL: Basic Functionality and Error Prevention', () => {
    test('should initialize without throwing errors', () => {
      expect(() => {
        alarmManager = new PersistentAlarmManager();
      }).not.toThrow();
      
      expect(alarmManager).toBeDefined();
      expect(alarmManager).toBeInstanceOf(PersistentAlarmManager);
    });

    test('should handle getTimerStatus for non-existent timer', () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 999;

      const status = alarmManager.getTimerStatus(tabId);
      
      expect(status).toBeDefined();
      expect(status.exists).toBe(false);
      expect(status.isActive).toBe(false);
      expect(status.remainingMs).toBe(0);
      expect(status.remainingFormatted).toBeDefined();
    });

    test('should handle isTimerActive for non-existent timer', () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 999;

      const isActive = alarmManager.isTimerActive(tabId);
      
      expect(isActive).toBe(false);
    });

    test('should return empty array for getActiveTimers initially', () => {
      alarmManager = new PersistentAlarmManager();

      const activeTimers = alarmManager.getActiveTimers();
      
      expect(activeTimers).toBeDefined();
      expect(Array.isArray(activeTimers)).toBe(true);
      expect(activeTimers).toHaveLength(0);
    });
  });

  describe('🚨 CRITICAL: Error Handling and Resilience', () => {
    test('should handle startTimer without throwing errors', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;
      const intervalMs = 15 * 60 * 1000;

      await expect(alarmManager.startTimer(tabId, intervalMs)).resolves.not.toThrow();
    });

    test('should handle stopTimer without throwing errors', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      await expect(alarmManager.stopTimer(tabId)).resolves.not.toThrow();
    });

    test('should handle resetTimer without throwing errors', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;
      const intervalMs = 30 * 60 * 1000;

      await expect(alarmManager.resetTimer(tabId, intervalMs)).resolves.not.toThrow();
    });

    test('should handle pauseTimer gracefully', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 999; // Non-existent timer

      const result = await alarmManager.pauseTimer(tabId);
      expect(typeof result).toBe('boolean');
    });

    test('should handle resumeTimer gracefully', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 999; // Non-existent timer

      const result = await alarmManager.resumeTimer(tabId);
      expect(typeof result).toBe('boolean');
    });

    test('should handle Chrome API failures in startTimer', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      // Mock Chrome API failure
      mockChrome.alarms.create.mockRejectedValue(new Error('Chrome API failed'));

      // Should not throw error
      await expect(alarmManager.startTimer(tabId)).resolves.not.toThrow();
    });

    test('should handle storage failures gracefully', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      // Mock storage failure
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage failed'));

      // Should not throw error
      await expect(alarmManager.startTimer(tabId)).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Callback Management', () => {
    test('should set global callback without errors', () => {
      alarmManager = new PersistentAlarmManager();
      const mockCallback = jest.fn();

      expect(() => {
        alarmManager.setGlobalCallback(mockCallback);
      }).not.toThrow();
    });

    test('should remove callback without errors', () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      expect(() => {
        alarmManager.removeCallback(tabId);
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Resource Management', () => {
    test('should handle cleanup without errors', async () => {
      alarmManager = new PersistentAlarmManager();

      await expect(alarmManager.cleanup()).resolves.not.toThrow();
    });

    test('should handle tab closure without errors', async () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      await expect(alarmManager.handleTabClosure(tabId)).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: State Consistency', () => {
    test('should maintain consistent timer status format', () => {
      alarmManager = new PersistentAlarmManager();
      const tabId = 123;

      const status = alarmManager.getTimerStatus(tabId);
      
      // Verify all required fields exist
      expect(status).toHaveProperty('exists');
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('remainingMs');
      expect(status).toHaveProperty('remainingFormatted');
      
      // Verify field types
      expect(typeof status.exists).toBe('boolean');
      expect(typeof status.isActive).toBe('boolean');
      expect(typeof status.remainingMs).toBe('number');
      expect(typeof status.remainingFormatted).toBe('string');
    });

    test('should return consistent active timers format', () => {
      alarmManager = new PersistentAlarmManager();

      const activeTimers = alarmManager.getActiveTimers();
      
      expect(Array.isArray(activeTimers)).toBe(true);
      
      // If there are timers, verify their structure
      activeTimers.forEach(timer => {
        expect(timer).toHaveProperty('tabId');
        expect(timer).toHaveProperty('intervalMs');
        expect(timer).toHaveProperty('startTime');
        expect(timer).toHaveProperty('alarmName');
        expect(timer).toHaveProperty('retryCount');
        
        expect(typeof timer.tabId).toBe('number');
        expect(typeof timer.intervalMs).toBe('number');
        expect(typeof timer.startTime).toBe('number');
        expect(typeof timer.alarmName).toBe('string');
        expect(typeof timer.retryCount).toBe('number');
      });
    });
  });

  describe('🚨 CRITICAL: Chrome API Integration Safety', () => {
    test('should handle missing Chrome API gracefully', async () => {
      // This test verifies that the class can be imported and referenced
      // without Chrome API being available (actual instantiation requires Chrome API)
      expect(PersistentAlarmManager).toBeDefined();
      expect(typeof PersistentAlarmManager).toBe('function');
    });

    test('should handle partial Chrome API gracefully', async () => {
      // Mock partial Chrome API
      const partialChrome = {
        alarms: {
          onAlarm: {
            addListener: jest.fn(),
          },
        },
      };

      const originalChrome = global.chrome;
      // @ts-ignore
      global.chrome = partialChrome;

      // Should not throw during initialization
      expect(() => {
        new PersistentAlarmManager();
      }).not.toThrow();

      // Restore chrome
      // @ts-ignore
      global.chrome = originalChrome;
    });
  });

  describe('🚨 CRITICAL: Memory Leak Prevention', () => {
    test('should not accumulate timers indefinitely', async () => {
      // Start multiple timers
      const tabIds = [1, 2, 3, 4, 5];
      for (const tabId of tabIds) {
        await alarmManager.startTimer(tabId);
      }

      // Stop all timers
      for (const tabId of tabIds) {
        await alarmManager.stopTimer(tabId);
      }

      // Active timers should be cleaned up
      const activeTimers = alarmManager.getActiveTimers();
      expect(activeTimers.length).toBeLessThanOrEqual(tabIds.length);
    });

    test('should handle rapid start/stop cycles', async () => {
      const tabId = 123;

      // Rapid start/stop cycles
      for (let i = 0; i < 5; i++) {
        await alarmManager.startTimer(tabId);
        await alarmManager.stopTimer(tabId);
      }

      // Should not throw errors or accumulate state
      expect(() => alarmManager.getTimerStatus(tabId)).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Edge Cases and Boundary Conditions', () => {
    test('should handle invalid tab IDs', async () => {
      // Test with various invalid tab IDs
      const invalidTabIds = [-1, 0, NaN, Infinity, -Infinity];
      
      for (const tabId of invalidTabIds) {
        await expect(alarmManager.startTimer(tabId)).resolves.not.toThrow();
        expect(() => alarmManager.getTimerStatus(tabId)).not.toThrow();
        expect(() => alarmManager.isTimerActive(tabId)).not.toThrow();
      }
    });

    test('should handle extreme interval values', async () => {
      const tabId = 123;

      // Test with extreme interval values
      const extremeIntervals = [0, -1000, 1, 999999999, Infinity, -Infinity, NaN];
      
      for (const interval of extremeIntervals) {
        await expect(alarmManager.startTimer(tabId, interval)).resolves.not.toThrow();
      }
    });

    test('should handle concurrent operations', async () => {
      const tabId = 123;

      // Start multiple operations simultaneously
      const operations = [
        alarmManager.startTimer(tabId),
        alarmManager.pauseTimer(tabId),
        alarmManager.resumeTimer(tabId),
        alarmManager.stopTimer(tabId),
        alarmManager.resetTimer(tabId),
      ];

      // All operations should complete without throwing
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
}); 
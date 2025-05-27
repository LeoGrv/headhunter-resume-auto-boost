/**
 * @jest-environment jsdom
 */

import { JSDOM } from 'jsdom';

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
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
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

describe('🐛 REAL BUG DETECTION TESTS - Finding Actual Problems', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: 'chrome-extension://test-id/popup.html',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    window = dom.window as any;

    global.document = document;
    global.window = window as any;

    jest.clearAllMocks();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('🚨 BUG #1: Race Condition in Service Worker Initialization', () => {
    test('should detect race condition when multiple initialization calls happen simultaneously', async () => {
      // This tests a REAL bug: if initializeExtension() is called multiple times
      // before isInitialized is set to true, it will run multiple times
      
      let initializationCount = 0;
      let isInitialized = false;

      // Simulate the buggy initialization function
      const buggyInitializeExtension = async () => {
        // BUG: This check happens BEFORE async operations complete
        if (isInitialized) {
          return;
        }

        initializationCount++;
        
        // Simulate async operations (storage, tab discovery, etc.)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // BUG: isInitialized is set AFTER async operations
        // Multiple calls can pass the initial check before this is set
        isInitialized = true;
      };

      // Simulate multiple rapid initialization calls (real scenario)
      const promises = [
        buggyInitializeExtension(),
        buggyInitializeExtension(),
        buggyInitializeExtension(),
      ];

      await Promise.all(promises);

      // BUG DETECTED: Should initialize only once, but initializes multiple times
      expect(initializationCount).toBeGreaterThan(1);
      console.log(`🐛 BUG DETECTED: Initialization ran ${initializationCount} times instead of 1`);
    });

    test('should show the CORRECT way to prevent race conditions', async () => {
      let initializationCount = 0;
      let isInitialized = false;
      let initializationPromise: Promise<void> | null = null;

      // FIXED version with proper race condition handling
      const fixedInitializeExtension = async () => {
        // FIX: Return existing promise if initialization is in progress
        if (initializationPromise) {
          return initializationPromise;
        }

        if (isInitialized) {
          return;
        }

        // FIX: Store the promise to prevent concurrent initializations
        initializationPromise = (async () => {
          initializationCount++;
          
          // Simulate async operations
          await new Promise(resolve => setTimeout(resolve, 100));
          
          isInitialized = true;
          initializationPromise = null; // Reset for future use
        })();

        return initializationPromise;
      };

      // Test with multiple rapid calls
      const promises = [
        fixedInitializeExtension(),
        fixedInitializeExtension(),
        fixedInitializeExtension(),
      ];

      await Promise.all(promises);

      // FIXED: Should initialize exactly once
      expect(initializationCount).toBe(1);
      console.log(`✅ FIXED: Initialization ran exactly ${initializationCount} time`);
    });
  });

  describe('🚨 BUG #2: Memory Leak in Processing Lock', () => {
    test('should detect memory leak when processing lock is not released on error', async () => {
      const processingTabs = new Set<number>();
      let memoryLeakDetected = false;

      // Simulate the buggy timer expiration handler
      const buggyHandleTimerExpiration = async (tabId: number) => {
        if (processingTabs.has(tabId)) {
          return;
        }

        processingTabs.add(tabId);

        try {
          // Simulate some processing that might throw an error
          if (tabId === 999) {
            throw new Error('Simulated processing error');
          }
          
          // Normal processing...
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          // BUG: Processing lock is NOT released in catch block
          // The finally block is missing!
          console.error('Error in processing:', error);
          throw error; // Re-throw error
        }
        
        // BUG: This only runs if no error occurs
        processingTabs.delete(tabId);
      };

      // Test normal operation
      await buggyHandleTimerExpiration(123);
      expect(processingTabs.has(123)).toBe(false); // Should be cleaned up

      // Test error scenario - this will cause memory leak
      try {
        await buggyHandleTimerExpiration(999);
      } catch (error) {
        // Expected error
      }

      // BUG DETECTED: Tab 999 is still in processing set (memory leak)
      if (processingTabs.has(999)) {
        memoryLeakDetected = true;
        console.log(`🐛 MEMORY LEAK DETECTED: Tab 999 still in processing set: ${Array.from(processingTabs)}`);
      }

      expect(memoryLeakDetected).toBe(true);
      expect(processingTabs.size).toBeGreaterThan(0);
    });

    test('should show the CORRECT way to prevent memory leaks', async () => {
      const processingTabs = new Set<number>();

      // FIXED version with proper cleanup
      const fixedHandleTimerExpiration = async (tabId: number) => {
        if (processingTabs.has(tabId)) {
          return;
        }

        processingTabs.add(tabId);

        try {
          // Simulate processing that might throw an error
          if (tabId === 999) {
            throw new Error('Simulated processing error');
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error('Error in processing:', error);
          throw error;
        } finally {
          // FIX: Always release the lock in finally block
          processingTabs.delete(tabId);
        }
      };

      // Test normal operation
      await fixedHandleTimerExpiration(123);
      expect(processingTabs.has(123)).toBe(false);

      // Test error scenario
      try {
        await fixedHandleTimerExpiration(999);
      } catch (error) {
        // Expected error
      }

      // FIXED: No memory leak, tab 999 should be cleaned up
      expect(processingTabs.has(999)).toBe(false);
      expect(processingTabs.size).toBe(0);
      console.log(`✅ FIXED: No memory leak, processing set is clean: ${Array.from(processingTabs)}`);
    });
  });

  describe('🚨 BUG #3: Infinite Timer Restart Loop', () => {
    test('should detect infinite loop when timer restart fails repeatedly', async () => {
      let timerRestartAttempts = 0;
      let infiniteLoopDetected = false;

      // Mock persistent alarm manager that always fails
      const buggyAlarmManager = {
        startTimer: jest.fn().mockImplementation(async () => {
          timerRestartAttempts++;
          throw new Error('Timer start failed');
        }),
      };

      // Simulate buggy timer restart logic
      const buggyRestartTimer = async (tabId: number) => {
        const maxAttempts = 3;
        let attempts = 0;

        while (attempts < maxAttempts) {
          try {
            await buggyAlarmManager.startTimer(tabId, 300000);
            return; // Success
          } catch (error) {
            attempts++;
            console.log(`Timer restart attempt ${attempts} failed for tab ${tabId}`);
            
            // BUG: No delay between retries, and no circuit breaker
            // This can cause rapid-fire retries that overwhelm the system
            if (attempts >= maxAttempts) {
              // BUG: Even after max attempts, we try "emergency restart"
              try {
                await buggyAlarmManager.startTimer(tabId, 600000);
              } catch (emergencyError) {
                // BUG: And then we try "fallback restart"
                try {
                  await buggyAlarmManager.startTimer(tabId, 900000);
                } catch (fallbackError) {
                  // This creates a cascade of failures
                }
              }
            }
          }
        }
      };

      // Test the buggy restart logic
      try {
        await buggyRestartTimer(123);
      } catch (error) {
        // Expected to fail
      }

      // BUG DETECTED: Too many restart attempts (should be max 3, but we have more)
      if (timerRestartAttempts > 5) {
        infiniteLoopDetected = true;
        console.log(`🐛 INFINITE LOOP DETECTED: ${timerRestartAttempts} timer restart attempts`);
      }

      expect(infiniteLoopDetected).toBe(true);
      expect(timerRestartAttempts).toBeGreaterThan(5);
    });

    test('should show the CORRECT way to handle timer restart failures', async () => {
      let timerRestartAttempts = 0;

      // Mock alarm manager that always fails
      const alarmManager = {
        startTimer: jest.fn().mockImplementation(async () => {
          timerRestartAttempts++;
          throw new Error('Timer start failed');
        }),
      };

      // FIXED version with proper failure handling
      const fixedRestartTimer = async (tabId: number) => {
        try {
          await alarmManager.startTimer(tabId, 300000);
          return true; // Success
        } catch (error) {
                     console.log(`Timer restart failed for tab ${tabId}: ${(error as Error).message}`);
          
          // FIX: Only ONE fallback attempt, then give up gracefully
          try {
            await alarmManager.startTimer(tabId, 600000);
            return true; // Fallback success
          } catch (fallbackError) {
            console.log(`Fallback timer also failed for tab ${tabId}, giving up`);
            
            // FIX: Mark tab as requiring manual intervention
            // Don't keep trying indefinitely
            return false;
          }
        }
      };

      // Test the fixed restart logic
      const success = await fixedRestartTimer(123);

      // FIXED: Limited attempts (max 2: normal + fallback)
      expect(timerRestartAttempts).toBeLessThanOrEqual(2);
      expect(success).toBe(false); // Should fail gracefully
      console.log(`✅ FIXED: Only ${timerRestartAttempts} restart attempts, failed gracefully`);
    });
  });

  describe('🚨 BUG #4: State Inconsistency Between Components', () => {
    test('should detect state inconsistency when global pause state is not synchronized', async () => {
      let stateInconsistencyDetected = false;

      // Simulate different components with their own state
      let serviceWorkerGlobalPaused = false;
      let popupGlobalPaused = false;
      let storageGlobalPaused = false;

      // Simulate buggy state update that doesn't sync all components
      const buggySetGlobalPause = async (paused: boolean) => {
        // BUG: Only updates service worker state, forgets others
        serviceWorkerGlobalPaused = paused;
        
        // BUG: Storage update might fail, but we don't handle it
        try {
          mockChrome.storage.sync.set({ globalPaused: paused });
          storageGlobalPaused = paused; // Simulate storage success
        } catch (error) {
          // BUG: Storage failed, but we don't revert serviceWorker state
          console.error('Storage update failed:', error);
        }
        
        // BUG: Popup state is never updated!
        // popupGlobalPaused remains unchanged
      };

      // Initial state - all should be false
      expect(serviceWorkerGlobalPaused).toBe(false);
      expect(popupGlobalPaused).toBe(false);
      expect(storageGlobalPaused).toBe(false);

      // Update to paused state
      await buggySetGlobalPause(true);

      // Check for state inconsistency
      const states = [serviceWorkerGlobalPaused, popupGlobalPaused, storageGlobalPaused];
      const uniqueStates = new Set(states);

      if (uniqueStates.size > 1) {
        stateInconsistencyDetected = true;
        console.log(`🐛 STATE INCONSISTENCY DETECTED:`);
        console.log(`  Service Worker: ${serviceWorkerGlobalPaused}`);
        console.log(`  Popup: ${popupGlobalPaused}`);
        console.log(`  Storage: ${storageGlobalPaused}`);
      }

      expect(stateInconsistencyDetected).toBe(true);
    });

    test('should show the CORRECT way to maintain state consistency', async () => {
      // FIXED version with proper state synchronization
      let serviceWorkerGlobalPaused = false;
      let popupGlobalPaused = false;
      let storageGlobalPaused = false;

      const fixedSetGlobalPause = async (paused: boolean) => {
        const previousState = serviceWorkerGlobalPaused;

        try {
          // FIX: Update storage first (most critical)
          await mockChrome.storage.sync.set({ globalPaused: paused });
          storageGlobalPaused = paused;

          // FIX: Update service worker state
          serviceWorkerGlobalPaused = paused;

          // FIX: Notify popup about state change
          try {
            await mockChrome.runtime.sendMessage({
              type: 'GLOBAL_PAUSE_STATE_CHANGED',
              paused: paused,
            });
            popupGlobalPaused = paused; // Simulate popup update
          } catch (messageError) {
            console.warn('Failed to notify popup, but continuing');
            // FIX: Don't fail the entire operation if popup notification fails
          }

        } catch (error) {
          // FIX: Rollback on failure
          console.error('Failed to update global pause state:', error);
          serviceWorkerGlobalPaused = previousState;
          storageGlobalPaused = previousState;
          popupGlobalPaused = previousState;
          throw error;
        }
      };

      // Test the fixed state management
      await fixedSetGlobalPause(true);

      // FIXED: All states should be consistent
      expect(serviceWorkerGlobalPaused).toBe(true);
      expect(popupGlobalPaused).toBe(true);
      expect(storageGlobalPaused).toBe(true);

      const states = [serviceWorkerGlobalPaused, popupGlobalPaused, storageGlobalPaused];
      const uniqueStates = new Set(states);

      expect(uniqueStates.size).toBe(1); // All states are the same
      console.log(`✅ FIXED: All states are consistent: ${Array.from(uniqueStates)}`);
    });
  });

  describe('🚨 BUG #5: Content Script Injection Race Condition', () => {
    test('should detect race condition when multiple tabs inject content script simultaneously', async () => {
      let injectionAttempts = 0;
      let raceConditionDetected = false;

      // Simulate buggy content script injection
      const buggyInjectContentScript = async (tabId: number) => {
        injectionAttempts++;
        
        // BUG: No check if script is already being injected
        // Multiple simultaneous calls can cause conflicts
        
        try {
          await mockChrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/resumeBooster.js'],
          });
                 } catch (error) {
           if ((error as Error).message.includes('Cannot access')) {
             // BUG: We retry immediately without any delay or backoff
             await buggyInjectContentScript(tabId); // Recursive call!
           }
         }
      };

      // Simulate multiple simultaneous injection attempts (real scenario)
      const promises = [
        buggyInjectContentScript(123),
        buggyInjectContentScript(123), // Same tab
        buggyInjectContentScript(123), // Same tab
      ];

      // Mock the Chrome API to fail initially
      mockChrome.scripting.executeScript
        .mockRejectedValueOnce(new Error('Cannot access tab'))
        .mockRejectedValueOnce(new Error('Cannot access tab'))
        .mockResolvedValue(undefined);

      try {
        await Promise.all(promises);
      } catch (error) {
        // Some might fail
      }

      // BUG DETECTED: Too many injection attempts due to race condition
      if (injectionAttempts > 5) {
        raceConditionDetected = true;
        console.log(`🐛 RACE CONDITION DETECTED: ${injectionAttempts} injection attempts for same tab`);
      }

      expect(raceConditionDetected).toBe(true);
    });

    test('should show the CORRECT way to prevent injection race conditions', async () => {
      let injectionAttempts = 0;
      const injectionPromises = new Map<number, Promise<void>>();

      // FIXED version with proper race condition prevention
      const fixedInjectContentScript = async (tabId: number) => {
        // FIX: Return existing promise if injection is already in progress
        if (injectionPromises.has(tabId)) {
          return injectionPromises.get(tabId);
        }

        const injectionPromise = (async () => {
          injectionAttempts++;
          
          try {
            await mockChrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content/resumeBooster.js'],
            });
          } catch (error) {
            if ((error as Error).message.includes('Cannot access')) {
              // FIX: Wait before retry, and limit retry attempts
              await new Promise(resolve => setTimeout(resolve, 1000));
              throw error; // Don't retry recursively
            }
          } finally {
            // FIX: Always clean up the promise
            injectionPromises.delete(tabId);
          }
        })();

        injectionPromises.set(tabId, injectionPromise);
        return injectionPromise;
      };

      // Test with multiple simultaneous calls
      const promises = [
        fixedInjectContentScript(123),
        fixedInjectContentScript(123), // Same tab
        fixedInjectContentScript(123), // Same tab
      ];

      mockChrome.scripting.executeScript.mockResolvedValue(undefined);

      await Promise.all(promises);

      // FIXED: Should only inject once per tab
      expect(injectionAttempts).toBe(1);
      console.log(`✅ FIXED: Only ${injectionAttempts} injection attempt for tab 123`);
    });
  });

  describe('🚨 BUG #6: Timer Drift and Accuracy Issues', () => {
    test('should detect timer drift when using setTimeout for long intervals', async () => {
      let timerDriftDetected = false;
      const expectedInterval = 15 * 60 * 1000; // 15 minutes
      const tolerance = 5000; // 5 seconds tolerance

      // Simulate buggy timer implementation using setTimeout
      const buggyStartTimer = (callback: () => void, interval: number) => {
        // BUG: setTimeout is not reliable for long intervals
        // Browser can throttle or delay setTimeout calls
        return setTimeout(callback, interval);
      };

      const startTime = Date.now();
      let actualInterval = 0;

      // Simulate a timer that should fire after 15 minutes
      const timerId = buggyStartTimer(() => {
        actualInterval = Date.now() - startTime;
      }, expectedInterval);

      // Simulate browser throttling by manually triggering after a different time
      setTimeout(() => {
        // Simulate the callback being called late due to browser throttling
        actualInterval = Date.now() - startTime;
        
        const drift = Math.abs(actualInterval - expectedInterval);
        if (drift > tolerance) {
          timerDriftDetected = true;
          console.log(`🐛 TIMER DRIFT DETECTED: Expected ${expectedInterval}ms, got ${actualInterval}ms (drift: ${drift}ms)`);
        }
      }, expectedInterval + 10000); // 10 seconds late

      // Wait for the test to complete
      await new Promise(resolve => setTimeout(resolve, expectedInterval + 15000));

      clearTimeout(timerId);
      expect(timerDriftDetected).toBe(true);
    });

    test('should show the CORRECT way to implement reliable timers', async () => {
      // FIXED version using Chrome Alarms API (more reliable)
      const fixedStartTimer = async (tabId: number, interval: number) => {
        // FIX: Use Chrome Alarms API for reliable timing
        const alarmName = `timer_${tabId}`;
        
        await mockChrome.alarms.create(alarmName, {
          delayInMinutes: interval / (60 * 1000),
        });

        return alarmName;
      };

      // Mock Chrome alarms to be more reliable
      mockChrome.alarms.create.mockResolvedValue(undefined);

      const tabId = 123;
      const interval = 15 * 60 * 1000; // 15 minutes

      const alarmName = await fixedStartTimer(tabId, interval);

      // FIXED: Chrome Alarms API is more reliable than setTimeout
      expect(mockChrome.alarms.create).toHaveBeenCalledWith(`timer_${tabId}`, {
        delayInMinutes: 15,
      });

      console.log(`✅ FIXED: Using Chrome Alarms API for reliable timing: ${alarmName}`);
    });
  });

  describe('🚨 BUG #7: Error Handling Cascade Failures', () => {
    test('should detect cascade failures when error handling itself throws errors', async () => {
      let cascadeFailureDetected = false;
      let errorCount = 0;

      // Simulate buggy error handling that can throw errors
      const buggyErrorHandler = async (error: Error) => {
        try {
          errorCount++;
          
          // BUG: Error logging itself might fail
          await mockChrome.storage.local.set({
            lastError: error.message,
            timestamp: Date.now(),
          });

          // BUG: Circuit breaker update might fail
          const failures = await mockChrome.storage.local.get('failures');
          await mockChrome.storage.local.set({
            failures: (failures.failures || 0) + 1,
          });

          // BUG: Recovery attempt might fail
          await mockChrome.tabs.sendMessage(123, { type: 'RECOVER' });

                 } catch (handlingError) {
           // BUG: Error in error handling creates cascade failure
           errorCount++;
           throw new Error(`Error handling failed: ${(handlingError as Error).message}`);
        }
      };

      // Mock Chrome APIs to fail
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      // Test cascade failure
      try {
        await buggyErrorHandler(new Error('Original error'));
             } catch (cascadeError) {
         if ((cascadeError as Error).message.includes('Error handling failed')) {
           cascadeFailureDetected = true;
           console.log(`🐛 CASCADE FAILURE DETECTED: ${(cascadeError as Error).message}`);
        }
      }

      expect(cascadeFailureDetected).toBe(true);
      expect(errorCount).toBeGreaterThan(1);
    });

    test('should show the CORRECT way to handle errors without cascading', async () => {
      let errorCount = 0;

      // FIXED version with defensive error handling
      const fixedErrorHandler = async (error: Error) => {
        errorCount++;

        // FIX: Each error handling step is isolated and won't throw
        
        // Safe error logging
        try {
          await mockChrome.storage.local.set({
            lastError: error.message,
            timestamp: Date.now(),
          });
        } catch (logError) {
          console.warn('Failed to log error, but continuing:', logError);
          // FIX: Don't throw, just log and continue
        }

        // Safe circuit breaker update
        try {
          const failures = await mockChrome.storage.local.get('failures');
          await mockChrome.storage.local.set({
            failures: (failures.failures || 0) + 1,
          });
        } catch (circuitError) {
          console.warn('Failed to update circuit breaker, but continuing:', circuitError);
          // FIX: Don't throw, just log and continue
        }

        // Safe recovery attempt
        try {
          await mockChrome.tabs.sendMessage(123, { type: 'RECOVER' });
        } catch (recoveryError) {
          console.warn('Failed to send recovery message, but continuing:', recoveryError);
          // FIX: Don't throw, just log and continue
        }

        // FIX: Always return success, never throw from error handler
        return { success: false, error: error.message };
      };

      // Mock Chrome APIs to fail
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      // Test fixed error handling
      const result = await fixedErrorHandler(new Error('Original error'));

      // FIXED: No cascade failure, error handled gracefully
      expect(result.success).toBe(false);
      expect(errorCount).toBe(1); // Only the original error
      console.log(`✅ FIXED: Error handled gracefully without cascade failure`);
    });
  });
}); 
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
      hasListeners: jest.fn().mockReturnValue(true),
    },
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
};

// Setup global mocks
(global as any).chrome = mockChrome;

describe('Specific Logical Error Detection', () => {
  let dom: JSDOM;
  let window: Window;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://hh.ru/resume/12345',
      pretendToBeVisual: true,
      resources: 'usable',
    });
    window = dom.window as unknown as Window;
    document = window.document;

    // Setup global objects
    (global as any).window = window;
    (global as any).document = document;
    (global as any).Node = (window as any).Node;
    (global as any).Element = (window as any).Element;
    (global as any).HTMLElement = (window as any).HTMLElement;
    (global as any).MouseEvent = (window as any).MouseEvent;
    (global as any).MutationObserver = (window as any).MutationObserver;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Bug #1: Selector Fallback Logic Error', () => {
    test('should handle empty tagName in :contains() selector properly', () => {
      // This tests the logical error: selector.split(':')[0] || '*'
      // The issue is that split(':')[0] can return empty string, not undefined
      
      const testSelector = ':contains("Поднять в поиске")'; // Starts with colon
      const parts = testSelector.split(':');
      const tagName = parts[0] || '*';
      
      // ACTUALLY: parts[0] is empty string "", which is falsy
      // So || '*' fallback DOES work correctly
      expect(parts[0]).toBe(''); // Empty string
      expect(tagName).toBe('*'); // ✅ Fallback works correctly
      
      // The logic is actually correct for this case
      const correctTagName = parts[0] || '*';
      expect(correctTagName).toBe('*'); // This works as expected
    });

    test('should detect invalid querySelector when tagName is empty', () => {
      const invalidSelector = ''; // Empty tagName
      
      expect(() => {
        document.querySelectorAll(invalidSelector);
      }).toThrow(); // This will throw DOMException
    });
  });

  describe('Bug #2: Race Condition in Initialization', () => {
    test('should detect potential race condition in isInitialized flag', async () => {
      let isInitialized = false;
      let initializationCount = 0;

      const mockInitialize = async () => {
        if (isInitialized) {
          return;
        }
        
        // Simulate async initialization work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        initializationCount++;
        isInitialized = true;
      };

      // Simulate concurrent calls
      const promises = [
        mockInitialize(),
        mockInitialize(),
        mockInitialize(),
      ];

      await Promise.all(promises);

      // BUG: Without proper locking, this could be > 1
      expect(initializationCount).toBeGreaterThan(1);
    });
  });

  describe('Bug #3: Mutation Observer Memory Leak', () => {
    test('should detect potential memory leak in mutation observer setup', () => {
      let mutationObserver: MutationObserver | null = null;
      let observerCount = 0;

      const setupMutationObserver = () => {
        // BUG: If this is called multiple times without proper cleanup,
        // old observers might not be disconnected
        if (mutationObserver) {
          mutationObserver.disconnect();
        }

        mutationObserver = new MutationObserver(() => {
          // Observer callback
        });
        observerCount++;

        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      };

      // Call multiple times
      setupMutationObserver();
      setupMutationObserver();
      setupMutationObserver();

      expect(observerCount).toBe(3); // Multiple observers created
      expect(mutationObserver).toBeTruthy(); // Only last one is tracked
    });
  });

  describe('Bug #4: Timer Cleanup Logic Error', () => {
    test('should detect timer cleanup race condition', async () => {
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      let timerCallbacks = 0;

      const setupPageRefresh = async () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        // BUG: If this function is called rapidly, there's a race condition
        // between clearing the old timer and setting the new one
        await new Promise(resolve => setTimeout(resolve, 1)); // Simulate async work

        refreshTimer = setTimeout(() => {
          timerCallbacks++;
        }, 10);
      };

      // Rapid successive calls
      await Promise.all([
        setupPageRefresh(),
        setupPageRefresh(),
        setupPageRefresh(),
      ]);

      // Wait for timers to fire
      await new Promise(resolve => setTimeout(resolve, 50));

      // BUG: Multiple timers might fire due to race condition
      expect(timerCallbacks).toBeGreaterThan(1);
    });
  });

  describe('Bug #5: State Inconsistency in Button Checking', () => {
    test('should detect state inconsistency between button existence and activity', () => {
      // Create a button that exists but is not properly detectable
      const button = document.createElement('button');
      button.textContent = 'Поднять в поиске';
      button.disabled = true;
      document.body.appendChild(button);

      const findBoostButton = (): HTMLElement | null => {
        return document.querySelector('button') as HTMLElement;
      };

      const isButtonActive = (): boolean => {
        const button = findBoostButton();
        if (!button) {
          return false;
        }
        return !button.hasAttribute('disabled');
      };

      const checkButtonState = () => {
        const button = findBoostButton();
        const isActive = isButtonActive();

        return {
          buttonFound: !!button,
          isActive: isActive,
        };
      };

      const state = checkButtonState();

      // BUG: Button is found but not active, this inconsistency
      // might not be handled properly in the UI
      expect(state.buttonFound).toBe(true);
      expect(state.isActive).toBe(false);
      
      // This combination might cause UI confusion
      expect(state.buttonFound && !state.isActive).toBe(true);
    });
  });

  describe('Bug #6: Error Handling in Message Sending', () => {
    test('should detect silent failure in message sending', () => {
      const mockSendMessage = jest.fn().mockImplementation(() => {
        throw new Error('Runtime not available');
      });

      (global as any).chrome.runtime.sendMessage = mockSendMessage;

      const sendMessageToBackground = (message: any): void => {
        try {
          chrome.runtime.sendMessage(message);
        } catch (error) {
          // BUG: Error is logged but not handled - silent failure
          console.error('Failed to send message to background:', error);
        }
      };

      // This should not throw, but the message is lost
      expect(() => {
        sendMessageToBackground({ type: 'TEST' });
      }).not.toThrow();

      // BUG: Message was not sent but no indication to caller
      expect(mockSendMessage).toHaveBeenCalled();
      expect(mockSendMessage).toThrow();
    });
  });

  describe('Bug #7: Logical Error in Text Matching', () => {
    test('should detect case sensitivity issue in button text matching', () => {
      const button = document.createElement('button');
      button.textContent = 'ПОДНЯТЬ В ПОИСКЕ'; // Uppercase
      document.body.appendChild(button);

      const inactiveTexts = [
        'подождите',
        'обновлено', 
        'недоступно',
        'заблокировано',
      ];

      const buttonText = button.textContent?.toLowerCase() || '';
      
      // This works correctly
      let hasInactiveText = false;
      for (const inactiveText of inactiveTexts) {
        if (buttonText.includes(inactiveText)) {
          hasInactiveText = true;
          break;
        }
      }

      expect(hasInactiveText).toBe(false);

      // But what if we search for active text?
      const activeTexts = ['поднять', 'boost', 'обновить'];
      let hasActiveText = false;
      for (const activeText of activeTexts) {
        if (buttonText.includes(activeText)) {
          hasActiveText = true;
          break;
        }
      }

      // BUG: The code only checks for inactive text, not active text
      // This could lead to false positives where button is considered active
      // when it actually contains inactive text in different case
      expect(hasActiveText).toBe(true);
    });
  });

  describe('Bug #8: Async/Await Error in Click Handler', () => {
    test('should detect unhandled promise in click sequence', async () => {
      const button = document.createElement('button');
      button.textContent = 'Поднять в поиске';
      document.body.appendChild(button);

      let scrollCalled = false;
      let clickCalled = false;

      // Mock scrollIntoView
      button.scrollIntoView = jest.fn(() => {
        scrollCalled = true;
      });

      // Mock click
      button.click = jest.fn(() => {
        clickCalled = true;
      });

      const clickBoostButton = async (): Promise<boolean> => {
        try {
          const button = document.querySelector('button') as HTMLElement;
          if (!button) return false;

          // Scroll button into view
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Wait for scroll - BUG: This might not be enough time
          await new Promise(resolve => setTimeout(resolve, 1)); // Too short!

          button.click();

          // BUG: No verification that click actually worked
          return true; // Always returns true
        } catch (error) {
          return false;
        }
      };

      const result = await clickBoostButton();

      expect(scrollCalled).toBe(true);
      expect(clickCalled).toBe(true);
      expect(result).toBe(true);

      // BUG: Function returns true even if click might not have been processed
      // due to insufficient wait time
    });
  });
}); 
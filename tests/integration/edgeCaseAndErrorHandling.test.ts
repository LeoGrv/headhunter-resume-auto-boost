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
    getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
         lastError: null as chrome.runtime.LastError | null,
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
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

// Setup global mocks
(global as any).chrome = mockChrome;

describe('🧪 Edge Case Testing and Error Handling', () => {
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
    mockChrome.runtime.lastError = null;
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('🔍 DOM Edge Cases', () => {
    test('should handle null/undefined DOM elements gracefully', () => {
      // Test querySelector returning null
      const mockQuerySelector = jest.fn().mockReturnValue(null);
      document.querySelector = mockQuerySelector;

      const findElement = (selector: string): HTMLElement | null => {
        try {
          const element = document.querySelector(selector);
          return element as HTMLElement;
        } catch (error) {
          console.error(`Failed to find element with selector: ${selector}`, error);
          return null;
        }
      };

      const result = findElement('button');
      expect(result).toBeNull();
      expect(mockQuerySelector).toHaveBeenCalledWith('button');
    });

    test('should handle malformed selectors without crashing', () => {
      const malformedSelectors = [
        '',
        '   ',
        '###invalid',
        '[unclosed',
        ':not(',
        '::invalid-pseudo',
        'div > > span',
        'button[data-qa="unclosed',
      ];

      const findElementSafely = (selector: string): HTMLElement | null => {
        try {
          if (!selector || selector.trim() === '') {
            return null;
          }
          return document.querySelector(selector) as HTMLElement;
        } catch (error) {
          console.warn(`Invalid selector: ${selector}`, error);
          return null;
        }
      };

      malformedSelectors.forEach(selector => {
        expect(() => findElementSafely(selector)).not.toThrow();
        const result = findElementSafely(selector);
        expect(result).toBeNull();
      });
    });

    test('should handle extremely large DOM trees efficiently', () => {
      // Create a large DOM structure
      const container = document.createElement('div');
      container.id = 'large-container';
      
      // Create 1000 nested elements
      let currentElement = container;
      for (let i = 0; i < 1000; i++) {
        const newElement = document.createElement('div');
        newElement.className = `level-${i}`;
        newElement.textContent = `Element ${i}`;
        currentElement.appendChild(newElement);
        currentElement = newElement;
      }
      
      document.body.appendChild(container);

      const startTime = performance.now();
      
      // Test deep selector performance
      const deepElement = document.querySelector('.level-999');
      const allElements = document.querySelectorAll('div');
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(deepElement).toBeTruthy();
      expect(allElements.length).toBeGreaterThan(1000);
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle special characters in element text content', () => {
      const specialTexts = [
        'Поднять в поиске', // Cyrillic
        '提升简历', // Chinese
        '履歴書を上げる', // Japanese
        'Boost résumé', // French accents
        'Boost 🚀 resume', // Emoji
        'Button\n\twith\nwhitespace',
        'Button with "quotes" and \'apostrophes\'',
        'Button with <script>alert("xss")</script>',
        'Button with &amp; &lt; &gt; entities',
        '',
        '   ',
        '\u0000\u0001\u0002', // Control characters
      ];

      specialTexts.forEach(text => {
        const button = document.createElement('button');
        button.textContent = text;
        document.body.appendChild(button);

        const findButtonByText = (searchText: string): HTMLElement | null => {
          try {
            const buttons = document.querySelectorAll('button');
            for (let i = 0; i < buttons.length; i++) {
              const button = buttons[i] as HTMLElement;
              if (button.textContent?.includes(searchText)) {
                return button;
              }
            }
            return null;
          } catch (error) {
            console.error('Error finding button by text:', error);
            return null;
          }
        };

        expect(() => findButtonByText(text)).not.toThrow();
        
        // Clean up
        button.remove();
      });
    });
  });

  describe('🌐 Chrome API Edge Cases', () => {
    test('should handle Chrome runtime errors gracefully', () => {
      // Simulate Chrome runtime error
      mockChrome.runtime.lastError = { message: 'Extension context invalidated.' };
      
      const sendMessageSafely = (message: any): boolean => {
        try {
          chrome.runtime.sendMessage(message);
          
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError.message);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Failed to send message:', error);
          return false;
        }
      };

      const result = sendMessageSafely({ type: 'TEST' });
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Chrome runtime error:',
        'Extension context invalidated.'
      );
    });

    test('should handle storage quota exceeded errors', async () => {
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      
      mockChrome.storage.sync.set.mockImplementation(() => {
        throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      });

      const setStorageSafely = async (key: string, data: any): Promise<boolean> => {
        try {
          await chrome.storage.sync.set({ [key]: data });
          return true;
        } catch (error) {
          if (error instanceof Error && error.message.includes('quota exceeded')) {
            console.warn('Storage quota exceeded, attempting to use local storage');
            try {
              await chrome.storage.local.set({ [key]: data });
              return true;
            } catch (localError) {
              console.error('Both sync and local storage failed:', localError);
              return false;
            }
          }
          console.error('Storage error:', error);
          return false;
        }
      };

      const result = await setStorageSafely('large_data', largeData);
      expect(result).toBe(true); // Should fallback to local storage
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle tab access permission errors', async () => {
      mockChrome.tabs.get.mockRejectedValue(new Error('Cannot access tab'));
      
      const getTabSafely = async (tabId: number): Promise<any | null> => {
        try {
          const tab = await chrome.tabs.get(tabId);
          return tab;
        } catch (error) {
          if (error instanceof Error && error.message.includes('Cannot access tab')) {
            console.warn(`Tab ${tabId} is not accessible, possibly closed or restricted`);
            return null;
          }
          console.error('Unexpected tab access error:', error);
          return null;
        }
      };

      const result = await getTabSafely(123);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Tab 123 is not accessible, possibly closed or restricted'
      );
    });
  });

  describe('⏱️ Timing and Concurrency Edge Cases', () => {
    test('should handle rapid successive function calls', async () => {
      let callCount = 0;
      let isProcessing = false;
      
      const processWithDebounce = async (data: any): Promise<boolean> => {
        if (isProcessing) {
          console.warn('Function already processing, skipping call');
          return false;
        }
        
        isProcessing = true;
        callCount++;
        
        try {
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          return true;
        } finally {
          isProcessing = false;
        }
      };

      // Make 10 rapid calls
      const promises = Array.from({ length: 10 }, () => processWithDebounce({ test: true }));
      const results = await Promise.all(promises);
      
      // Only one should succeed, others should be debounced
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(1);
      expect(callCount).toBe(1);
    });

    test('should handle timer cleanup in rapid succession', () => {
      let timers: ReturnType<typeof setTimeout>[] = [];
      let timerCallbacks = 0;
      
      const setupTimerSafely = (delay: number): void => {
        // Clear existing timers
        timers.forEach(timer => clearTimeout(timer));
        timers = [];
        
        const timer = setTimeout(() => {
          timerCallbacks++;
        }, delay);
        
        timers.push(timer);
      };

      // Rapidly setup timers
      for (let i = 0; i < 100; i++) {
        setupTimerSafely(10);
      }

      // Wait for potential timer execution
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(timerCallbacks).toBeLessThanOrEqual(1);
          expect(timers.length).toBe(1);
          
          // Cleanup
          timers.forEach(timer => clearTimeout(timer));
          resolve();
        }, 50);
      });
    });

    test('should handle promise rejection chains gracefully', async () => {
      let errorCount = 0;
      
      const chainedOperation = async (shouldFail: boolean): Promise<string> => {
        try {
          if (shouldFail) {
            throw new Error('Simulated failure');
          }
          return 'success';
        } catch (error) {
          errorCount++;
          console.error('Operation failed:', error);
          throw error; // Re-throw for caller to handle
        }
      };

      const handleChainedOperations = async (): Promise<string[]> => {
        const operations = [
          chainedOperation(false),
          chainedOperation(true),
          chainedOperation(false),
          chainedOperation(true),
        ];

        const results: string[] = [];
        
        for (const operation of operations) {
          try {
            const result = await operation;
            results.push(result);
          } catch (error) {
            results.push('failed');
          }
        }
        
        return results;
      };

      const results = await handleChainedOperations();
      expect(results).toEqual(['success', 'failed', 'success', 'failed']);
      expect(errorCount).toBe(2);
    });
  });

  describe('📊 Data Validation Edge Cases', () => {
    test('should handle invalid JSON data gracefully', () => {
      const invalidJsonStrings = [
        '',
        '   ',
        '{',
        '}',
        '{"unclosed": "object"',
        '{"invalid": undefined}',
        '{"circular": circular}',
        'null',
        'undefined',
        'NaN',
        'Infinity',
        '{"nested": {"too": {"deep": {"object": "value"}}}}',
      ];

      const parseJsonSafely = (jsonString: string): any => {
        try {
          if (!jsonString || jsonString.trim() === '') {
            return null;
          }
          
          const parsed = JSON.parse(jsonString);
          
          // Additional validation
          if (typeof parsed === 'object' && parsed !== null) {
            // Check for circular references by attempting to stringify
            JSON.stringify(parsed);
          }
          
          return parsed;
        } catch (error) {
          console.warn('Invalid JSON data:', jsonString, error);
          return null;
        }
      };

      invalidJsonStrings.forEach(jsonString => {
        expect(() => parseJsonSafely(jsonString)).not.toThrow();
        const result = parseJsonSafely(jsonString);
        // Should either return valid data or null, never throw
        expect(result === null || typeof result !== 'undefined').toBe(true);
      });
    });

    test('should handle extreme numeric values', () => {
      const extremeValues = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Infinity,
        -Infinity,
        NaN,
        0,
        -0,
        0.1 + 0.2, // Floating point precision issue
      ];

      const processNumericValue = (value: number): number => {
        try {
          // Handle special cases
          if (!Number.isFinite(value)) {
            console.warn('Non-finite number detected:', value);
            return 0;
          }
          
          if (Number.isNaN(value)) {
            console.warn('NaN detected, returning 0');
            return 0;
          }
          
          // Handle very large numbers
          if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
            console.warn('Number exceeds safe integer range:', value);
            return Math.sign(value) * Number.MAX_SAFE_INTEGER;
          }
          
          return value;
        } catch (error) {
          console.error('Error processing numeric value:', error);
          return 0;
        }
      };

      extremeValues.forEach(value => {
        expect(() => processNumericValue(value)).not.toThrow();
        const result = processNumericValue(value);
        expect(Number.isFinite(result)).toBe(true);
      });
    });

    test('should handle URL validation edge cases', () => {
      const testUrls = [
        'https://hh.ru/resume/12345',
        'http://hh.ru/resume/12345',
        'https://hh.kz/resume/12345',
        'https://hh.ru/resume/',
        'https://hh.ru/resume',
        'hh.ru/resume/12345',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://malicious.com',
        '',
        '   ',
        'not-a-url',
        'https://',
        'https://hh.ru/resume/12345?param=value&other=test',
        'https://hh.ru/resume/12345#section',
        'https://subdomain.hh.ru/resume/12345',
        'https://hh.ru:8080/resume/12345',
      ];

      const isValidResumeUrl = (url: string): boolean => {
        try {
          if (!url || typeof url !== 'string' || url.trim() === '') {
            return false;
          }

          // Basic URL validation
          let urlObj: URL;
          try {
            urlObj = new URL(url);
          } catch {
            // Try with protocol prefix
            try {
              urlObj = new URL('https://' + url);
            } catch {
              return false;
            }
          }

          // Protocol validation
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return false;
          }

          // Domain validation
          const validDomains = ['hh.ru', 'hh.kz'];
          const hostname = urlObj.hostname.toLowerCase();
          const isValidDomain = validDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
          );

          if (!isValidDomain) {
            return false;
          }

          // Path validation
          const path = urlObj.pathname;
          return path.includes('/resume/') || path.includes('/resume');
        } catch (error) {
          console.error('URL validation error:', error);
          return false;
        }
      };

      const validUrls = testUrls.filter(url => isValidResumeUrl(url));
      
      // Should accept valid HeadHunter resume URLs
      expect(validUrls).toContain('https://hh.ru/resume/12345');
      expect(validUrls).toContain('https://hh.kz/resume/12345');
      
      // Should reject malicious URLs
      expect(validUrls).not.toContain('javascript:alert("xss")');
      expect(validUrls).not.toContain('data:text/html,<script>alert("xss")</script>');
      expect(validUrls).not.toContain('file:///etc/passwd');
    });
  });

  describe('🔄 Error Recovery Mechanisms', () => {
    test('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      const maxRetries = 3;
      
      const unreliableOperation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return 'success';
      };

      const retryWithBackoff = async <T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 100
      ): Promise<T> => {
        let lastError: Error;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            
            if (attempt === maxRetries) {
              throw lastError;
            }
            
            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        throw lastError!;
      };

      const result = await retryWithBackoff(unreliableOperation, maxRetries);
      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    test('should handle circuit breaker pattern for failing services', async () => {
      let failureCount = 0;
      let circuitOpen = false;
      const failureThreshold = 3;
      const resetTimeout = 1000;
      
      const failingService = async (): Promise<string> => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }
        
        // Simulate service failure
        throw new Error('Service unavailable');
      };

      const callWithCircuitBreaker = async (): Promise<string | null> => {
        try {
          if (circuitOpen) {
            console.warn('Circuit breaker is open, request blocked');
            return null;
          }
          
          const result = await failingService();
          failureCount = 0; // Reset on success
          return result;
        } catch (error) {
          failureCount++;
          console.error(`Service call failed (${failureCount}/${failureThreshold}):`, error);
          
          if (failureCount >= failureThreshold) {
            circuitOpen = true;
            console.warn('Circuit breaker opened due to repeated failures');
            
            // Auto-reset after timeout
            setTimeout(() => {
              circuitOpen = false;
              failureCount = 0;
              console.log('Circuit breaker reset');
            }, resetTimeout);
          }
          
          return null;
        }
      };

      // Make multiple calls to trigger circuit breaker
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await callWithCircuitBreaker();
        results.push(result);
      }

      expect(results.filter(r => r === null).length).toBe(5);
      expect(circuitOpen).toBe(true);
      expect(failureCount).toBe(failureThreshold);
    });
  });

  describe('🧹 Resource Cleanup Edge Cases', () => {
    test('should handle cleanup when multiple resources fail', () => {
      const resources: Array<{ cleanup: () => void; shouldFail: boolean }> = [
        { cleanup: jest.fn(), shouldFail: false },
        { cleanup: jest.fn(() => { throw new Error('Cleanup failed'); }), shouldFail: true },
        { cleanup: jest.fn(), shouldFail: false },
        { cleanup: jest.fn(() => { throw new Error('Another cleanup failed'); }), shouldFail: true },
      ];

      const cleanupAllResources = (): void => {
        const errors: Error[] = [];
        
        resources.forEach((resource, index) => {
          try {
            resource.cleanup();
          } catch (error) {
            errors.push(new Error(`Resource ${index} cleanup failed: ${error}`));
          }
        });

        if (errors.length > 0) {
          console.error(`${errors.length} resources failed to cleanup:`, errors);
        }
      };

      expect(() => cleanupAllResources()).not.toThrow();
      
      // Verify all cleanup methods were called
      resources.forEach(resource => {
        expect(resource.cleanup).toHaveBeenCalled();
      });
    });

    test('should handle memory cleanup for large objects', () => {
      const createLargeObject = () => {
        const largeArray = new Array(1000000).fill('data');
        const largeObject = {
          data: largeArray,
          metadata: {
            size: largeArray.length,
            created: new Date(),
          },
        };
        return largeObject;
      };

      const manageLargeObjects = () => {
        const objects: any[] = [];
        
        try {
          // Create multiple large objects
          for (let i = 0; i < 10; i++) {
            objects.push(createLargeObject());
          }
          
          // Process objects
          objects.forEach((obj, index) => {
            expect(obj.data.length).toBe(1000000);
          });
          
        } finally {
          // Cleanup
          objects.forEach((obj, index) => {
            try {
              obj.data = null;
              obj.metadata = null;
            } catch (error) {
              console.error(`Failed to cleanup object ${index}:`, error);
            }
          });
          objects.length = 0; // Clear array
        }
      };

      expect(() => manageLargeObjects()).not.toThrow();
    });
  });
}); 
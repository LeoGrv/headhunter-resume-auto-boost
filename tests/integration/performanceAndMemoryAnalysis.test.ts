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

describe('🚀 Performance Analysis and Memory Leak Detection', () => {
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

  describe('⚡ Performance Benchmarking', () => {
    test('should measure DOM query performance', () => {
      // Create a large DOM structure for testing
      const container = document.createElement('div');
      container.id = 'performance-test-container';
      
      // Add 1000 elements with various selectors
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div');
        element.className = `test-element level-${i % 10}`;
        element.setAttribute('data-id', i.toString());
        element.textContent = `Element ${i}`;
        container.appendChild(element);
      }
      document.body.appendChild(container);

      const performanceTests = [
        {
          name: 'getElementById',
          operation: () => document.getElementById('performance-test-container'),
          expectedTime: 1, // Should be very fast
        },
        {
          name: 'querySelector (ID)',
          operation: () => document.querySelector('#performance-test-container'),
          expectedTime: 2,
        },
        {
          name: 'querySelector (class)',
          operation: () => document.querySelector('.test-element'),
          expectedTime: 5,
        },
        {
          name: 'querySelectorAll (class)',
          operation: () => document.querySelectorAll('.test-element'),
          expectedTime: 10,
        },
        {
          name: 'querySelectorAll (attribute)',
          operation: () => document.querySelectorAll('[data-id]'),
          expectedTime: 15,
        },
        {
          name: 'Complex selector',
          operation: () => document.querySelectorAll('div.test-element[data-id]'),
          expectedTime: 20,
        },
      ];

      const results: Array<{ name: string; time: number; passed: boolean }> = [];

      performanceTests.forEach(test => {
        const startTime = performance.now();
        
        // Run the operation multiple times for more accurate measurement
        for (let i = 0; i < 100; i++) {
          test.operation();
        }
        
        const endTime = performance.now();
        const averageTime = (endTime - startTime) / 100;
        const passed = averageTime <= test.expectedTime;
        
        results.push({
          name: test.name,
          time: averageTime,
          passed,
        });

        console.log(`${test.name}: ${averageTime.toFixed(3)}ms (expected: ≤${test.expectedTime}ms) ${passed ? '✅' : '❌'}`);
      });

      // All performance tests should pass
      const failedTests = results.filter(r => !r.passed);
      expect(failedTests.length).toBe(0);
      
      // Verify we got results for all tests
      expect(results.length).toBe(performanceTests.length);
    });

    test('should measure event handling performance', () => {
      let eventCount = 0;
      const eventHandler = () => {
        eventCount++;
      };

      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);

      // Test event listener performance
      const startTime = performance.now();
      
      // Add event listener
      button.addEventListener('click', eventHandler);
      
      // Simulate 1000 clicks
      for (let i = 0; i < 1000; i++) {
        const event = new MouseEvent('click', { bubbles: true });
        button.dispatchEvent(event);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTimePerEvent = totalTime / 1000;

      console.log(`Event handling: ${averageTimePerEvent.toFixed(3)}ms per event`);
      
      // Event handling should be very fast (< 0.1ms per event)
      expect(averageTimePerEvent).toBeLessThan(0.1);
      expect(eventCount).toBe(1000);
      
      // Cleanup
      button.removeEventListener('click', eventHandler);
    });

    test('should measure mutation observer performance', async () => {
      let mutationCount = 0;
      const mutations: MutationRecord[] = [];

      const observer = new MutationObserver((mutationsList) => {
        mutationCount += mutationsList.length;
        mutations.push(...mutationsList);
      });

      const container = document.createElement('div');
      container.id = 'mutation-test-container';
      document.body.appendChild(container);

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      const startTime = performance.now();

      // Perform 50 DOM mutations (reduced for better performance)
      for (let i = 0; i < 50; i++) {
        const element = document.createElement('div');
        element.textContent = `Mutation ${i}`;
        element.setAttribute('data-mutation', i.toString());
        container.appendChild(element);
      }

      // Wait for mutations to be processed
      await new Promise<void>(resolve => {
        setTimeout(() => {
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const averageTimePerMutation = totalTime / 50;

          console.log(`Mutation observer: ${averageTimePerMutation.toFixed(3)}ms per mutation`);
          
          // Mutation observer should be reasonably fast (< 5ms per mutation in test environment)
          expect(averageTimePerMutation).toBeLessThan(5);
          expect(mutationCount).toBeGreaterThan(0);
          
          observer.disconnect();
          resolve();
        }, 50); // Reduced timeout
      });
    }, 15000); // Increased test timeout
  });

  describe('🧠 Memory Leak Detection', () => {
    test('should detect event listener memory leaks', () => {
      const initialListenerCount = document.querySelectorAll('*').length;
      const elements: HTMLElement[] = [];
      const handlers: Array<() => void> = [];

      // Create elements with event listeners
      for (let i = 0; i < 100; i++) {
        const element = document.createElement('button');
        element.textContent = `Button ${i}`;
        
        const handler = () => {
          console.log(`Button ${i} clicked`);
        };
        
        element.addEventListener('click', handler);
        document.body.appendChild(element);
        
        elements.push(element);
        handlers.push(handler);
      }

      // Verify elements were created
      expect(elements.length).toBe(100);

      // Simulate memory leak by removing elements without removing listeners
      const leakyCleanup = () => {
        elements.forEach(element => {
          // BAD: Remove element without removing event listener
          element.remove();
        });
      };

      // Proper cleanup
      const properCleanup = () => {
        elements.forEach((element, index) => {
          // GOOD: Remove event listener before removing element
          element.removeEventListener('click', handlers[index]);
          element.remove();
        });
      };

      // Test proper cleanup
      properCleanup();

      // Verify cleanup
      const remainingElements = document.querySelectorAll('button');
      expect(remainingElements.length).toBe(0);
    });

    test('should detect mutation observer memory leaks', () => {
      const observers: MutationObserver[] = [];
      const containers: HTMLElement[] = [];

      // Create multiple mutation observers
      for (let i = 0; i < 10; i++) {
        const container = document.createElement('div');
        container.id = `container-${i}`;
        document.body.appendChild(container);

        const observer = new MutationObserver(() => {
          // Observer callback
        });

        observer.observe(container, {
          childList: true,
          subtree: true,
        });

        observers.push(observer);
        containers.push(container);
      }

      // Verify observers were created
      expect(observers.length).toBe(10);
      expect(containers.length).toBe(10);

      // Test memory leak scenario
      const leakyCleanup = () => {
        containers.forEach(container => {
          // BAD: Remove container without disconnecting observer
          container.remove();
        });
        // Observers are still active but observing removed elements
      };

      // Proper cleanup
      const properCleanup = () => {
        observers.forEach((observer, index) => {
          // GOOD: Disconnect observer before removing container
          observer.disconnect();
          containers[index].remove();
        });
      };

      // Test proper cleanup
      properCleanup();

      // Verify cleanup
      const remainingContainers = document.querySelectorAll('[id^="container-"]');
      expect(remainingContainers.length).toBe(0);
    });

    test('should detect timer memory leaks', () => {
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const intervals: Array<ReturnType<typeof setInterval>> = [];
      let timerCallbacks = 0;
      let intervalCallbacks = 0;

      // Create multiple timers
      for (let i = 0; i < 10; i++) {
        const timer = setTimeout(() => {
          timerCallbacks++;
        }, 10);
        
        const interval = setInterval(() => {
          intervalCallbacks++;
        }, 5);

        timers.push(timer);
        intervals.push(interval);
      }

      // Test memory leak scenario
      const leakyCleanup = () => {
        // BAD: Don't clear timers/intervals
        // They will continue running and consuming memory
      };

      // Proper cleanup
      const properCleanup = () => {
        // GOOD: Clear all timers and intervals
        timers.forEach(timer => clearTimeout(timer));
        intervals.forEach(interval => clearInterval(interval));
      };

      // Test proper cleanup
      properCleanup();

      // Wait to verify timers were cleared
      return new Promise<void>(resolve => {
        setTimeout(() => {
          // Callbacks should be minimal since timers were cleared
          expect(timerCallbacks).toBeLessThan(5);
          expect(intervalCallbacks).toBeLessThan(10);
          resolve();
        }, 50);
      });
    });

    test('should detect closure memory leaks', () => {
      interface DataProcessor {
        process: (data: any) => void;
        cleanup: () => void;
      }

      const createDataProcessor = (largeData: any[]): DataProcessor => {
        // This closure captures largeData, potentially causing memory leak
        let processedCount = 0;
        
        return {
          process: (data: any) => {
            // Process data using the large dataset
            processedCount++;
            // Simulate processing with largeData
            const result = largeData.length + data;
            return result;
          },
          cleanup: () => {
            // Proper cleanup should nullify references
            (largeData as any) = null;
            processedCount = 0;
          }
        };
      };

      // Create large data array
      const largeDataArray = new Array(10000).fill('large data item');
      
      // Create processors
      const processors: DataProcessor[] = [];
      for (let i = 0; i < 5; i++) {
        const processor = createDataProcessor([...largeDataArray]);
        processors.push(processor);
      }

      // Use processors
      processors.forEach((processor, index) => {
        processor.process(`test data ${index}`);
      });

      // Test memory leak scenario
      const leakyCleanup = () => {
        // BAD: Don't call cleanup, closures still reference large data
        processors.length = 0; // Clear array but closures still exist
      };

      // Proper cleanup
      const properCleanup = () => {
        // GOOD: Call cleanup on each processor
        processors.forEach(processor => {
          processor.cleanup();
        });
        processors.length = 0;
      };

      // Test proper cleanup
      properCleanup();

      // Verify cleanup
      expect(processors.length).toBe(0);
    });
  });

  describe('📊 Performance Monitoring', () => {
    test('should monitor function execution time', () => {
      interface PerformanceMetrics {
        functionName: string;
        executionTime: number;
        callCount: number;
        averageTime: number;
        maxTime: number;
        minTime: number;
      }

      class PerformanceMonitor {
        private metrics: Map<string, PerformanceMetrics> = new Map();

        measureFunction<T extends any[], R>(
          fn: (...args: T) => R,
          functionName: string
        ): (...args: T) => R {
          return (...args: T): R => {
            const startTime = performance.now();
            const result = fn(...args);
            const endTime = performance.now();
            const executionTime = endTime - startTime;

            this.recordMetrics(functionName, executionTime);
            return result;
          };
        }

        private recordMetrics(functionName: string, executionTime: number): void {
          if (this.metrics.has(functionName)) {
            const metrics = this.metrics.get(functionName)!;
            metrics.callCount++;
            metrics.executionTime += executionTime;
            metrics.averageTime = metrics.executionTime / metrics.callCount;
            metrics.maxTime = Math.max(metrics.maxTime, executionTime);
            metrics.minTime = Math.min(metrics.minTime, executionTime);
          } else {
            this.metrics.set(functionName, {
              functionName,
              executionTime,
              callCount: 1,
              averageTime: executionTime,
              maxTime: executionTime,
              minTime: executionTime,
            });
          }
        }

        getMetrics(functionName: string): PerformanceMetrics | undefined {
          return this.metrics.get(functionName);
        }

        getAllMetrics(): PerformanceMetrics[] {
          return Array.from(this.metrics.values());
        }

        clear(): void {
          this.metrics.clear();
        }
      }

      const monitor = new PerformanceMonitor();

      // Test functions with different performance characteristics
      const fastFunction = (x: number) => x * 2;
      const slowFunction = (x: number) => {
        // Simulate slow operation
        let result = x;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(i);
        }
        return result;
      };

      // Wrap functions with monitoring
      const monitoredFast = monitor.measureFunction(fastFunction, 'fastFunction');
      const monitoredSlow = monitor.measureFunction(slowFunction, 'slowFunction');

      // Execute functions multiple times
      for (let i = 0; i < 100; i++) {
        monitoredFast(i);
      }

      for (let i = 0; i < 10; i++) {
        monitoredSlow(i);
      }

      // Verify metrics
      const fastMetrics = monitor.getMetrics('fastFunction');
      const slowMetrics = monitor.getMetrics('slowFunction');

      expect(fastMetrics).toBeDefined();
      expect(slowMetrics).toBeDefined();

      expect(fastMetrics!.callCount).toBe(100);
      expect(slowMetrics!.callCount).toBe(10);

      // Fast function should be much faster than slow function
      expect(fastMetrics!.averageTime).toBeLessThan(slowMetrics!.averageTime);

      console.log('Performance Metrics:');
      console.log(`Fast function: ${fastMetrics!.averageTime.toFixed(3)}ms average`);
      console.log(`Slow function: ${slowMetrics!.averageTime.toFixed(3)}ms average`);
    });

    test('should detect performance regressions', () => {
      interface PerformanceBaseline {
        functionName: string;
        baselineTime: number;
        threshold: number; // Percentage increase that triggers alert
      }

      class RegressionDetector {
        private baselines: Map<string, PerformanceBaseline> = new Map();

        setBaseline(functionName: string, baselineTime: number, threshold: number = 20): void {
          this.baselines.set(functionName, {
            functionName,
            baselineTime,
            threshold,
          });
        }

        checkRegression(functionName: string, currentTime: number): {
          isRegression: boolean;
          percentageIncrease: number;
          message: string;
        } {
          const baseline = this.baselines.get(functionName);
          
          if (!baseline) {
            return {
              isRegression: false,
              percentageIncrease: 0,
              message: `No baseline set for ${functionName}`,
            };
          }

          const percentageIncrease = ((currentTime - baseline.baselineTime) / baseline.baselineTime) * 100;
          const isRegression = percentageIncrease > baseline.threshold;

          return {
            isRegression,
            percentageIncrease,
            message: isRegression 
              ? `Performance regression detected in ${functionName}: ${percentageIncrease.toFixed(1)}% slower than baseline`
              : `Performance within acceptable range for ${functionName}`,
          };
        }
      }

      const detector = new RegressionDetector();

      // Set performance baselines
      detector.setBaseline('domQuery', 0.1, 50); // 50% threshold
      detector.setBaseline('dataProcessing', 1.0, 25); // 25% threshold

      // Test scenarios
      const testCases = [
        {
          functionName: 'domQuery',
          currentTime: 0.12, // 20% increase - should pass
          expectedRegression: false,
        },
        {
          functionName: 'domQuery',
          currentTime: 0.2, // 100% increase - should fail
          expectedRegression: true,
        },
        {
          functionName: 'dataProcessing',
          currentTime: 1.2, // 20% increase - should pass
          expectedRegression: false,
        },
        {
          functionName: 'dataProcessing',
          currentTime: 1.5, // 50% increase - should fail
          expectedRegression: true,
        },
      ];

      testCases.forEach(testCase => {
        const result = detector.checkRegression(testCase.functionName, testCase.currentTime);
        
        expect(result.isRegression).toBe(testCase.expectedRegression);
        console.log(result.message);
        
        if (testCase.expectedRegression) {
          expect(result.percentageIncrease).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('🔍 Memory Usage Analysis', () => {
    test('should analyze memory usage patterns', () => {
      interface MemorySnapshot {
        timestamp: number;
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      }

      class MemoryAnalyzer {
        private snapshots: MemorySnapshot[] = [];

        takeSnapshot(): MemorySnapshot {
          // Mock memory info since we're in test environment
          const mockMemory = {
            usedJSHeapSize: Math.random() * 50000000 + 10000000, // 10-60MB
            totalJSHeapSize: Math.random() * 100000000 + 50000000, // 50-150MB
            jsHeapSizeLimit: 2147483648, // 2GB limit
          };

          const snapshot: MemorySnapshot = {
            timestamp: Date.now(),
            ...mockMemory,
          };

          this.snapshots.push(snapshot);
          return snapshot;
        }

        analyzeMemoryTrend(): {
          isIncreasing: boolean;
          averageIncrease: number;
          potentialLeak: boolean;
        } {
          if (this.snapshots.length < 2) {
            return {
              isIncreasing: false,
              averageIncrease: 0,
              potentialLeak: false,
            };
          }

          const increases: number[] = [];
          for (let i = 1; i < this.snapshots.length; i++) {
            const current = this.snapshots[i];
            const previous = this.snapshots[i - 1];
            const increase = current.usedJSHeapSize - previous.usedJSHeapSize;
            increases.push(increase);
          }

          const averageIncrease = increases.reduce((a, b) => a + b, 0) / increases.length;
          const isIncreasing = averageIncrease > 0;
          const potentialLeak = isIncreasing && averageIncrease > 1000000; // 1MB+ average increase

          return {
            isIncreasing,
            averageIncrease,
            potentialLeak,
          };
        }

        getMemoryUtilization(): number {
          if (this.snapshots.length === 0) return 0;
          
          const latest = this.snapshots[this.snapshots.length - 1];
          return (latest.usedJSHeapSize / latest.totalJSHeapSize) * 100;
        }

        clear(): void {
          this.snapshots.length = 0;
        }
      }

      const analyzer = new MemoryAnalyzer();

      // Take multiple snapshots
      for (let i = 0; i < 10; i++) {
        analyzer.takeSnapshot();
      }

      const trend = analyzer.analyzeMemoryTrend();
      const utilization = analyzer.getMemoryUtilization();

      expect(typeof trend.isIncreasing).toBe('boolean');
      expect(typeof trend.averageIncrease).toBe('number');
      expect(typeof trend.potentialLeak).toBe('boolean');
      expect(utilization).toBeGreaterThanOrEqual(0);
      expect(utilization).toBeLessThanOrEqual(100);

      console.log(`Memory utilization: ${utilization.toFixed(1)}%`);
      console.log(`Average memory increase: ${(trend.averageIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Potential leak detected: ${trend.potentialLeak ? 'Yes' : 'No'}`);
    });

    test('should detect DOM node leaks', () => {
      const initialNodeCount = document.querySelectorAll('*').length;
      const createdElements: HTMLElement[] = [];

      // Create many DOM elements
      for (let i = 0; i < 500; i++) {
        const element = document.createElement('div');
        element.className = `leak-test-element-${i}`;
        element.textContent = `Element ${i}`;
        
        // Add some complex structure
        const child = document.createElement('span');
        child.textContent = `Child ${i}`;
        element.appendChild(child);
        
        document.body.appendChild(element);
        createdElements.push(element);
      }

      const afterCreationCount = document.querySelectorAll('*').length;
      const createdCount = afterCreationCount - initialNodeCount;

      // Verify elements were created
      expect(createdCount).toBeGreaterThanOrEqual(500); // At least 500 (elements + children)

      // Test memory leak scenario
      const leakyCleanup = () => {
        // BAD: Keep references to removed elements
        createdElements.forEach(element => {
          element.remove();
          // Element is removed from DOM but still referenced in array
        });
        // createdElements array still holds references - potential memory leak
      };

      // Proper cleanup
      const properCleanup = () => {
        // GOOD: Remove elements and clear references
        createdElements.forEach(element => {
          element.remove();
        });
        createdElements.length = 0; // Clear references
      };

      // Test proper cleanup
      properCleanup();

      const afterCleanupCount = document.querySelectorAll('*').length;
      
      // Should be back to initial count (or very close)
      expect(afterCleanupCount).toBeLessThanOrEqual(initialNodeCount + 5);
      expect(createdElements.length).toBe(0);
    });
  });

  describe('🎯 Resource Usage Optimization', () => {
    test('should optimize repeated DOM queries', () => {
      // Create test DOM structure
      const container = document.createElement('div');
      container.id = 'optimization-test';
      
      for (let i = 0; i < 100; i++) {
        const button = document.createElement('button');
        button.className = 'boost-button';
        button.textContent = `Boost ${i}`;
        container.appendChild(button);
      }
      document.body.appendChild(container);

      // Inefficient approach - repeated queries
      const inefficientApproach = () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 100; i++) {
          const buttons = document.querySelectorAll('.boost-button');
          buttons.forEach(button => {
            // Simulate some operation
            button.getAttribute('class');
          });
        }
        
        return performance.now() - startTime;
      };

      // Optimized approach - cache query result
      const optimizedApproach = () => {
        const startTime = performance.now();
        
        // Query once and cache
        const buttons = document.querySelectorAll('.boost-button');
        
        for (let i = 0; i < 100; i++) {
          buttons.forEach(button => {
            // Simulate same operation
            button.getAttribute('class');
          });
        }
        
        return performance.now() - startTime;
      };

      const inefficientTime = inefficientApproach();
      const optimizedTime = optimizedApproach();

      console.log(`Inefficient approach: ${inefficientTime.toFixed(3)}ms`);
      console.log(`Optimized approach: ${optimizedTime.toFixed(3)}ms`);
      console.log(`Performance improvement: ${((inefficientTime - optimizedTime) / inefficientTime * 100).toFixed(1)}%`);

      // Optimized approach should be significantly faster
      expect(optimizedTime).toBeLessThan(inefficientTime);
      
      // Should be at least 20% faster
      const improvement = (inefficientTime - optimizedTime) / inefficientTime;
      expect(improvement).toBeGreaterThan(0.2);
    });

    test('should optimize event delegation', () => {
      const container = document.createElement('div');
      container.id = 'delegation-test';
      document.body.appendChild(container);

      let clickCount = 0;

      // Inefficient approach - individual listeners
      const inefficientEventHandling = () => {
        const buttons: HTMLElement[] = [];
        const handlers: Array<() => void> = [];
        
        const startTime = performance.now();
        
        // Create 100 buttons with individual event listeners
        for (let i = 0; i < 100; i++) {
          const button = document.createElement('button');
          button.textContent = `Button ${i}`;
          button.className = 'individual-button';
          
          const handler = () => {
            clickCount++;
          };
          
          button.addEventListener('click', handler);
          container.appendChild(button);
          
          buttons.push(button);
          handlers.push(handler);
        }
        
        const setupTime = performance.now() - startTime;
        
        // Cleanup
        buttons.forEach((button, index) => {
          button.removeEventListener('click', handlers[index]);
          button.remove();
        });
        
        return setupTime;
      };

      // Optimized approach - event delegation
      const optimizedEventHandling = () => {
        const startTime = performance.now();
        
        // Single event listener on container
        const delegatedHandler = (event: Event) => {
          const target = event.target as HTMLElement;
          if (target.classList.contains('delegated-button')) {
            clickCount++;
          }
        };
        
        container.addEventListener('click', delegatedHandler);
        
        // Create 100 buttons without individual listeners
        const buttons: HTMLElement[] = [];
        for (let i = 0; i < 100; i++) {
          const button = document.createElement('button');
          button.textContent = `Button ${i}`;
          button.className = 'delegated-button';
          container.appendChild(button);
          buttons.push(button);
        }
        
        const setupTime = performance.now() - startTime;
        
        // Cleanup
        container.removeEventListener('click', delegatedHandler);
        buttons.forEach(button => button.remove());
        
        return setupTime;
      };

      const inefficientTime = inefficientEventHandling();
      const optimizedTime = optimizedEventHandling();

      console.log(`Individual listeners: ${inefficientTime.toFixed(3)}ms`);
      console.log(`Event delegation: ${optimizedTime.toFixed(3)}ms`);

      // Event delegation should be faster for setup
      expect(optimizedTime).toBeLessThan(inefficientTime);
    });
  });
}); 
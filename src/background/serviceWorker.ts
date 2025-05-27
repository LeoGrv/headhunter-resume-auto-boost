/**
 * HeadHunter Resume Auto-Boost Extension - Service Worker
 *
 * This is the main background script that handles all core functionality:
 * - Timer management for automatic resume boosting
 * - Tab detection and management for HeadHunter resume pages
 * - Communication between popup and content scripts
 * - State persistence using Chrome Storage API
 * - Error handling and recovery mechanisms
 * - Performance optimization and caching
 * - Comprehensive testing framework
 *
 * Architecture Overview:
 * ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 * │     Popup       │◄──►│ Service Worker  │◄──►│ Content Script  │
 * │   (UI Control)  │    │ (Core Logic)    │    │ (Button Click)  │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 *                               │
 *                        ┌─────────────────┐
 *                        │ Chrome Storage  │
 *                        │ (Persistence)   │
 *                        └─────────────────┘
 *
 * Key Components:
 * - PersistentAlarmManager: Handles Chrome Alarms API for reliable timers
 * - CircuitBreaker: Prevents repeated failures from overwhelming the system
 * - ErrorRecoverySystem: Automatically recovers from various error conditions
 * - PerformanceOptimizer: Caching and debouncing for better performance
 * - BatchOperationsManager: Groups operations for efficient processing
 * - TestingFramework: Runtime validation and system health checks
 *
 * @version 1.0.0
 * @author HeadHunter Resume Auto-Boost Team
 * @since 2024
 */

import { initializeStorage, getSettings, addLogEntry } from '../utils/storage';
import {
  initializeTabManager,
  updateTabList,
  getManagedTabsSync,
  updateTabState,
} from '../utils/tabManager';
import { persistentAlarmManager } from '../utils/persistentAlarmManager';
import {
  TabState,
  TabInfo,
  BackgroundMessage,
  ContentMessage,
} from '../utils/types';

console.log('HeadHunter Resume Auto-Boost Extension: Service Worker loaded');

// Extension state
let isInitialized = false;
let globalPaused = false;

// ✅ CRITICAL: Prevent concurrent processing of the same tab in Service Worker
const processingTabs = new Set<number>();

/**
 * Check if URL is a valid HeadHunter resume URL
 * Uses the same logic as tabManager for consistency
 */
function isValidResumeUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  const hasHttps = url.startsWith('https://');
  const hasHttp = url.startsWith('http://');
  const hasHhKz = url.includes('hh.kz/resume/');
  const hasHhRu = url.includes('hh.ru/resume/');

  return (hasHhKz || hasHhRu) && (hasHttps || hasHttp);
}

/**
 * Ensure content script is injected into the tab
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    // First, check if content script is already loaded
    try {
      const testResponse = await chrome.tabs.sendMessage(tabId, { type: 'TEST_MESSAGE' });
      if (testResponse) {
        console.log(`✅ Content script already loaded in tab ${tabId}`);
        return true;
      }
    } catch (error) {
      // Content script not loaded, proceed with injection
    }

    // Check if tab still exists and is valid
    const tabInfo = await chrome.tabs.get(tabId);
    if (!tabInfo || !tabInfo.url || !isValidResumeUrl(tabInfo.url)) {
      console.warn(`❌ Tab ${tabId} is not a valid resume tab for injection`);
      return false;
    }

    console.log(`🔄 Injecting content script into tab ${tabId}`);
    
    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/resumeBooster.js'],
    });

    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test if injection was successful
    try {
      const testResponse = await chrome.tabs.sendMessage(tabId, { type: 'TEST_MESSAGE' });
      if (testResponse) {
        console.log(`✅ Content script successfully injected into tab ${tabId}`);
        return true;
      }
    } catch (error) {
      console.warn(`❌ Content script injection test failed for tab ${tabId}:`, error);
      return false;
    }

    return false;
  } catch (error) {
    console.error(`❌ Failed to inject content script into tab ${tabId}:`, error);
    return false;
  }
}

/**
 * Send message to content script with retry mechanism
 */
async function sendMessageWithRetry(
  tabId: number,
  message: BackgroundMessage,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<ContentMessage> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Only log first and last attempts to reduce noise
      if (attempt === 1 || attempt === maxRetries) {
        console.log(`📤 Sending ${message.type} to tab ${tabId} (attempt ${attempt}/${maxRetries})`);
      }

      // Check if tab still exists before sending message
      const tabInfo = await chrome.tabs.get(tabId);
      if (!tabInfo || !tabInfo.url || !isValidResumeUrl(tabInfo.url)) {
        throw new Error(`Tab ${tabId} is no longer a valid resume tab`);
      }

      // Ensure content script is injected before sending message
      if (attempt === 1) {
        const injected = await ensureContentScriptInjected(tabId);
        if (!injected) {
          throw new Error(`Failed to inject content script into tab ${tabId}`);
        }
      }

      const response = (await chrome.tabs.sendMessage(
        tabId,
        message
      )) as ContentMessage;
      
      if (attempt > 1) {
        console.log(`✅ Message sent successfully to tab ${tabId} on attempt ${attempt}`);
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Only log warnings for retries, not every attempt
      if (attempt === maxRetries) {
        console.warn(`❌ All attempts failed for tab ${tabId}:`, error);
      }

      // If this is the last attempt, don't wait
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retry (exponential backoff)
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Try to inject content script again before retry
      try {
        await ensureContentScriptInjected(tabId);
      } catch (injectionError) {
        // Silent retry injection - only log if it's the last attempt
        if (attempt === maxRetries - 1) {
          console.log(`⚠️ Content script re-injection failed for tab ${tabId}`);
        }
      }
    }
  }

  // All retries failed
  throw (
    lastError ||
    new Error(
      `Failed to send message to tab ${tabId} after ${maxRetries} attempts`
    )
  );
}

/**
 * Circuit Breaker for error handling
 */
class CircuitBreaker {
  private failures: Map<number, number> = new Map();
  private lastFailureTime: Map<number, number> = new Map();
  private readonly maxFailures = 5;
  private readonly resetTimeMs = 30 * 60 * 1000; // 30 minutes

  isOpen(tabId: number): boolean {
    const failures = this.failures.get(tabId) || 0;
    const lastFailure = this.lastFailureTime.get(tabId) || 0;

    if (failures >= this.maxFailures) {
      const timeSinceLastFailure = Date.now() - lastFailure;
      if (timeSinceLastFailure < this.resetTimeMs) {
        return true; // Circuit is open
      } else {
        // Reset circuit breaker
        this.failures.set(tabId, 0);
        this.lastFailureTime.delete(tabId);
        return false;
      }
    }

    return false;
  }

  recordFailure(tabId: number): void {
    const currentFailures = this.failures.get(tabId) || 0;
    this.failures.set(tabId, currentFailures + 1);
    this.lastFailureTime.set(tabId, Date.now());

    // Only log when circuit opens (reaches max failures)
    if (currentFailures + 1 >= this.maxFailures) {
      console.log(`🔴 Circuit breaker OPENED for tab ${tabId} (${currentFailures + 1} failures)`);
    }
  }

  recordSuccess(tabId: number): void {
    const hadFailures = (this.failures.get(tabId) || 0) > 0;
    this.failures.set(tabId, 0);
    this.lastFailureTime.delete(tabId);
    
    // Only log if there were previous failures
    if (hadFailures) {
      console.log(`🟢 Circuit breaker reset for tab ${tabId}`);
    }
  }

  getStatus(tabId: number): {
    failures: number;
    isOpen: boolean;
    timeToReset?: number;
  } {
    const failures = this.failures.get(tabId) || 0;
    const isOpen = this.isOpen(tabId);
    const lastFailure = this.lastFailureTime.get(tabId);

    const result: { failures: number; isOpen: boolean; timeToReset?: number } =
      {
        failures,
        isOpen,
      };

    if (isOpen && lastFailure) {
      result.timeToReset = this.resetTimeMs - (Date.now() - lastFailure);
    }

    return result;
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker();

/**
 * Enhanced error recovery system
 */
class ErrorRecoverySystem {
  private recoveryAttempts: Map<number, number> = new Map();
  private readonly maxRecoveryAttempts = 3;

  async attemptRecovery(tabId: number, error: Error): Promise<boolean> {
    const attempts = this.recoveryAttempts.get(tabId) || 0;

    if (attempts >= this.maxRecoveryAttempts) {
      console.log(`❌ Max recovery attempts reached for tab ${tabId}`);
      return false;
    }

    this.recoveryAttempts.set(tabId, attempts + 1);
    console.log(`🔄 Recovery attempt ${attempts + 1}/${this.maxRecoveryAttempts} for tab ${tabId}`);

    try {
      // ✅ НОВОЕ: Специальная обработка ошибок разрешений
      const errorMessage = error.message;
      const isPermissionError = errorMessage.includes('Cannot access contents of the page') || 
                               errorMessage.includes('Extension manifest must request permission');
      
      if (isPermissionError) {
        console.log(`🔒 Permission error detected for tab ${tabId}, attempting reload...`);
        
        // Проверяем состояние вкладки
        const tabInfo = await chrome.tabs.get(tabId);
        if (!tabInfo || !tabInfo.url) {
          await this.cleanupTab(tabId);
          return false;
        }
        
        // Проверяем валидность URL
        if (!isValidResumeUrl(tabInfo.url)) {
          await this.cleanupTab(tabId);
          return false;
        }
        
        // Ждём полной загрузки вкладки
        if (tabInfo.status !== 'complete') {
          let waitAttempts = 0;
          while (waitAttempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const updatedTab = await chrome.tabs.get(tabId);
            if (updatedTab.status === 'complete') {
              break;
            }
            waitAttempts++;
          }
        }
        
        // Пробуем обновить вкладку для сброса состояния
        await chrome.tabs.reload(tabId);
        
        // Ждём загрузки после обновления
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Проверяем состояние после обновления
        const reloadedTab = await chrome.tabs.get(tabId);
        if (!reloadedTab.url || !isValidResumeUrl(reloadedTab.url)) {
          await this.cleanupTab(tabId);
          return false;
        }
        
        // Пробуем инъекцию после обновления
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/resumeBooster.js'],
        });
        
      } else {
        // Обычная recovery стратегия для других ошибок
        
        // Recovery strategy 1: Verify tab still exists
        const tabInfo = await chrome.tabs.get(tabId);
        if (!tabInfo || !tabInfo.url || !isValidResumeUrl(tabInfo.url)) {
          await this.cleanupTab(tabId);
          return false;
        }

        // Recovery strategy 2: Re-inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/resumeBooster.js'],
        });
      }

      // ✅ ИСПРАВЛЕНИЕ: Recovery с пользовательским интервалом
      const settings = await getSettings();
      const recoveryInterval = settings.clickInterval * 60 * 1000; // ✅ Тот же интервал
      await persistentAlarmManager.startTimer(tabId, recoveryInterval);

      console.log(`✅ Recovery successful for tab ${tabId}`);

      await addLogEntry({
        level: 'info',
        message: `Recovery successful for tab after ${attempts + 1} attempts`,
        tabId: tabId,
      });

      return true;
    } catch (recoveryError) {
      console.error(`❌ Recovery attempt ${attempts + 1} failed for tab ${tabId}:`, recoveryError);

      await addLogEntry({
        level: 'error',
        message: `Recovery attempt ${attempts + 1} failed: ${recoveryError}`,
        tabId: tabId,
      });

      return false;
    }
  }

  private async cleanupTab(tabId: number): Promise<void> {
    try {
      await updateTabState(tabId, TabState.REMOVED);
      await persistentAlarmManager.stopTimer(tabId);
      this.recoveryAttempts.delete(tabId);

      await addLogEntry({
        level: 'info',
        message: 'Tab cleaned up during recovery',
        tabId: tabId,
      });
    } catch (error) {
      console.error(`Failed to cleanup tab ${tabId}:`, error);
    }
  }

  resetRecoveryAttempts(tabId: number): void {
    this.recoveryAttempts.delete(tabId);
    console.log(`🔄 Recovery attempts reset for tab ${tabId}`);
  }

  getRecoveryStatus(tabId: number): { attempts: number; maxAttempts: number } {
    return {
      attempts: this.recoveryAttempts.get(tabId) || 0,
      maxAttempts: this.maxRecoveryAttempts,
    };
  }
}

// Global error recovery system
const errorRecoverySystem = new ErrorRecoverySystem();

/**
 * Performance optimization utilities
 */
class PerformanceOptimizer {
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private cache: Map<
    string,
    { data: unknown; timestamp: number; ttl: number }
  > = new Map();
  private readonly defaultCacheTtl = 5 * 60 * 1000; // 5 minutes

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        func(...args);
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, timer);
    };
  }

  /**
   * Cache data with TTL
   */
  setCache(
    key: string,
    data: unknown,
    ttl: number = this.defaultCacheTtl
  ): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get cached data if not expired
   */
  getCache(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    activeDebouncers: number;
    cacheSize: number;
    cacheHitRate?: number;
  } {
    return {
      activeDebouncers: this.debounceTimers.size,
      cacheSize: this.cache.size,
    };
  }
}

// Global performance optimizer
const performanceOptimizer = new PerformanceOptimizer();

/**
 * Batch operations manager for efficient processing
 */
class BatchOperationsManager {
  private batches: Map<
    string,
    {
      operations: Array<() => Promise<void>>;
      timer?: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private readonly batchDelay = 1000; // 1 second
  private readonly maxBatchSize = 10;

  /**
   * Add operation to batch
   */
  addToBatch(batchKey: string, operation: () => Promise<void>): void {
    let batch = this.batches.get(batchKey);

    if (!batch) {
      batch = { operations: [] };
      this.batches.set(batchKey, batch);
    }

    batch.operations.push(operation);

    // Clear existing timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Process batch if it reaches max size or set timer
    if (batch.operations.length >= this.maxBatchSize) {
      this.processBatch(batchKey);
    } else {
      batch.timer = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.batchDelay);
    }
  }

  /**
   * Process batch operations
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.operations.length === 0) return;

    console.log(
      `📦 Processing batch ${batchKey} with ${batch.operations.length} operations`
    );

    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Execute all operations in parallel
    const operations = batch.operations.splice(0); // Clear the array
    this.batches.delete(batchKey);

    try {
      await Promise.allSettled(operations.map(op => op()));
      console.log(`✅ Batch ${batchKey} processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing batch ${batchKey}:`, error);
    }
  }

  /**
   * Get batch metrics
   */
  getMetrics(): { activeBatches: number; totalPendingOperations: number } {
    let totalOperations = 0;
    for (const batch of this.batches.values()) {
      totalOperations += batch.operations.length;
    }

    return {
      activeBatches: this.batches.size,
      totalPendingOperations: totalOperations,
    };
  }
}

// Global batch operations manager
const batchOperationsManager = new BatchOperationsManager();

/**
 * Comprehensive Testing Framework for runtime validation
 */
class TestingFramework {
  private testResults: Map<
    string,
    { passed: number; failed: number; lastRun: number }
  > = new Map();
  private isTestingMode = false;

  /**
   * Enable testing mode
   */
  enableTestingMode(): void {
    this.isTestingMode = true;
    console.log('🧪 Testing mode enabled');
  }

  /**
   * Disable testing mode
   */
  disableTestingMode(): void {
    this.isTestingMode = false;
    console.log('🧪 Testing mode disabled');
  }

  /**
   * Run a test with automatic result tracking
   */
  async runTest(
    testName: string,
    testFunction: () => Promise<boolean>
  ): Promise<boolean> {
    if (!this.isTestingMode) return true;

    console.log(`🧪 Running test: ${testName}`);
    const startTime = Date.now();

    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.recordTestResult(testName, result);

      if (result) {
        console.log(`✅ Test passed: ${testName} (${duration}ms)`);
      } else {
        console.log(`❌ Test failed: ${testName} (${duration}ms)`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordTestResult(testName, false);
      console.error(`💥 Test error: ${testName} (${duration}ms):`, error);
      return false;
    }
  }

  /**
   * Record test result
   */
  private recordTestResult(testName: string, passed: boolean): void {
    const existing = this.testResults.get(testName) || {
      passed: 0,
      failed: 0,
      lastRun: 0,
    };

    if (passed) {
      existing.passed++;
    } else {
      existing.failed++;
    }

    existing.lastRun = Date.now();
    this.testResults.set(testName, existing);
  }

  /**
   * Get test results summary
   */
  getTestResults(): {
    [testName: string]: {
      passed: number;
      failed: number;
      lastRun: number;
      successRate: number;
    };
  } {
    const results: {
      [testName: string]: {
        passed: number;
        failed: number;
        lastRun: number;
        successRate: number;
      };
    } = {};

    for (const [testName, stats] of this.testResults.entries()) {
      const total = stats.passed + stats.failed;
      results[testName] = {
        ...stats,
        successRate: total > 0 ? (stats.passed / total) * 100 : 0,
      };
    }

    return results;
  }

  /**
   * Run comprehensive system tests
   */
  async runSystemTests(): Promise<{
    passed: number;
    failed: number;
    details: any[];
  }> {
    console.log('🧪 Running comprehensive system tests...');

    const tests = [
      { name: 'Timer Management', test: () => this.testTimerManagement() },
      { name: 'Tab Detection', test: () => this.testTabDetection() },
      { name: 'Circuit Breaker', test: () => this.testCircuitBreaker() },
      { name: 'Error Recovery', test: () => this.testErrorRecovery() },
      {
        name: 'Performance Optimization',
        test: () => this.testPerformanceOptimization(),
      },
      { name: 'State Persistence', test: () => this.testStatePersistence() },
      { name: 'Communication', test: () => this.testCommunication() },
    ];

    let passed = 0;
    let failed = 0;
    const details: any[] = [];

    for (const { name, test } of tests) {
      const result = await this.runTest(name, test);
      if (result) {
        passed++;
      } else {
        failed++;
      }

      details.push({
        name,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `🧪 System tests completed: ${passed} passed, ${failed} failed`
    );

    return { passed, failed, details };
  }

  /**
   * Test timer management functionality
   */
  private async testTimerManagement(): Promise<boolean> {
    try {
      // Test timer creation
      const testTabId = 99999;
      const testInterval = 5000; // 5 seconds

      await persistentAlarmManager.startTimer(testTabId, testInterval);
      const status = persistentAlarmManager.getTimerStatus(testTabId);

      if (!status.isActive) {
        console.error('Timer creation failed');
        return false;
      }

      // Test timer stopping
      await persistentAlarmManager.stopTimer(testTabId);
      const statusAfterStop = persistentAlarmManager.getTimerStatus(testTabId);

      if (statusAfterStop.isActive) {
        console.error('Timer stopping failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Timer management test failed:', error);
      return false;
    }
  }

  /**
   * Test tab detection functionality
   */
  private async testTabDetection(): Promise<boolean> {
    try {
      // Test URL validation
      const validUrls = [
        'https://hh.kz/resume/12345',
        'https://hh.ru/resume/67890',
        'http://hh.kz/resume/test',
      ];

      const invalidUrls = [
        'https://google.com',
        'https://hh.kz/vacancy/123',
        'https://hh.ru/search',
        '',
      ];

      for (const url of validUrls) {
        if (!isValidResumeUrl(url)) {
          console.error(`Valid URL incorrectly rejected: ${url}`);
          return false;
        }
      }

      for (const url of invalidUrls) {
        if (isValidResumeUrl(url)) {
          console.error(`Invalid URL incorrectly accepted: ${url}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Tab detection test failed:', error);
      return false;
    }
  }

  /**
   * Test circuit breaker functionality
   */
  private async testCircuitBreaker(): Promise<boolean> {
    try {
      const testTabId = 99998;

      // Test initial state
      if (circuitBreaker.isOpen(testTabId)) {
        console.error('Circuit breaker should be closed initially');
        return false;
      }

      // Test failure recording
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure(testTabId);
      }

      if (!circuitBreaker.isOpen(testTabId)) {
        console.error('Circuit breaker should be open after 6 failures');
        return false;
      }

      // Test success reset
      circuitBreaker.recordSuccess(testTabId);
      if (circuitBreaker.isOpen(testTabId)) {
        console.error('Circuit breaker should be closed after success');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Circuit breaker test failed:', error);
      return false;
    }
  }

  /**
   * Test error recovery functionality
   */
  private async testErrorRecovery(): Promise<boolean> {
    try {
      const testTabId = 99997;

      // Test recovery attempt
      const recoveryStatus = errorRecoverySystem.getRecoveryStatus(testTabId);
      if (recoveryStatus.attempts !== 0) {
        console.error('Recovery attempts should be 0 initially');
        return false;
      }

      // Reset recovery attempts
      errorRecoverySystem.resetRecoveryAttempts(testTabId);
      const statusAfterReset = errorRecoverySystem.getRecoveryStatus(testTabId);
      if (statusAfterReset.attempts !== 0) {
        console.error('Recovery attempts should be 0 after reset');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error recovery test failed:', error);
      return false;
    }
  }

  /**
   * Test performance optimization functionality
   */
  private async testPerformanceOptimization(): Promise<boolean> {
    try {
      // Test cache functionality
      const testKey = 'test_cache_key';
      const testData = { test: 'data', timestamp: Date.now() };

      performanceOptimizer.setCache(testKey, testData, 1000); // 1 second TTL
      const cachedData = performanceOptimizer.getCache(testKey);

      if (
        !cachedData ||
        (cachedData as { test: string }).test !== testData.test
      ) {
        console.error('Cache set/get failed');
        return false;
      }

      // Test cache expiration
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for expiration
      const expiredData = performanceOptimizer.getCache(testKey);

      if (expiredData !== null) {
        console.error('Cache expiration failed');
        return false;
      }

      // Test metrics
      const metrics = performanceOptimizer.getMetrics();
      if (
        typeof metrics.cacheSize !== 'number' ||
        typeof metrics.activeDebouncers !== 'number'
      ) {
        console.error('Performance metrics invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Performance optimization test failed:', error);
      return false;
    }
  }

  /**
   * Test state persistence functionality
   */
  private async testStatePersistence(): Promise<boolean> {
    try {
      // Test settings persistence
      const settings = await getSettings();
      if (!settings || typeof settings.clickInterval !== 'number') {
        console.error('Settings loading failed');
        return false;
      }

      // Test managed tabs sync
      const managedTabs = getManagedTabsSync();
      if (!Array.isArray(managedTabs)) {
        console.error('Managed tabs sync failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('State persistence test failed:', error);
      return false;
    }
  }

  /**
   * Test communication functionality
   */
  private async testCommunication(): Promise<boolean> {
    try {
      // Verify message handler exists
      if (!chrome.runtime.onMessage.hasListeners()) {
        console.error('No message listeners registered');
        return false;
      }

      // Test batch operations
      const batchMetrics = batchOperationsManager.getMetrics();
      if (typeof batchMetrics.activeBatches !== 'number') {
        console.error('Batch operations metrics invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Communication test failed:', error);
      return false;
    }
  }
}

// Global testing framework
const testingFramework = new TestingFramework();

/**
 * Debounced functions for performance optimization
 */
const debouncedDiscoverTabs = performanceOptimizer.debounce(
  'discover_tabs',
  discoverAndManageTabs,
  2000 // 2 seconds
);

const debouncedCleanupCache = performanceOptimizer.debounce(
  'cleanup_cache',
  () => {
    performanceOptimizer.cleanupCache();
    console.log('🧹 Cache cleanup completed');
  },
  5 * 60 * 1000 // 5 minutes
);

/**
 * Optimized logging function with batching
 */
function addLogEntryOptimized(logEntry: {
  level: 'info' | 'warning' | 'error';
  message: string;
  tabId?: number;
}): void {
  batchOperationsManager.addToBatch('log_entries', async () => {
    await addLogEntry(logEntry);
  });
}

/**
 * Initialize the extension
 *
 * This function sets up all the core components and systems needed for the extension to work:
 *
 * 1. **Storage Initialization**: Sets up Chrome Storage API with default settings
 * 2. **Tab Manager Setup**: Initializes tab detection and management system
 * 3. **Settings Loading**: Loads user preferences and global pause state
 * 4. **Timer Callbacks**: Configures PersistentAlarmManager with timer handlers
 * 5. **Performance Setup**: Starts periodic cache cleanup and optimization
 * 6. **Tab Discovery**: Finds existing HeadHunter resume tabs and starts timers
 * 7. **Testing Framework**: Runs initial system tests in development mode
 * 8. **State Persistence**: Ensures all settings and state are properly saved
 *
 * The initialization is idempotent - it can be called multiple times safely.
 * If initialization fails, the extension will log errors but continue to function
 * with reduced capabilities.
 *
 * @throws Never throws - all errors are caught and logged
 */

// 🔧 FIX: Race condition prevention
let initializationPromise: Promise<void> | null = null;

async function initializeExtension(): Promise<void> {
  // FIX: Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  if (isInitialized) {
    return;
  }

  // FIX: Store the promise to prevent concurrent initializations
  initializationPromise = (async () => {
    try {
      console.log('Initializing HeadHunter Resume Auto-Boost Extension...');

      // Initialize storage
      await initializeStorage();

      // Initialize tab manager
      await initializeTabManager();

      // Load settings
      const settings = await getSettings();
      globalPaused = settings.globalPaused;

      console.log(`🔧 Settings loaded:`, {
        clickInterval: settings.clickInterval,
        globalPaused: settings.globalPaused,
        maxTabs: settings.maxTabs,
        loggingEnabled: settings.loggingEnabled,
      });
      console.log(`🔧 Global pause state set to: ${globalPaused}`);

      // Set up timer callbacks
      persistentAlarmManager.setGlobalCallback(handleTimerExpiration);

      // Set up periodic cache cleanup
      setInterval(
        () => {
          debouncedCleanupCache();
        },
        10 * 60 * 1000
      ); // Every 10 minutes

      // Discover and start managing tabs
      await discoverAndManageTabs();

      // Run initial system tests in development mode
      if (
        chrome.runtime.getManifest().version.includes('dev') ||
        chrome.runtime.getManifest().version === '1.0.0'
      ) {
        console.log('🧪 Running initial system tests...');
        testingFramework.enableTestingMode();

        // Run tests after a short delay to allow initialization to complete
        setTimeout(async () => {
          try {
            const results = await testingFramework.runSystemTests();
            console.log(
              `🧪 Initial system tests completed: ${results.passed} passed, ${results.failed} failed`
            );

            if (results.failed > 0) {
              console.warn(
                '⚠️ Some system tests failed. Check console for details.'
              );
            }
          } catch (error) {
            console.error('Failed to run initial system tests:', error);
          }
        }, 5000); // 5 seconds delay
      }

      isInitialized = true;

      await addLogEntry({
        level: 'info',
        message: 'Extension initialized successfully',
      });

      console.log(
        'HeadHunter Resume Auto-Boost Extension initialized successfully'
      );
    } catch (error) {
      console.error('Failed to initialize extension:', error);
      await addLogEntry({
        level: 'error',
        message: `Failed to initialize extension: ${error}`,
      });
    } finally {
      // FIX: Always reset the promise to allow future initializations
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Discover and start managing resume tabs (optimized with caching)
 *
 * This function is responsible for finding all open HeadHunter resume tabs
 * and setting up automatic boost timers for them. It implements several
 * optimization strategies:
 *
 * **Caching Strategy:**
 * - Uses 2-minute cache to avoid expensive tab queries
 * - Falls back to direct tab discovery if cache is empty
 * - Automatically invalidates cache when needed
 *
 * **Timer Management:**
 * - Only starts timers for DISCOVERED or ACTIVE tabs
 * - Respects global pause setting
 * - Handles Service Worker restarts gracefully
 * - Implements critical fix for timer restoration
 *
 * **State Handling:**
 * - Updates tab states appropriately (DISCOVERED → ACTIVE)
 * - Logs all timer operations for debugging
 * - Handles edge cases like missing tabs or invalid states
 *
 * **Performance Features:**
 * - Debounced execution to prevent excessive calls
 * - Batch processing of multiple tabs
 * - Efficient state synchronization
 *
 * @throws Never throws - all errors are caught and logged
 */
async function discoverAndManageTabs(): Promise<void> {
  try {
    // Check cache first
    const cacheKey = 'managed_tabs_discovery';
    const cachedTabs = performanceOptimizer.getCache(cacheKey);

    if (cachedTabs && Array.isArray(cachedTabs) && cachedTabs.length > 0) {
      console.log(`📋 Using cached tab discovery (${cachedTabs.length} tabs)`);
    } else {
      await updateTabList();
      const managedTabs = getManagedTabsSync();

      // Cache the result for 2 minutes
      performanceOptimizer.setCache(cacheKey, managedTabs, 2 * 60 * 1000);
    }

    const cachedResult = performanceOptimizer.getCache(cacheKey);
    const managedTabs = (
      Array.isArray(cachedResult) ? cachedResult : getManagedTabsSync()
    ) as TabInfo[];

    console.log(`Found ${managedTabs.length} resume tabs to manage`);

    // Start timers for discovered and active tabs
    if (!globalPaused) {
      const settings = await getSettings();
      const intervalMs = settings.clickInterval * 60 * 1000;

      for (const tab of managedTabs) {
        // Only start timers for tabs that are not paused, in error state
        if (
          tab.state === TabState.DISCOVERED ||
          tab.state === TabState.ACTIVE
        ) {
          // Check if timer is already running
          const timerStatus = persistentAlarmManager.getTimerStatus(tab.tabId);

          // Always ensure timer is running for active tabs
          if (!timerStatus.isActive || !timerStatus.exists) {
            console.log(`🚀 Starting timer for tab ${tab.tabId}: ${tab.title}`);

            // Update state to active and start timer
            await updateTabState(tab.tabId, TabState.ACTIVE);
            persistentAlarmManager.startTimer(tab.tabId, intervalMs);

            await addLogEntry({
              level: 'info',
              message: `Started timer for tab: ${tab.title} (${settings.clickInterval} min interval)`,
              tabId: tab.tabId,
            });
          }
        }
      }

      console.log(`✅ Timer initialization completed for ${managedTabs.length} tabs`);
    } else {
      console.log('⏸️ Extension is globally paused, not starting timers');
    }
  } catch (error) {
    console.error('Failed to discover and manage tabs:', error);
    await addLogEntry({
      level: 'error',
      message: `Failed to discover and manage tabs: ${error}`,
    });
  }
}

/**
 * Handle timer expiration - trigger button click
 *
 * This is the core function that executes when a timer expires for a specific tab.
 * It implements a comprehensive workflow with multiple safety mechanisms:
 *
 * 1. Concurrency Protection: Prevents multiple simultaneous executions for the same tab
 * 2. Global Pause Check: Respects user's global pause setting
 * 3. Circuit Breaker: Skips tabs with too many recent failures
 * 4. Tab Validation: Ensures tab still exists and is a valid resume page
 * 5. Content Script Injection: Ensures content script is loaded
 * 6. Message Retry: Attempts communication with exponential backoff
 * 7. Error Recovery: Attempts automatic recovery from failures
 * 8. Timer Restart: Always restarts timer regardless of success/failure
 * 9. Emergency Fallback: Multiple layers of timer restart protection
 *
 * Flow Diagram:
 * ┌─────────────────┐
 * │ Timer Expires   │
 * └─────────┬───────┘
 *           │
 * ┌─────────▼───────┐    ❌ Skip
 * │ Check Locks &   │────────────┐
 * │ Global Pause    │            │
 * └─────────┬───────┘            │
 *           │ ✅                 │
 * ┌─────────▼───────┐    ❌ Skip │
 * │ Circuit Breaker │────────────┤
 * │ Check           │            │
 * └─────────┬───────┘            │
 *           │ ✅                 │
 * ┌─────────▼───────┐    ❌ Exit │
 * │ Validate Tab    │────────────┤
 * └─────────┬───────┘            │
 *           │ ✅                 │
 * ┌─────────▼───────┐            │
 * │ Inject Content  │            │
 * │ Script          │            │
 * └─────────┬───────┘            │
 *           │                    │
 * ┌─────────▼───────┐    ❌      │
 * │ Send Message    │────────────┤
 * │ with Retry      │            │
 * └─────────┬───────┘            │
 *           │ ✅                 │
 * ┌─────────▼───────┐            │
 * │ Process Result  │            │
 * └─────────┬───────┘            │
 *           │                    │
 * ┌─────────▼───────┐            │
 * │ Restart Timer   │◄───────────┘
 * │ (Always)        │
 * └─────────────────┘
 *
 * @param tabId - The Chrome tab ID to process
 * @throws Never throws - all errors are caught and handled gracefully
 */
async function handleTimerExpiration(tabId: number): Promise<void> {
  const startTime = Date.now();

  // ✅ CRITICAL: Prevent concurrent processing of the same tab
  if (processingTabs.has(tabId)) {
    console.warn(`⚠️ Tab ${tabId} already being processed, skipping`);
    return;
  }

  processingTabs.add(tabId);

  try {
    console.log(`🎯 Timer expired for tab ${tabId} - processing...`);

    // Check if globally paused
    if (globalPaused) {
      return;
    }

    // Check circuit breaker
    if (circuitBreaker.isOpen(tabId)) {
      const status = circuitBreaker.getStatus(tabId);
      console.log(`🔴 Circuit breaker open for tab ${tabId} (${status.failures} failures)`);

      addLogEntryOptimized({
        level: 'warning',
        message: `Circuit breaker open, skipping tab (${status.failures} failures)`,
        tabId: tabId,
      });

      const settings = await getSettings();
      const retryInterval = settings.clickInterval * 60 * 1000;
      await persistentAlarmManager.startTimer(tabId, retryInterval);
      return;
    }

    // Get tab info
    const managedTabs = getManagedTabsSync();
    const tab = managedTabs.find(t => t.tabId === tabId);

    if (!tab) {
      console.warn(`Tab ${tabId} not found in managed tabs`);
      return;
    }

    // Check if tab is paused
    if (tab.state === TabState.PAUSED) {
      return;
    }

    // Check if tab still exists and is accessible
    let tabExists = false;
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      tabExists = !!tabInfo && !!tabInfo.url && isValidResumeUrl(tabInfo.url);
    } catch (tabError) {
      console.warn(`Tab ${tabId} no longer exists:`, tabError);
      await updateTabState(tabId, TabState.REMOVED);
      await persistentAlarmManager.stopTimer(tabId);
      return;
    }

    if (!tabExists) {
      console.warn(`Tab ${tabId} is not a valid HeadHunter resume page`);
      await updateTabState(tabId, TabState.REMOVED);
      await persistentAlarmManager.stopTimer(tabId);
      return;
    }

    // ✅ Content script injection
    try {
      // Check if content script is already loaded
      let scriptLoaded = false;
      try {
        const testResponse = await chrome.tabs.sendMessage(tabId, { type: 'TEST_MESSAGE' });
        scriptLoaded = !!testResponse;
      } catch (testError) {
        // Script not loaded, will inject
      }
      
      // Inject if needed
      if (!scriptLoaded) {
        const tabInfo = await chrome.tabs.get(tabId);
        if (!tabInfo || !tabInfo.url) {
          throw new Error(`Tab ${tabId} does not exist or has no URL`);
        }
        
        // Wait for tab to load if needed
        if (tabInfo.status !== 'complete') {
          let attempts = 0;
          while (attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const updatedTab = await chrome.tabs.get(tabId);
            if (updatedTab.status === 'complete') {
              break;
            }
            attempts++;
          }
        }
        
        // Final URL check
        const finalTabInfo = await chrome.tabs.get(tabId);
        if (!finalTabInfo.url || !isValidResumeUrl(finalTabInfo.url)) {
          throw new Error(`Tab ${tabId} is no longer a valid resume page`);
        }
        
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/resumeBooster.js'],
        });
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Verify script responds
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'TEST_MESSAGE' });
      } catch (verifyError) {
        throw new Error(`Content script not responding after injection`);
      }
      
    } catch (injectionError) {
      console.error(`❌ Content script injection failed for tab ${tabId}:`, injectionError);
      
      // Handle permission errors
      const errorMessage = (injectionError as Error).message;
      if (errorMessage.includes('Cannot access contents of the page') || 
          errorMessage.includes('Extension manifest must request permission')) {
        
        console.log(`🔒 Permission error for tab ${tabId}, attempting reload...`);
        
        try {
          const tabInfo = await chrome.tabs.get(tabId);
          
          if (!tabInfo.url || !isValidResumeUrl(tabInfo.url)) {
            await updateTabState(tabId, TabState.REMOVED);
            await persistentAlarmManager.stopTimer(tabId);
            return;
          }
          
          // Reload tab to reset state
          await chrome.tabs.reload(tabId);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try injection again
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/resumeBooster.js'],
          });
          
        } catch (reloadError) {
          throw new Error(`Permission error and reload failed: ${injectionError}`);
        }
      } else {
        // Try alternative injection
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              (window as any).alternativeInjectionTest = true;
            }
          });
        } catch (altError) {
          throw new Error(`All injection methods failed: ${injectionError}`);
        }
      }
    }

    // Send boost message
    const message: BackgroundMessage = {
      type: 'BOOST_RESUME',
    };

    const settings = await getSettings();
    const intervalMs = settings.clickInterval * 60 * 1000;
    let nextState = TabState.ACTIVE;

    try {
      const response = (await sendMessageWithRetry(
        tabId,
        message
      )) as ContentMessage;

      if (response.success) {
        circuitBreaker.recordSuccess(tabId);
        errorRecoverySystem.resetRecoveryAttempts(tabId);

        batchOperationsManager.addToBatch('log_entries', async () => {
          await addLogEntry({
            level: 'info',
            message: `Successfully clicked boost button for tab: ${tab.title}`,
            tabId: tabId,
          });
        });

        console.log(`✅ Button click successful for tab ${tabId}`);
        nextState = TabState.ACTIVE;
      } else {
        circuitBreaker.recordFailure(tabId);
        await addLogEntry({
          level: 'warning',
          message: `Failed to click boost button for tab: ${tab.title}`,
          tabId: tabId,
        });

        console.log(`⚠️ Button click failed for tab ${tabId}`);
        nextState = TabState.ACTIVE;
      }
    } catch (messageError) {
      circuitBreaker.recordFailure(tabId);
      console.error(`Failed to send message to tab ${tabId}:`, messageError);

      const recoverySuccessful = await errorRecoverySystem.attemptRecovery(
        tabId,
        messageError as Error
      );

      if (recoverySuccessful) {
        console.log(`✅ Recovery successful for tab ${tabId}`);
        nextState = TabState.ACTIVE;
      } else {
        await addLogEntry({
          level: 'error',
          message: `Failed to communicate with tab: ${tab.title}`,
          tabId: tabId,
        });

        console.log(`❌ Communication failed for tab ${tabId}`);
        nextState = TabState.ACTIVE;
      }
    }

    // Always restart timer
    try {
      // Check if timer is already active (might have been restarted by persistentAlarmManager)
      const currentTimerStatus = persistentAlarmManager.getTimerStatus(tabId);
      
      if (!currentTimerStatus.isActive) {
        await persistentAlarmManager.startTimer(tabId, intervalMs);
        console.log(`✅ Timer restarted for tab ${tabId} (was inactive)`);
      } else {
        // Timer is already active, just update the state
        console.log(`✅ Timer already active for tab ${tabId}, updating state only`);
      }
      
      await updateTabState(tabId, nextState);

      await addLogEntry({
        level: 'info',
        message: `Timer restarted for tab: ${tab.title} (${intervalMs / 1000 / 60} min interval)`,
        tabId: tabId,
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Timer restarted for tab ${tabId} (${processingTime}ms)`);
    } catch (timerError) {
      console.error(`❌ Failed to restart timer for tab ${tabId}:`, timerError);

      await addLogEntry({
        level: 'error',
        message: `Failed to restart timer for tab: ${tab.title}`,
        tabId: tabId,
      });

      await updateTabState(tabId, TabState.ERROR);

      // Fallback timer
      try {
        await persistentAlarmManager.startTimer(tabId, intervalMs);
        console.log(`✅ Fallback timer started for tab ${tabId}`);
      } catch (fallbackError) {
        console.error(`❌ Fallback timer failed for tab ${tabId}:`, fallbackError);
      }
    }
  } catch (error) {
    circuitBreaker.recordFailure(tabId);
    console.error(`Error handling timer expiration for tab ${tabId}:`, error);

    const recoverySuccessful = await errorRecoverySystem.attemptRecovery(
      tabId,
      error as Error
    );

    if (!recoverySuccessful) {
      await addLogEntry({
        level: 'error',
        message: `Critical error handling timer expiration for tab ${tabId}: ${error}`,
        tabId: tabId,
      });

      // Emergency timer restart
      try {
        const settings = await getSettings();
        const emergencyInterval = settings.clickInterval * 60 * 1000;
        await persistentAlarmManager.startTimer(tabId, emergencyInterval);
        await updateTabState(tabId, TabState.ACTIVE);
        console.log(`✅ Emergency timer started for tab ${tabId}`);
      } catch (emergencyError) {
        console.error(`❌ Emergency timer failed for tab ${tabId}:`, emergencyError);
      }
    }
  } finally {
    processingTabs.delete(tabId);
  }
}

/**
 * Handle messages from popup and content scripts
 *
 * This is the central message router for the extension. It handles communication
 * between different components:
 *
 * **Message Sources:**
 * - Popup UI: User interactions, settings changes, manual controls
 * - Content Scripts: Button click results, page state updates
 * - Extension System: Internal state requests, testing commands
 *
 * **Message Types Handled:**
 * - GET_EXTENSION_STATE: Returns complete extension state for popup
 * - SET_GLOBAL_PAUSE: Pauses/resumes all timers globally
 * - SET_TAB_PAUSE: Pauses/resumes specific tab timer
 * - SET_INTERVAL: Updates click interval and restarts timers
 * - SETTINGS_UPDATE: Applies new settings and notifies content scripts
 * - REFRESH_TABS: Rediscovers tabs and updates management
 * - TAB_REMOVE: Manually removes tab from management
 * - Testing commands: RUN_SYSTEM_TESTS, ENABLE/DISABLE_TESTING_MODE, GET_TEST_RESULTS
 * - FORCE_START_TIMER: Manually starts timer for a specific tab
 * - GET_LOGS: Retrieves logs from the extension
 * - BUTTON_STATE: Handles button state updates from content scripts
 *
 * **Response Pattern:**
 * All handlers use async functions and return { success: boolean, data?: any, error?: string }
 * The return true statement keeps the message channel open for async responses.
 *
 * @param message - The message object with type and data
 * @param sender - Information about the message sender
 * @param sendResponse - Callback to send response back to sender
 */
chrome.runtime.onMessage.addListener(
  (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    // Only log important message types, not routine ones
    if (!['GET_EXTENSION_STATE'].includes(message.type)) {
      console.log('Service worker received message:', message.type, 'from:', sender.tab?.id || 'popup');
    }

    // Handle different message types
    switch (message.type) {
      case 'GET_EXTENSION_STATE':
        handleGetExtensionState(sendResponse);
        return true; // Keep message channel open

      case 'SET_GLOBAL_PAUSE':
      case 'GLOBAL_PAUSE_TOGGLE': // Legacy support
        handleSetGlobalPause(message.paused, sendResponse);
        return true;

      case 'SET_TAB_PAUSE':
        handleSetTabPause(message.tabId, message.paused, sendResponse);
        return true;

      case 'TAB_PAUSE_TOGGLE': // Legacy support - toggle current state
        handleTabPauseToggle(message.tabId, sendResponse);
        return true;

      case 'SET_INTERVAL':
      case 'SETTINGS_UPDATE': // Legacy support
        if (message.type === 'SETTINGS_UPDATE' && message.data) {
          handleSettingsUpdate(message.data, sendResponse);
        } else {
          handleSetInterval(message.interval, sendResponse);
        }
        return true;

      case 'REFRESH_TABS':
        handleRefreshTabs(sendResponse);
        return true;

      case 'TAB_REMOVE':
        handleTabRemove(message.tabId, sendResponse);
        return true;

      case 'RUN_SYSTEM_TESTS':
        handleRunSystemTests(sendResponse);
        return true;

      case 'ENABLE_TESTING_MODE':
        handleEnableTestingMode(sendResponse);
        return true;

      case 'DISABLE_TESTING_MODE':
        handleDisableTestingMode(sendResponse);
        return true;

      case 'GET_TEST_RESULTS':
        handleGetTestResults(sendResponse);
        return true;

      case 'FORCE_START_TIMER':
        handleForceStartTimer(message.tabId, sendResponse);
        return true;

      case 'GET_LOGS':
        handleGetLogs(sendResponse);
        return true;

      case 'BUTTON_STATE':
        handleButtonState(message, sender, sendResponse);
        return true;

      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  }
);

/**
 * Handle get extension state request
 */
async function handleGetExtensionState(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const settings = await getSettings();
    const managedTabs = getManagedTabsSync();

    // Get timer status for each tab
    const tabsWithTimers = managedTabs.map(tab => {
      const timerStatus = persistentAlarmManager.getTimerStatus(tab.tabId);
      const circuitBreakerStatus = circuitBreaker.getStatus(tab.tabId);
      const recoveryStatus = errorRecoverySystem.getRecoveryStatus(tab.tabId);

      return {
        ...tab,
        timerStatus,
        circuitBreakerStatus,
        recoveryStatus,
      };
    });

    const state = {
      isInitialized,
      globalPaused,
      settings,
      managedTabs: tabsWithTimers,
      activeTimers: persistentAlarmManager.getActiveTimers().length,
      performanceMetrics: {
        optimizer: performanceOptimizer.getMetrics(),
        batchOperations: batchOperationsManager.getMetrics(),
      },
      testResults: testingFramework.getTestResults(),
    };

    sendResponse({ success: true, data: state });
  } catch (error) {
    console.error('❌ Failed to get extension state:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle set global pause request
 */
async function handleSetGlobalPause(
  paused: boolean,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    console.log(`🔄 Setting global pause to: ${paused}`);
    globalPaused = paused;

    // Save to storage
    await import('../utils/storage').then(storage =>
      storage.saveGlobalPauseState(paused)
    );

    if (paused) {
      // Pause all timers
      const managedTabs = getManagedTabsSync();
      console.log(`⏸️ Pausing ${managedTabs.length} tabs`);

      for (const tab of managedTabs) {
        if (tab.state === TabState.ACTIVE) {
          await persistentAlarmManager.pauseTimer(tab.tabId);
          await updateTabState(tab.tabId, TabState.PAUSED);
          console.log(`⏸️ Paused tab ${tab.tabId}: ${tab.title}`);
        }
      }

      await addLogEntry({
        level: 'info',
        message: 'Extension globally paused',
      });
    } else {
      // Resume all timers
      const managedTabs = getManagedTabsSync();
      const settings = await getSettings();
      const intervalMs = settings.clickInterval * 60 * 1000;

      console.log(
        `▶️ Resuming ${managedTabs.length} tabs with ${settings.clickInterval}min interval`
      );

      for (const tab of managedTabs) {
        if (tab.state === TabState.PAUSED) {
          await updateTabState(tab.tabId, TabState.ACTIVE);
          await persistentAlarmManager.startTimer(tab.tabId, intervalMs);
          console.log(`▶️ Resumed tab ${tab.tabId}: ${tab.title}`);
        }
      }

      await addLogEntry({
        level: 'info',
        message: 'Extension globally resumed',
      });
    }

    console.log(`✅ Global pause set to: ${paused}`);
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to set global pause:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle set tab pause request
 */
async function handleSetTabPause(
  tabId: number,
  paused: boolean,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const managedTabs = getManagedTabsSync();
    const tab = managedTabs.find(t => t.tabId === tabId);

    if (!tab) {
      sendResponse({ success: false, error: 'Tab not found' });
      return;
    }

    if (paused) {
      await persistentAlarmManager.pauseTimer(tabId);
      await updateTabState(tabId, TabState.PAUSED);

      await addLogEntry({
        level: 'info',
        message: `Tab paused: ${tab.title}`,
        tabId: tabId,
      });
    } else {
      const settings = await getSettings();
      const intervalMs = settings.clickInterval * 60 * 1000;

      await updateTabState(tabId, TabState.ACTIVE);
      await persistentAlarmManager.startTimer(tabId, intervalMs);

      await addLogEntry({
        level: 'info',
        message: `Tab resumed: ${tab.title}`,
        tabId: tabId,
      });
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to set tab pause:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle set interval request
 */
async function handleSetInterval(
  interval: number,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    // Save new interval
    await import('../utils/storage').then(storage =>
      storage.saveInterval(interval)
    );

    // Restart all active timers with new interval
    const managedTabs = getManagedTabsSync();
    const intervalMs = interval * 60 * 1000;

    for (const tab of managedTabs) {
      if (
        tab.state === TabState.ACTIVE &&
        persistentAlarmManager.isTimerActive(tab.tabId)
      ) {
        await persistentAlarmManager.resetTimer(tab.tabId, intervalMs);
      }
    }

    await addLogEntry({
      level: 'info',
      message: `Interval updated to ${interval} minutes`,
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to set interval:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle settings update request (includes notifying content scripts)
 */
async function handleSettingsUpdate(
  settings: any,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    console.log('Handling settings update:', settings);

    // Save settings to storage
    await import('../utils/storage').then(storage =>
      storage.saveSettings(settings)
    );

    // Update click interval if provided
    if (settings.clickInterval) {
      // Restart all active timers with new interval
      const managedTabs = getManagedTabsSync();
      const intervalMs = settings.clickInterval * 60 * 1000;

      for (const tab of managedTabs) {
        if (
          tab.state === TabState.ACTIVE &&
          persistentAlarmManager.isTimerActive(tab.tabId)
        ) {
          await persistentAlarmManager.resetTimer(tab.tabId, intervalMs);
        }
      }
    }

    // Notify all content scripts about settings update
    const managedTabs = getManagedTabsSync();
    console.log(
      `🔄 Notifying ${managedTabs.length} content scripts about settings update`
    );

    for (const tab of managedTabs) {
      try {
        console.log(
          `🔄 Sending SETTINGS_UPDATE to tab ${tab.tabId} (${tab.title})`
        );
        await chrome.tabs.sendMessage(tab.tabId, {
          type: 'SETTINGS_UPDATE',
          data: settings,
        });
        console.log(
          `✅ Settings update sent to tab ${tab.tabId} with refreshInterval: ${settings.refreshInterval}`
        );
      } catch (messageError) {
        console.log(
          `❌ Failed to notify tab ${tab.tabId} about settings update:`,
          messageError
        );
        // Continue with other tabs even if one fails
      }
    }

    await addLogEntry({
      level: 'info',
      message: `Settings updated: ${Object.keys(settings).join(', ')} - Click interval: ${settings.clickInterval}min, Refresh interval: ${settings.refreshInterval}min`,
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to update settings:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle refresh tabs request
 */
async function handleRefreshTabs(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    console.log('🔄 Refreshing tabs...');

    // Clear cache before refresh
    performanceOptimizer.setCache('managed_tabs_discovery', [], 0);
    
    // Force update tab list
    await updateTabList();
    
    // Rediscover and manage tabs
    await discoverAndManageTabs();

    const managedTabs = getManagedTabsSync();
    console.log(`✅ Refresh completed: found ${managedTabs.length} tabs`);

    sendResponse({ 
      success: true, 
      message: `Tabs refreshed successfully - found ${managedTabs.length} resume tabs`,
      data: { managedTabsCount: managedTabs.length }
    });
  } catch (error) {
    console.error('Failed to refresh tabs:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle tab pause toggle request (legacy support)
 */
async function handleTabPauseToggle(
  tabId: number | undefined,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    if (!tabId) {
      sendResponse({ success: false, error: 'Tab ID is required' });
      return;
    }

    const managedTabs = getManagedTabsSync();
    const tab = managedTabs.find(t => t.tabId === tabId);

    if (!tab) {
      sendResponse({ success: false, error: 'Tab not found' });
      return;
    }

    // Toggle the current pause state
    const newPausedState = tab.state !== TabState.PAUSED;
    await handleSetTabPause(tabId, newPausedState, sendResponse);
  } catch (error) {
    console.error('Failed to toggle tab pause:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle tab removal request
 */
async function handleTabRemove(
  tabId: number | undefined,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    if (!tabId) {
      sendResponse({ success: false, error: 'Tab ID is required' });
      return;
    }

    const managedTabs = getManagedTabsSync();
    const tab = managedTabs.find(t => t.tabId === tabId);

    if (!tab) {
      sendResponse({ success: false, error: 'Tab not found' });
      return;
    }

    // Stop timer for this tab
    persistentAlarmManager.stopTimer(tabId);
    persistentAlarmManager.removeCallback(tabId);

    // Remove tab from management
    await import('../utils/tabManager').then(tabManager =>
      tabManager.removeTab(tabId)
    );

    await addLogEntry({
      level: 'info',
      message: `Tab manually removed from management: ${tab.title}`,
      tabId: tabId,
    });

    console.log(`Tab ${tabId} removed from management: ${tab.title}`);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to remove tab:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle run system tests request
 */
async function handleRunSystemTests(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    console.log('🧪 Running system tests requested from popup');
    testingFramework.enableTestingMode();

    const results = await testingFramework.runSystemTests();

    addLogEntryOptimized({
      level: 'info',
      message: `System tests completed: ${results.passed} passed, ${results.failed} failed`,
    });

    sendResponse({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Failed to run system tests:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle enable testing mode request
 */
async function handleEnableTestingMode(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    testingFramework.enableTestingMode();

    addLogEntryOptimized({
      level: 'info',
      message: 'Testing mode enabled',
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to enable testing mode:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle disable testing mode request
 */
async function handleDisableTestingMode(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    testingFramework.disableTestingMode();

    addLogEntryOptimized({
      level: 'info',
      message: 'Testing mode disabled',
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to disable testing mode:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle get test results request
 */
async function handleGetTestResults(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const results = testingFramework.getTestResults();
    sendResponse({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Failed to get test results:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle force start timer request
 */
async function handleForceStartTimer(
  tabId: number,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const managedTabs = getManagedTabsSync();
    const tab = managedTabs.find(t => t.tabId === tabId);

    if (!tab) {
      sendResponse({ success: false, error: 'Tab not found' });
      return;
    }

    if (tab.state === TabState.ACTIVE) {
      sendResponse({ success: true, message: 'Tab is already active' });
      return;
    }

    await updateTabState(tabId, TabState.ACTIVE);
    
    // Get settings to determine interval
    const settings = await getSettings();
    const intervalMs = settings.refreshInterval * 60 * 1000; // Convert minutes to milliseconds
    persistentAlarmManager.startTimer(tabId, intervalMs);

    await addLogEntry({
      level: 'info',
      message: `Timer manually started for tab: ${tab.title}`,
      tabId: tabId,
    });

    sendResponse({ success: true, message: `Timer started for tab ${tabId}` });
  } catch (error) {
    console.error('Failed to force start timer:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle get logs request
 */
async function handleGetLogs(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    // Get recent log entries from storage
    const result = await chrome.storage.local.get(['log_entries']);
    const logs = result.log_entries || [];
    
    sendResponse({
      success: true,
      data: logs.slice(-50), // Return last 50 entries
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle button state updates from content scripts
 */
async function handleButtonState(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID provided' });
      return;
    }

    console.log(`🔘 Button state update from tab ${tabId}:`, message.data);

    // Log the button state for debugging
    if (message.data) {
      const { buttonFound, buttonText, buttonEnabled, selector } = message.data;
      
      addLogEntryOptimized({
        level: 'info',
        message: `Button state: found=${buttonFound}, text="${buttonText}", enabled=${buttonEnabled}, selector="${selector}"`,
        tabId: tabId,
      });
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to handle button state:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Event Listeners

/**
 * Handle extension installation/update
 *
 * This event fires when:
 * - Extension is first installed
 * - Extension is updated to a new version
 * - Chrome is updated (if extension was disabled)
 *
 * We use this opportunity to:
 * - Log the installation/update event
 * - Initialize the extension completely
 * - Set up all necessary components
 */
chrome.runtime.onInstalled.addListener(async details => {
  console.log('Extension installed/updated:', details);

  await addLogEntry({
    level: 'info',
    message: `Extension ${details.reason}: version ${chrome.runtime.getManifest().version}`,
  });

  // Initialize extension
  await initializeExtension();
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup');

  await addLogEntry({
    level: 'info',
    message: 'Extension started',
  });

  // Initialize extension
  await initializeExtension();
});

/**
 * Handle tab updates
 *
 * This event fires when any tab changes state (loading, complete, etc.).
 * We specifically listen for 'complete' status to detect new resume tabs.
 *
 * **Optimization Strategy:**
 * - Uses debounced discovery to prevent excessive processing
 * - Immediately checks if the specific tab is a resume tab
 * - Waits for debounced discovery to complete before starting timers
 * - Handles race conditions between discovery and timer setup
 *
 * **Performance Considerations:**
 * - Only processes tabs when extension is initialized
 * - Uses 3-second delay to allow debounced discovery to complete
 * - Gracefully handles tab access errors
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (isInitialized && changeInfo.status === 'complete') {
    // Check if this is a new resume tab - use debounced version for performance
    debouncedDiscoverTabs();

    // Also check immediately if this specific tab is a resume tab
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      if (tabInfo && tabInfo.url && isValidResumeUrl(tabInfo.url)) {
        // Wait a bit for debounced discovery to complete, then check if timer needed
        setTimeout(async () => {
          const managedTabs = getManagedTabsSync();
          const managedTab = managedTabs.find(t => t.tabId === tabId);

          if (
            managedTab &&
            managedTab.state === TabState.DISCOVERED &&
            !globalPaused
          ) {
            const settings = await getSettings();
            const intervalMs = settings.clickInterval * 60 * 1000;

            await updateTabState(tabId, TabState.ACTIVE);
            persistentAlarmManager.startTimer(tabId, intervalMs);

            addLogEntryOptimized({
              level: 'info',
              message: `New resume tab detected and timer started: ${managedTab.title}`,
              tabId: tabId,
            });
          }
        }, 3000); // Wait 3 seconds for debounced discovery
      }
    } catch (error) {
      console.log(`Could not check tab ${tabId}:`, error);
    }
  }
});

/**
 * Handle tab removal
 */
chrome.tabs.onRemoved.addListener(async tabId => {
  if (isInitialized) {
    // Clean up timer for removed tab
    persistentAlarmManager.handleTabClosure(tabId);

    await addLogEntry({
      level: 'info',
      message: `Tab closed and timer cleaned up`,
      tabId: tabId,
    });
  }
});

// Initialize extension when service worker starts
initializeExtension();

/**
 * Performance Analysis Script for HeadHunter Resume Auto-Boost Extension
 * 
 * This script provides tools for analyzing performance and detecting memory leaks
 * in the Chrome extension during development and testing.
 */

class ExtensionPerformanceAnalyzer {
  constructor() {
    this.metrics = new Map();
    this.memorySnapshots = [];
    this.performanceObserver = null;
    this.isMonitoring = false;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting performance monitoring...');

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
            this.recordMetric('longTasks', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        }
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Long task monitoring not supported:', error);
      }
    }

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('Performance monitoring is not active');
      return;
    }

    this.isMonitoring = false;
    console.log('🛑 Stopping performance monitoring...');

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    this.stopMemoryMonitoring();
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.memoryInterval = setInterval(() => {
      this.takeMemorySnapshot();
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot() {
    if (!('memory' in performance)) {
      return null;
    }

    const snapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };

    this.memorySnapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }

    return snapshot;
  }

  /**
   * Analyze memory trends
   */
  analyzeMemoryTrends() {
    if (this.memorySnapshots.length < 2) {
      return {
        trend: 'insufficient_data',
        message: 'Need at least 2 memory snapshots for analysis'
      };
    }

    const recent = this.memorySnapshots.slice(-10); // Last 10 snapshots
    const increases = [];

    for (let i = 1; i < recent.length; i++) {
      const increase = recent[i].usedJSHeapSize - recent[i - 1].usedJSHeapSize;
      increases.push(increase);
    }

    const averageIncrease = increases.reduce((a, b) => a + b, 0) / increases.length;
    const totalIncrease = recent[recent.length - 1].usedJSHeapSize - recent[0].usedJSHeapSize;

    let trend = 'stable';
    let severity = 'low';

    if (averageIncrease > 1024 * 1024) { // 1MB average increase
      trend = 'increasing';
      severity = 'high';
    } else if (averageIncrease > 512 * 1024) { // 512KB average increase
      trend = 'increasing';
      severity = 'medium';
    } else if (averageIncrease > 0) {
      trend = 'slightly_increasing';
      severity = 'low';
    } else if (averageIncrease < -512 * 1024) {
      trend = 'decreasing';
      severity = 'low';
    }

    return {
      trend,
      severity,
      averageIncrease: averageIncrease / 1024 / 1024, // MB
      totalIncrease: totalIncrease / 1024 / 1024, // MB
      currentUsage: recent[recent.length - 1].usedJSHeapSize / 1024 / 1024, // MB
      utilization: (recent[recent.length - 1].usedJSHeapSize / recent[recent.length - 1].totalJSHeapSize) * 100
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Measure function execution time
   */
  measureFunction(fn, name) {
    return (...args) => {
      const startTime = performance.now();
      const result = fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric('functionExecutions', {
        name,
        duration,
        args: args.length
      });

      if (duration > 10) { // Log slow functions
        console.warn(`⚠️ Slow function: ${name} took ${duration.toFixed(2)}ms`);
      }

      return result;
    };
  }

  /**
   * Measure async function execution time
   */
  measureAsyncFunction(fn, name) {
    return async (...args) => {
      const startTime = performance.now();
      const result = await fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric('asyncFunctionExecutions', {
        name,
        duration,
        args: args.length
      });

      if (duration > 100) { // Log slow async functions
        console.warn(`⚠️ Slow async function: ${name} took ${duration.toFixed(2)}ms`);
      }

      return result;
    };
  }

  /**
   * Analyze DOM performance
   */
  analyzeDOMPerformance() {
    const startTime = performance.now();
    
    // Count DOM elements
    const totalElements = document.querySelectorAll('*').length;
    const bodyElements = document.body ? document.body.querySelectorAll('*').length : 0;
    
    // Test query performance
    const queryTests = [
      { name: 'getElementById', fn: () => document.getElementById('non-existent') },
      { name: 'querySelector', fn: () => document.querySelector('.non-existent') },
      { name: 'querySelectorAll', fn: () => document.querySelectorAll('div') },
      { name: 'getElementsByTagName', fn: () => document.getElementsByTagName('div') },
      { name: 'getElementsByClassName', fn: () => document.getElementsByClassName('non-existent') }
    ];

    const queryResults = {};
    
    queryTests.forEach(test => {
      const testStart = performance.now();
      for (let i = 0; i < 100; i++) {
        test.fn();
      }
      const testEnd = performance.now();
      queryResults[test.name] = (testEnd - testStart) / 100;
    });

    const totalTime = performance.now() - startTime;

    return {
      totalElements,
      bodyElements,
      queryPerformance: queryResults,
      analysisTime: totalTime,
      recommendations: this.getDOMRecommendations(totalElements, queryResults)
    };
  }

  /**
   * Get DOM performance recommendations
   */
  getDOMRecommendations(elementCount, queryResults) {
    const recommendations = [];

    if (elementCount > 5000) {
      recommendations.push('Consider reducing DOM complexity - high element count detected');
    }

    if (queryResults.querySelectorAll > 1) {
      recommendations.push('querySelectorAll performance is slow - consider caching results');
    }

    if (queryResults.querySelector > 0.5) {
      recommendations.push('querySelector performance is slow - consider using more specific selectors');
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const memoryAnalysis = this.analyzeMemoryTrends();
    const domAnalysis = this.analyzeDOMPerformance();
    
    const report = {
      timestamp: new Date().toISOString(),
      memory: memoryAnalysis,
      dom: domAnalysis,
      metrics: this.getMetricsSummary(),
      recommendations: this.getRecommendations(memoryAnalysis, domAnalysis)
    };

    console.log('📊 Performance Analysis Report:');
    console.table(report.memory);
    console.table(report.dom.queryPerformance);
    
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    return report;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary = {};
    
    for (const [name, data] of this.metrics) {
      if (data.length > 0) {
        const durations = data.map(d => d.duration).filter(d => d !== undefined);
        if (durations.length > 0) {
          summary[name] = {
            count: data.length,
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            maxDuration: Math.max(...durations),
            minDuration: Math.min(...durations)
          };
        } else {
          summary[name] = { count: data.length };
        }
      }
    }
    
    return summary;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(memoryAnalysis, domAnalysis) {
    const recommendations = [];

    // Memory recommendations
    if (memoryAnalysis.severity === 'high') {
      recommendations.push('🔴 High memory usage detected - investigate memory leaks');
    } else if (memoryAnalysis.severity === 'medium') {
      recommendations.push('🟡 Moderate memory increase - monitor for potential leaks');
    }

    if (memoryAnalysis.utilization > 80) {
      recommendations.push('🔴 High memory utilization - consider optimizing memory usage');
    }

    // DOM recommendations
    recommendations.push(...domAnalysis.recommendations);

    // Function performance recommendations
    const metrics = this.getMetricsSummary();
    if (metrics.functionExecutions && metrics.functionExecutions.averageDuration > 5) {
      recommendations.push('🟡 Some functions are running slowly - consider optimization');
    }

    if (metrics.longTasks && metrics.longTasks.count > 0) {
      recommendations.push('🔴 Long tasks detected - break up heavy operations');
    }

    return recommendations;
  }

  /**
   * Clear all collected data
   */
  clear() {
    this.metrics.clear();
    this.memorySnapshots = [];
    console.log('🧹 Performance data cleared');
  }
}

// Global instance for easy access
window.performanceAnalyzer = new ExtensionPerformanceAnalyzer();

// Auto-start monitoring in development
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
  const manifest = chrome.runtime.getManifest();
  if (manifest.name.includes('Development') || manifest.version.includes('dev')) {
    console.log('🔧 Development mode detected - starting performance monitoring');
    window.performanceAnalyzer.startMonitoring();
  }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionPerformanceAnalyzer;
} 
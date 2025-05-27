/**
 * Memory Leak Detector for HeadHunter Resume Auto-Boost Extension
 * 
 * This script provides specialized tools for detecting and preventing memory leaks
 * in Chrome extensions, focusing on common leak patterns.
 */

class ExtensionMemoryLeakDetector {
  constructor() {
    this.trackedObjects = new WeakMap();
    this.eventListeners = new Map();
    this.timers = new Set();
    this.observers = new Set();
    this.intervals = new Set();
    this.isTracking = false;
    this.leakWarnings = [];
  }

  /**
   * Start memory leak tracking
   */
  startTracking() {
    if (this.isTracking) {
      console.warn('Memory leak tracking is already active');
      return;
    }

    this.isTracking = true;
    console.log('🔍 Starting memory leak detection...');

    // Patch common leak sources
    this.patchEventListeners();
    this.patchTimers();
    this.patchObservers();
    this.patchChromeAPIs();

    // Start periodic leak detection
    this.startPeriodicChecks();
  }

  /**
   * Stop memory leak tracking
   */
  stopTracking() {
    if (!this.isTracking) {
      console.warn('Memory leak tracking is not active');
      return;
    }

    this.isTracking = false;
    console.log('🛑 Stopping memory leak detection...');

    this.stopPeriodicChecks();
    this.unpatchAll();
  }

  /**
   * Patch addEventListener to track event listeners
   */
  patchEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const detector = this;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      
      if (!detector.eventListeners.has(key)) {
        detector.eventListeners.set(key, new Set());
      }
      
      detector.eventListeners.get(key).add({
        target: this,
        type,
        listener,
        options,
        stack: new Error().stack
      });

      return originalAddEventListener.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      
      if (detector.eventListeners.has(key)) {
        const listeners = detector.eventListeners.get(key);
        for (const item of listeners) {
          if (item.target === this && item.listener === listener) {
            listeners.delete(item);
            break;
          }
        }
      }

      return originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  /**
   * Patch timer functions to track timers
   */
  patchTimers() {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;
    const detector = this;

    window.setTimeout = function(callback, delay, ...args) {
      const id = originalSetTimeout.call(this, callback, delay, ...args);
      detector.timers.add({
        id,
        type: 'timeout',
        delay,
        stack: new Error().stack,
        created: Date.now()
      });
      return id;
    };

    window.setInterval = function(callback, delay, ...args) {
      const id = originalSetInterval.call(this, callback, delay, ...args);
      detector.intervals.add({
        id,
        type: 'interval',
        delay,
        stack: new Error().stack,
        created: Date.now()
      });
      return id;
    };

    window.clearTimeout = function(id) {
      detector.timers.forEach(timer => {
        if (timer.id === id) {
          detector.timers.delete(timer);
        }
      });
      return originalClearTimeout.call(this, id);
    };

    window.clearInterval = function(id) {
      detector.intervals.forEach(interval => {
        if (interval.id === id) {
          detector.intervals.delete(interval);
        }
      });
      return originalClearInterval.call(this, id);
    };
  }

  /**
   * Patch MutationObserver to track observers
   */
  patchObservers() {
    const originalObserve = MutationObserver.prototype.observe;
    const originalDisconnect = MutationObserver.prototype.disconnect;
    const detector = this;

    MutationObserver.prototype.observe = function(target, options) {
      detector.observers.add({
        observer: this,
        target,
        options,
        stack: new Error().stack,
        created: Date.now()
      });
      return originalObserve.call(this, target, options);
    };

    MutationObserver.prototype.disconnect = function() {
      detector.observers.forEach(item => {
        if (item.observer === this) {
          detector.observers.delete(item);
        }
      });
      return originalDisconnect.call(this);
    };
  }

  /**
   * Patch Chrome APIs to track usage
   */
  patchChromeAPIs() {
    if (typeof chrome === 'undefined') return;

    // Track chrome.runtime.onMessage listeners
    if (chrome.runtime && chrome.runtime.onMessage) {
      const originalAddListener = chrome.runtime.onMessage.addListener;
      const originalRemoveListener = chrome.runtime.onMessage.removeListener;
      const detector = this;

      chrome.runtime.onMessage.addListener = function(listener) {
        detector.eventListeners.set('chrome.runtime.onMessage', 
          (detector.eventListeners.get('chrome.runtime.onMessage') || new Set()).add({
            listener,
            stack: new Error().stack,
            created: Date.now()
          })
        );
        return originalAddListener.call(this, listener);
      };

      chrome.runtime.onMessage.removeListener = function(listener) {
        const listeners = detector.eventListeners.get('chrome.runtime.onMessage');
        if (listeners) {
          listeners.forEach(item => {
            if (item.listener === listener) {
              listeners.delete(item);
            }
          });
        }
        return originalRemoveListener.call(this, listener);
      };
    }
  }

  /**
   * Start periodic leak checks
   */
  startPeriodicChecks() {
    this.checkInterval = setInterval(() => {
      this.performLeakCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop periodic leak checks
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform comprehensive leak check
   */
  performLeakCheck() {
    const warnings = [];

    // Check for excessive event listeners
    this.eventListeners.forEach((listeners, key) => {
      if (listeners.size > 50) {
        warnings.push({
          type: 'excessive_listeners',
          message: `Excessive event listeners detected for ${key}: ${listeners.size}`,
          count: listeners.size,
          key
        });
      }
    });

    // Check for long-running timers
    const now = Date.now();
    this.timers.forEach(timer => {
      const age = now - timer.created;
      if (age > 300000) { // 5 minutes
        warnings.push({
          type: 'long_running_timer',
          message: `Long-running timeout detected: ${age}ms old`,
          age,
          timer
        });
      }
    });

    // Check for excessive intervals
    if (this.intervals.size > 10) {
      warnings.push({
        type: 'excessive_intervals',
        message: `Excessive intervals detected: ${this.intervals.size}`,
        count: this.intervals.size
      });
    }

    // Check for unconnected observers
    this.observers.forEach(item => {
      const age = now - item.created;
      if (age > 600000) { // 10 minutes
        warnings.push({
          type: 'long_running_observer',
          message: `Long-running MutationObserver detected: ${age}ms old`,
          age,
          observer: item
        });
      }
    });

    // Check DOM node count
    const nodeCount = document.querySelectorAll('*').length;
    if (nodeCount > 10000) {
      warnings.push({
        type: 'excessive_dom_nodes',
        message: `Excessive DOM nodes detected: ${nodeCount}`,
        count: nodeCount
      });
    }

    // Report warnings
    if (warnings.length > 0) {
      console.warn('🚨 Memory leak warnings detected:');
      warnings.forEach(warning => {
        console.warn(`- ${warning.message}`);
      });
      this.leakWarnings.push(...warnings);
    }

    return warnings;
  }

  /**
   * Get detailed leak report
   */
  getLeakReport() {
    const report = {
      timestamp: new Date().toISOString(),
      eventListeners: this.getEventListenerReport(),
      timers: this.getTimerReport(),
      observers: this.getObserverReport(),
      dom: this.getDOMReport(),
      warnings: this.leakWarnings,
      recommendations: this.getRecommendations()
    };

    return report;
  }

  /**
   * Get event listener report
   */
  getEventListenerReport() {
    const report = {};
    this.eventListeners.forEach((listeners, key) => {
      report[key] = {
        count: listeners.size,
        listeners: Array.from(listeners).map(item => ({
          type: item.type,
          target: item.target.constructor.name,
          created: item.created || 'unknown'
        }))
      };
    });
    return report;
  }

  /**
   * Get timer report
   */
  getTimerReport() {
    return {
      timeouts: {
        count: this.timers.size,
        items: Array.from(this.timers).map(timer => ({
          id: timer.id,
          delay: timer.delay,
          age: Date.now() - timer.created
        }))
      },
      intervals: {
        count: this.intervals.size,
        items: Array.from(this.intervals).map(interval => ({
          id: interval.id,
          delay: interval.delay,
          age: Date.now() - interval.created
        }))
      }
    };
  }

  /**
   * Get observer report
   */
  getObserverReport() {
    return {
      count: this.observers.size,
      items: Array.from(this.observers).map(item => ({
        target: item.target.constructor.name,
        options: item.options,
        age: Date.now() - item.created
      }))
    };
  }

  /**
   * Get DOM report
   */
  getDOMReport() {
    const totalNodes = document.querySelectorAll('*').length;
    const bodyNodes = document.body ? document.body.querySelectorAll('*').length : 0;
    const headNodes = document.head ? document.head.querySelectorAll('*').length : 0;

    return {
      totalNodes,
      bodyNodes,
      headNodes,
      textNodes: this.countTextNodes(),
      orphanedNodes: this.findOrphanedNodes()
    };
  }

  /**
   * Count text nodes
   */
  countTextNodes() {
    const walker = document.createTreeWalker(
      document.body || document,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let count = 0;
    while (walker.nextNode()) {
      count++;
    }
    return count;
  }

  /**
   * Find potentially orphaned nodes
   */
  findOrphanedNodes() {
    const orphaned = [];
    const elements = document.querySelectorAll('*');
    
    elements.forEach(element => {
      // Check for elements with no parent (except html)
      if (!element.parentNode && element !== document.documentElement) {
        orphaned.push({
          tagName: element.tagName,
          id: element.id,
          className: element.className
        });
      }
    });

    return orphaned;
  }

  /**
   * Get recommendations based on detected issues
   */
  getRecommendations() {
    const recommendations = [];

    // Event listener recommendations
    this.eventListeners.forEach((listeners, key) => {
      if (listeners.size > 20) {
        recommendations.push(`Consider using event delegation for ${key} instead of multiple listeners`);
      }
    });

    // Timer recommendations
    if (this.timers.size > 20) {
      recommendations.push('Consider consolidating multiple timers into fewer, more efficient ones');
    }

    if (this.intervals.size > 5) {
      recommendations.push('Review interval usage - multiple intervals can impact performance');
    }

    // Observer recommendations
    if (this.observers.size > 5) {
      recommendations.push('Consider consolidating MutationObservers to reduce overhead');
    }

    // DOM recommendations
    const nodeCount = document.querySelectorAll('*').length;
    if (nodeCount > 5000) {
      recommendations.push('Consider reducing DOM complexity or implementing virtual scrolling');
    }

    return recommendations;
  }

  /**
   * Force cleanup of tracked resources
   */
  forceCleanup() {
    console.log('🧹 Forcing cleanup of tracked resources...');

    // Clear all tracked timers
    this.timers.forEach(timer => {
      clearTimeout(timer.id);
    });
    this.timers.clear();

    // Clear all tracked intervals
    this.intervals.forEach(interval => {
      clearInterval(interval.id);
    });
    this.intervals.clear();

    // Disconnect all tracked observers
    this.observers.forEach(item => {
      try {
        item.observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    this.observers.clear();

    console.log('✅ Forced cleanup completed');
  }

  /**
   * Unpatch all modified functions
   */
  unpatchAll() {
    // Note: In a real implementation, you would store original functions
    // and restore them here. For brevity, this is simplified.
    console.log('🔄 Unpatching modified functions...');
  }

  /**
   * Clear all tracking data
   */
  clear() {
    this.eventListeners.clear();
    this.timers.clear();
    this.intervals.clear();
    this.observers.clear();
    this.leakWarnings = [];
    console.log('🧹 Memory leak tracking data cleared');
  }
}

// Global instance for easy access
window.memoryLeakDetector = new ExtensionMemoryLeakDetector();

// Auto-start in development mode
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
  const manifest = chrome.runtime.getManifest();
  if (manifest.name.includes('Development') || manifest.version.includes('dev')) {
    console.log('🔧 Development mode detected - starting memory leak detection');
    window.memoryLeakDetector.startTracking();
  }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionMemoryLeakDetector;
} 
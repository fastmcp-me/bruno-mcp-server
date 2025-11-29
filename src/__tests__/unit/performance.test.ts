import { describe, test, expect, beforeEach } from 'vitest';

import { PerformanceManager, formatMetrics, formatCacheStats } from '../../performance.js';
import { createTestPerformanceManager } from '../setup/test-di-helpers.js';

let performanceManager: PerformanceManager;

beforeEach(() => {
  performanceManager = createTestPerformanceManager({
    performance: {
      cacheEnabled: true,
      cacheTTL: 5000, // 5 seconds for testing
      maxConcurrency: 10
    }
  });
});

describe('Performance', () => {
  describe('PerformanceManager', () => {
    test('should track metrics', () => {
      performanceManager.clearMetrics(); // Clear previous metrics

      performanceManager.recordMetric({ tool: 'test-tool', duration: 100, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'test-tool', duration: 200, success: true, timestamp: Date.now() });

      const summary = performanceManager.getMetricsSummary();

      expect(summary.totalExecutions).toBeGreaterThan(0);
      expect(summary.byTool['test-tool']).toBeDefined();
      expect(summary.byTool['test-tool'].count).toBe(2);
    });

    test('should calculate average execution time', () => {
      performanceManager.clearMetrics();

      performanceManager.recordMetric({ tool: 'avg-test', duration: 100, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'avg-test', duration: 200, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'avg-test', duration: 300, success: true, timestamp: Date.now() });

      const summary = performanceManager.getMetricsSummary();

      expect(summary.byTool['avg-test'].avgDuration).toBe(200);
    });

    test('should calculate success rate', () => {
      performanceManager.clearMetrics();

      performanceManager.recordMetric({ tool: 'success-test', duration: 100, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'success-test', duration: 200, success: false, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'success-test', duration: 300, success: true, timestamp: Date.now() });

      const summary = performanceManager.getMetricsSummary();

      // 2 out of 3 successful = 66.67%
      expect(summary.byTool['success-test'].successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Cache functionality', () => {
    test('should cache and retrieve request lists', () => {
      performanceManager.clearCache();

      const mockRequests = [
        { name: 'Get Users', method: 'GET', url: 'https://api.example.com/users' }
      ];

      performanceManager.cacheRequestList('/test/path', mockRequests as any);
      const cached = performanceManager.getCachedRequestList('/test/path');

      expect(cached).toEqual(mockRequests);
    });

    test('should return null for non-existent cache', () => {
      performanceManager.clearCache();

      const cached = performanceManager.getCachedRequestList('/nonexistent/path');

      expect(cached).toBeNull();
    });

    test('should cache collection discovery results', () => {
      performanceManager.clearCache();

      const mockCollections = ['/path/to/collection1', '/path/to/collection2'];

      performanceManager.cacheCollectionDiscovery('/search/path', mockCollections);
      const cached = performanceManager.getCachedCollectionDiscovery('/search/path');

      expect(cached).toEqual(mockCollections);
    });

    test('should cache environment lists', () => {
      performanceManager.clearCache();

      const mockEnvironments = [
        { name: 'dev', path: '/path/to/dev.bru' },
        { name: 'staging', path: '/path/to/staging.bru' }
      ];

      performanceManager.cacheEnvironmentList('/collection', mockEnvironments);
      const cached = performanceManager.getCachedEnvironmentList('/collection');

      expect(cached).toEqual(mockEnvironments);
    });

    test('should cache file content', () => {
      performanceManager.clearCache();

      const fileContent = 'test file content';

      performanceManager.cacheFileContent('/path/to/file.txt', fileContent);
      const cached = performanceManager.getCachedFileContent('/path/to/file.txt');

      expect(cached).toBe(fileContent);
    });

    test('should clear all caches', () => {

      performanceManager.cacheRequestList('/test', []);
      performanceManager.cacheCollectionDiscovery('/test', []);
      performanceManager.cacheEnvironmentList('/test', []);
      performanceManager.cacheFileContent('/test', 'content');

      performanceManager.clearCache();

      expect(performanceManager.getCachedRequestList('/test')).toBeNull();
      expect(performanceManager.getCachedCollectionDiscovery('/test')).toBeNull();
      expect(performanceManager.getCachedEnvironmentList('/test')).toBeNull();
      expect(performanceManager.getCachedFileContent('/test')).toBeNull();
    });
  });

  describe('formatMetrics()', () => {
    test('should format metrics summary', () => {
      performanceManager.clearMetrics();

      performanceManager.recordMetric({ tool: 'format-test', duration: 100, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'format-test', duration: 200, success: true, timestamp: Date.now() });

      const summary = performanceManager.getMetricsSummary();
      const formatted = formatMetrics(summary);

      expect(formatted).toContain('Performance Metrics');
      expect(formatted).toContain('format-test');
      expect(formatted).toContain('2'); // count
    });

    test('should handle empty metrics', () => {
      performanceManager.clearMetrics();

      const summary = performanceManager.getMetricsSummary();
      const formatted = formatMetrics(summary);

      expect(formatted).toContain('Performance Metrics');
      expect(formatted).toContain('0'); // total executions
    });
  });

  describe('formatCacheStats()', () => {
    test('should format cache statistics', () => {
      performanceManager.clearCache();

      // Add some cache entries
      performanceManager.cacheRequestList('/test1', []);

      const stats = performanceManager.getCacheStats();
      const formatted = formatCacheStats(stats);

      expect(formatted).toContain('Cache Statistics');
      expect(formatted).toContain('Request List Cache');
      expect(formatted).toContain('1 entries');
    });

    test('should show zero entries for empty caches', () => {
      performanceManager.clearCache();

      const stats = performanceManager.getCacheStats();
      const formatted = formatCacheStats(stats);

      expect(formatted).toContain('0 entries');
    });
  });

  describe('clearMetrics()', () => {
    test('should clear all recorded metrics', () => {

      performanceManager.recordMetric({ tool: 'clear-test', duration: 100, success: true, timestamp: Date.now() });
      performanceManager.recordMetric({ tool: 'clear-test', duration: 200, success: true, timestamp: Date.now() });

      let summary = performanceManager.getMetricsSummary();
      expect(summary.totalExecutions).toBeGreaterThan(0);

      performanceManager.clearMetrics();

      summary = performanceManager.getMetricsSummary();
      expect(summary.totalExecutions).toBe(0);
      expect(Object.keys(summary.byTool).length).toBe(0);
    });
  });
});

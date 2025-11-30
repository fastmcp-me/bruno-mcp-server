import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI, IConfigLoader, IPerformanceManager } from '../../../interfaces.js';
import { HealthCheckHandler } from '../../../tools/handlers/HealthCheckHandler.js';

describe('HealthCheckHandler', () => {
  let handler: HealthCheckHandler;
  let mockBrunoCLI: IBrunoCLI;
  let mockConfigLoader: IConfigLoader;
  let mockPerfManager: IPerformanceManager;

  beforeEach(() => {
    mockBrunoCLI = {
      isAvailable: vi.fn().mockResolvedValue(true),
      listRequests: vi.fn(),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn(),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    mockConfigLoader = {
      getConfig: vi.fn().mockReturnValue({
        logging: { level: 'info' },
        security: { maskSecrets: true },
        performance: { cacheEnabled: true, cacheTTL: 300000 }
      }),
      validateConfig: vi.fn()
    };

    mockPerfManager = {
      recordMetric: vi.fn(),
      getMetricsSummary: vi.fn().mockReturnValue({
        totalExecutions: 100,
        successRate: 95,
        averageDuration: 250,
        byTool: {}
      }),
      getCacheStats: vi.fn().mockReturnValue({
        requestList: { size: 10, keys: [] },
        collectionDiscovery: { size: 5, keys: [] },
        environmentList: { size: 3, keys: [] },
        fileContent: { size: 20, keys: [] }
      }),
      clearMetrics: vi.fn()
    };

    handler = new HealthCheckHandler(mockBrunoCLI, mockConfigLoader, mockPerfManager);
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_health_check');
  });

  test('should perform basic health check without optional flags', async () => {
    const result = await handler.handle({});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('Bruno MCP Server Health Check');
    expect((result.content[0] as any).text).toContain('Server Status: Running');
    expect(mockBrunoCLI.isAvailable).toHaveBeenCalled();
    expect(mockConfigLoader.getConfig).toHaveBeenCalled();
  });

  test('should include metrics when includeMetrics is true', async () => {
    const result = await handler.handle({ includeMetrics: true });

    expect(mockPerfManager.getMetricsSummary).toHaveBeenCalled();
    expect((result.content[0] as any).text).toContain('Performance Metrics');
  });

  test('should include cache stats when includeCacheStats is true', async () => {
    const result = await handler.handle({ includeCacheStats: true });

    expect(mockPerfManager.getCacheStats).toHaveBeenCalled();
    expect((result.content[0] as any).text).toContain('Cache Statistics');
  });

  test('should include both metrics and cache stats when both flags are true', async () => {
    const result = await handler.handle({
      includeMetrics: true,
      includeCacheStats: true
    });

    expect(mockPerfManager.getMetricsSummary).toHaveBeenCalled();
    expect(mockPerfManager.getCacheStats).toHaveBeenCalled();
    expect((result.content[0] as any).text).toContain('Performance Metrics');
    expect((result.content[0] as any).text).toContain('Cache Statistics');
  });

  test('should handle Bruno CLI unavailable status', async () => {
    mockBrunoCLI.isAvailable = vi.fn().mockResolvedValue(false);

    const result = await handler.handle({});

    expect((result.content[0] as any).text).toContain('Not Available');
  });

  test('should throw error for invalid parameters', async () => {
    await expect(handler.handle({ includeMetrics: 'invalid' })).rejects.toThrow();
  });

  test('should not call metrics/cache functions when flags are false', async () => {
    await handler.handle({
      includeMetrics: false,
      includeCacheStats: false
    });

    expect(mockPerfManager.getMetricsSummary).not.toHaveBeenCalled();
    expect(mockPerfManager.getCacheStats).not.toHaveBeenCalled();
  });

  test('should format health check output correctly', async () => {
    const result = await handler.handle({});
    const output = (result.content[0] as any).text;

    expect(output).toContain('=== Bruno MCP Server Health Check ===');
    expect(output).toContain('Bruno CLI');
    expect(output).toContain('Configuration');
  });
});

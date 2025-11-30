import { describe, test, expect } from 'vitest';

import type { BrunoMCPConfig } from '../../config.js';
import { HealthCheckFormatter } from '../../tools/formatters/HealthCheckFormatter.js';
import { RequestListFormatter } from '../../tools/formatters/RequestListFormatter.js';
import { RunResultFormatter } from '../../tools/formatters/RunResultFormatter.js';

describe('Formatters', () => {
  describe('HealthCheckFormatter', () => {
    const formatter = new HealthCheckFormatter();

    test('should format basic health check without optional data', () => {
      const data = {
        brunoCLIAvailable: true,
        brunoCLIVersion: '1.0.0',
        config: {
          logging: { level: 'info' },
          security: { maskSecrets: true },
          performance: { cacheEnabled: true, cacheTTL: 300000 }
        } as BrunoMCPConfig,
        includeMetrics: false,
        includeCacheStats: false
      };

      const result = formatter.format(data);

      expect(result).toContain('=== Bruno MCP Server Health Check ===');
      expect(result).toContain('Server Status: Running');
      expect(result).toContain('Status: Available');
      expect(result).toContain('Version: 1.0.0');
      expect(result).toContain('Logging Level: info');
      expect(result).toContain('All systems operational');
    });

    test('should handle Bruno CLI unavailable status', () => {
      const data = {
        brunoCLIAvailable: false,
        brunoCLIVersion: 'Unknown',
        config: {} as BrunoMCPConfig,
        includeMetrics: false,
        includeCacheStats: false
      };

      const result = formatter.format(data);

      expect(result).toContain('Status: Not Available');
      expect(result).toContain('Warning: Bruno CLI not available');
    });

    test('should format health check with metrics included', () => {
      const data = {
        brunoCLIAvailable: true,
        brunoCLIVersion: '1.0.0',
        config: {} as BrunoMCPConfig,
        includeMetrics: true,
        includeCacheStats: false,
        metricsSummary: {
          totalExecutions: 10,
          successRate: 90,
          averageDuration: 100,
          byTool: {
            'test-tool': { count: 10, avgDuration: 100, successRate: 90 }
          }
        }
      };

      const result = formatter.format(data);

      expect(result).toContain('Performance Metrics');
      expect(result).toContain('Total Executions: 10');
    });

    test('should format health check with cache stats included', () => {
      const data = {
        brunoCLIAvailable: true,
        brunoCLIVersion: '1.0.0',
        config: {} as BrunoMCPConfig,
        includeMetrics: false,
        includeCacheStats: true,
        cacheStats: {
          requestList: { size: 5, keys: ['/test1', '/test2'] },
          collectionDiscovery: { size: 2, keys: ['/search1'] },
          environmentList: { size: 1, keys: ['/env1'] },
          fileContent: { size: 3, keys: ['/file1', '/file2', '/file3'] }
        }
      };

      const result = formatter.format(data);

      expect(result).toContain('Cache Statistics');
      expect(result).toContain('Request List Cache');
    });

    test('should format health check with both metrics and cache stats', () => {
      const data = {
        brunoCLIAvailable: true,
        brunoCLIVersion: '1.0.0',
        config: {} as BrunoMCPConfig,
        includeMetrics: true,
        includeCacheStats: true,
        metricsSummary: {
          totalExecutions: 5,
          successRate: 100,
          averageDuration: 150,
          byTool: {}
        },
        cacheStats: {
          requestList: { size: 1, keys: [] },
          collectionDiscovery: { size: 0, keys: [] },
          environmentList: { size: 0, keys: [] },
          fileContent: { size: 0, keys: [] }
        }
      };

      const result = formatter.format(data);

      expect(result).toContain('Performance Metrics');
      expect(result).toContain('Cache Statistics');
    });

    test('should display configuration details correctly', () => {
      const data = {
        brunoCLIAvailable: true,
        brunoCLIVersion: '1.0.0',
        config: {
          logging: { level: 'debug' },
          retry: { enabled: true, maxAttempts: 3 },
          security: {
            allowedPaths: ['/path1', '/path2'],
            maskSecrets: true,
            secretPatterns: []
          },
          performance: { cacheEnabled: false, cacheTTL: 60000, maxConcurrency: 5 }
        } as BrunoMCPConfig,
        includeMetrics: false,
        includeCacheStats: false
      };

      const result = formatter.format(data);

      expect(result).toContain('Logging Level: debug');
      expect(result).toContain('Retry Enabled: Yes');
      expect(result).toContain('Yes (2 allowed paths)');
      expect(result).toContain('Secret Masking: Enabled');
      expect(result).toContain('Cache Enabled: No');
      expect(result).toContain('Cache TTL: 60000ms');
    });
  });

  describe('RequestListFormatter', () => {
    const formatter = new RequestListFormatter();

    test('should format empty request list', () => {
      const result = formatter.format([]);

      expect(result).toBe('No requests found in the collection.');
    });

    test('should format single request', () => {
      const requests = [
        { name: 'Get Users', method: 'GET', url: '/users', folder: null }
      ];

      const result = formatter.format(requests as any);

      expect(result).toContain('Found 1 request(s)');
      expect(result).toContain('• Get Users');
      expect(result).toContain('GET /users');
    });

    test('should format multiple requests without folders', () => {
      const requests = [
        { name: 'Get Users', method: 'GET', url: '/users', folder: null },
        { name: 'Create User', method: 'POST', url: '/users', folder: null },
        { name: 'Delete User', method: 'DELETE', url: '/users/1', folder: null }
      ];

      const result = formatter.format(requests as any);

      expect(result).toContain('Found 3 request(s)');
      expect(result).toContain('• Get Users');
      expect(result).toContain('GET /users');
      expect(result).toContain('• Create User');
      expect(result).toContain('POST /users');
      expect(result).toContain('• Delete User');
      expect(result).toContain('DELETE /users/1');
    });

    test('should format requests with folder hierarchy', () => {
      const requests = [
        { name: 'Get Users', method: 'GET', url: '/users', folder: 'api/users' },
        { name: 'Create User', method: 'POST', url: '/users', folder: 'api/users' }
      ];

      const result = formatter.format(requests as any);

      expect(result).toContain('• Get Users');
      expect(result).toContain('Folder: api/users');
      expect(result).toContain('• Create User');
    });

    test('should handle special characters in request names', () => {
      const requests = [
        { name: 'Get User (ID: 123)', method: 'GET', url: '/users/123', folder: null },
        { name: 'Update User – Admin', method: 'PUT', url: '/users', folder: null }
      ];

      const result = formatter.format(requests as any);

      expect(result).toContain('• Get User (ID: 123)');
      expect(result).toContain('• Update User – Admin');
    });
  });

  describe('RunResultFormatter', () => {
    const formatter = new RunResultFormatter();

    test('should format successful single request execution', () => {
      const result = {
        summary: {
          totalRequests: 1,
          passedRequests: 1,
          failedRequests: 0,
          totalDuration: 250
        },
        results: [
          {
            name: 'Get Users',
            passed: true,
            duration: 250,
            request: { method: 'GET', url: '/users' },
            response: {
              status: 200,
              statusText: 'OK',
              responseTime: 250,
              headers: { 'content-type': 'application/json' },
              body: { users: [] }
            }
          }
        ]
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('=== Execution Summary ===');
      expect(formatted).toContain('Total Requests: 1');
      expect(formatted).toContain('Passed: 1');
      expect(formatted).toContain('Failed: 0');
      expect(formatted).toContain('[✓] Get Users');
      expect(formatted).toContain('Request: GET /users');
      expect(formatted).toContain('Status: 200 OK');
      expect(formatted).toContain('Duration: 250ms');
    });

    test('should format failed request with error details', () => {
      const result = {
        summary: {
          totalRequests: 1,
          passedRequests: 0,
          failedRequests: 1,
          totalDuration: 100
        },
        results: [
          {
            name: 'Create User',
            passed: false,
            duration: 100,
            request: { method: 'POST', url: '/users' },
            response: {
              status: 400,
              statusText: 'Bad Request',
              responseTime: 100,
              headers: {},
              body: { error: 'Invalid data' }
            },
            error: 'Request failed with status 400'
          }
        ]
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('[✗] Create User');
      expect(formatted).toContain('Status: 400 Bad Request');
      expect(formatted).toContain('Error: Request failed with status 400');
    });

    test('should truncate long response bodies', () => {
      const longBody = 'x'.repeat(3000);
      const result = {
        summary: { totalRequests: 1, passedRequests: 1, failedRequests: 0, totalDuration: 100 },
        results: [
          {
            name: 'Get Data',
            passed: true,
            duration: 100,
            request: { method: 'GET', url: '/data' },
            response: {
              status: 200,
              statusText: 'OK',
              responseTime: 100,
              headers: {},
              body: longBody
            }
          }
        ]
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('Response Body:');
      expect(formatted).toContain('[Truncated - 3000 total characters]');
      expect(formatted).not.toContain(longBody);
    });

    test('should prioritize important headers', () => {
      const result = {
        summary: { totalRequests: 1, passedRequests: 1, failedRequests: 0, totalDuration: 100 },
        results: [
          {
            name: 'Get Users',
            passed: true,
            duration: 100,
            request: { method: 'GET', url: '/users' },
            response: {
              status: 200,
              statusText: 'OK',
              responseTime: 100,
              headers: {
                'content-type': 'application/json',
                'content-length': '1234',
                'date': '2024-01-01',
                'server': 'nginx',
                'x-custom-header': 'value'
              },
              body: {}
            }
          }
        ]
      };

      const formatted = formatter.format(result as any);
      const lines = formatted.split('\n');

      // Find the header section
      const headerIndex = lines.findIndex(l => l.includes('Response Headers:'));
      expect(headerIndex).toBeGreaterThan(-1);

      // Check that important headers appear first
      const headerLines = lines.slice(headerIndex + 1, headerIndex + 6);
      expect(headerLines[0]).toContain('content-type');
      expect(headerLines[1]).toContain('content-length');
    });

    test('should format assertions with pass/fail indicators', () => {
      const result = {
        summary: { totalRequests: 1, passedRequests: 0, failedRequests: 1, totalDuration: 100 },
        results: [
          {
            name: 'Test API',
            passed: false,
            duration: 100,
            request: { method: 'GET', url: '/api' },
            response: { status: 200, statusText: 'OK', responseTime: 100, headers: {}, body: {} },
            assertions: [
              { name: 'Status is 200', passed: true },
              { name: 'Response time < 100ms', passed: false, error: 'Expected < 100, got 150' }
            ]
          }
        ]
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('Assertions:');
      expect(formatted).toContain('✓ Status is 200');
      expect(formatted).toContain('✗ Response time < 100ms');
      expect(formatted).toContain('Error: Expected < 100, got 150');
    });

    test('should handle missing structured data (fallback to raw output)', () => {
      const result = {
        stdout: 'Raw CLI output here\nSome execution details',
        stderr: 'Warning: something happened',
        exitCode: 0
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('=== Raw Output ===');
      expect(formatted).toContain('Raw CLI output here');
      expect(formatted).toContain('=== Errors ===');
      expect(formatted).toContain('Warning: something happened');
    });

    test('should format report file paths when generated', () => {
      const result = {
        summary: { totalRequests: 1, passedRequests: 1, failedRequests: 0, totalDuration: 100 },
        results: [
          {
            name: 'Test',
            passed: true,
            duration: 100,
            request: { method: 'GET', url: '/test' },
            response: { status: 200, statusText: 'OK', responseTime: 100, headers: {}, body: {} }
          }
        ],
        stdout: 'Execution complete\nWrote json report to /path/to/report.json\nWrote html report to /path/to/report.html'
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('=== Generated Reports ===');
      expect(formatted).toContain('Wrote json report');
      expect(formatted).toContain('Wrote html report');
    });

    test('should handle empty results gracefully', () => {
      const result = {
        summary: { totalRequests: 0, passedRequests: 0, failedRequests: 0, totalDuration: 0 },
        results: []
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('Total Requests: 0');
      expect(formatted).toContain('Passed: 0');
    });

    test('should format collection summary with multiple requests', () => {
      const result = {
        summary: {
          totalRequests: 3,
          passedRequests: 2,
          failedRequests: 1,
          totalDuration: 500
        },
        results: [
          {
            name: 'Request 1',
            passed: true,
            duration: 100,
            status: 200
          },
          {
            name: 'Request 2',
            passed: true,
            duration: 200,
            status: 200
          },
          {
            name: 'Request 3',
            passed: false,
            duration: 200,
            status: 500,
            error: 'Internal server error'
          }
        ]
      };

      const formatted = formatter.format(result as any);

      expect(formatted).toContain('Total Requests: 3');
      expect(formatted).toContain('Passed: 2');
      expect(formatted).toContain('Failed: 1');
      expect(formatted).toContain('Duration: 500ms');
      expect(formatted).toContain('[✓] Request 1');
      expect(formatted).toContain('[✓] Request 2');
      expect(formatted).toContain('[✗] Request 3');
    });
  });
});

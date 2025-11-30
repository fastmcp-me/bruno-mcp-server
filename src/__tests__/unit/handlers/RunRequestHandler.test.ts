import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { RunRequestHandler } from '../../../tools/handlers/RunRequestHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    logSecurityEvent: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('RunRequestHandler', () => {
  let handler: RunRequestHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockRunResult = {
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
    ],
    exitCode: 0,
    stdout: 'Execution completed',
    stderr: ''
  };

  const mockRequestDetails = {
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    auth: 'bearer',
    headers: { 'Content-Type': 'application/json' },
    tests: [],
    metadata: { type: 'http', seq: 1 }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn(),
      listEnvironments: vi.fn(),
      runRequest: vi.fn().mockResolvedValue(mockRunResult),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn().mockResolvedValue(mockRequestDetails),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    handler = new RunRequestHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_run_request');
  });

  test('should run request successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection',
      requestName: 'Get Users'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection',
      requestName: 'Get Users',
      envVariables: undefined
    });
    expect(mockBrunoCLI.runRequest).toHaveBeenCalledWith(
      '/valid/path/to/collection',
      'Get Users',
      {
        environment: undefined,
        envVariables: undefined,
        reporterJson: undefined,
        reporterJunit: undefined,
        reporterHtml: undefined
      }
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });

  test('should pass environment parameter', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      environment: 'dev'
    });

    expect(mockBrunoCLI.runRequest).toHaveBeenCalledWith(
      '/valid/path',
      'Get Users',
      expect.objectContaining({ environment: 'dev' })
    );
  });

  test('should handle enviroment typo alias', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      enviroment: 'staging'
    });

    expect(mockBrunoCLI.runRequest).toHaveBeenCalledWith(
      '/valid/path',
      'Get Users',
      expect.objectContaining({ environment: 'staging' })
    );
  });

  test('should pass environment variables', async () => {
    const envVars = { API_URL: 'http://localhost:3000', API_KEY: 'test-key' };

    await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      envVariables: envVars
    });

    expect(mockBrunoCLI.runRequest).toHaveBeenCalledWith(
      '/valid/path',
      'Get Users',
      expect.objectContaining({ envVariables: envVars })
    );
  });

  test('should pass reporter parameters', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      reporterJson: '/output/report.json',
      reporterHtml: '/output/report.html',
      reporterJunit: '/output/report.xml'
    });

    expect(mockBrunoCLI.runRequest).toHaveBeenCalledWith(
      '/valid/path',
      'Get Users',
      expect.objectContaining({
        reporterJson: '/output/report.json',
        reporterHtml: '/output/report.html',
        reporterJunit: '/output/report.xml'
      })
    );
  });

  test('should handle dry run mode', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      dryRun: true
    });

    expect(mockBrunoCLI.runRequest).not.toHaveBeenCalled();
    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledWith('/valid/path', 'Get Users');

    const output = (result.content[0] as any).text;
    expect(output).toContain('DRY RUN');
    expect(output).toContain('Request validated successfully');
    expect(output).toContain('HTTP call not executed');
  });

  test('should display request info in dry run', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      dryRun: true
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Request: Get Users');
    expect(output).toContain('Method: GET');
    expect(output).toContain('URL: https://api.example.com/users');
  });

  test('should show environment in dry run output', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      dryRun: true,
      environment: 'dev'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Environment: dev');
  });

  test('should show env variables count in dry run output', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users',
      dryRun: true,
      envVariables: { API_URL: 'test', API_KEY: 'test' }
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Environment Variables: 2 provided');
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid collection path'],
      warnings: []
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path', requestName: 'Test' })
    ).rejects.toThrow(McpError);

    expect(security.logSecurityEvent).toHaveBeenCalledWith({
      type: 'access_denied',
      details: expect.stringContaining('Invalid collection path'),
      severity: 'error'
    });
  });

  test('should log warnings when validation has warnings', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: [],
      warnings: ['Suspicious environment variable detected']
    });

    await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    expect(security.logSecurityEvent).toHaveBeenCalledWith({
      type: 'env_var_validation',
      details: 'Suspicious environment variable detected',
      severity: 'warning'
    });
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.runRequest = vi.fn().mockRejectedValue(
      new Error('Request execution failed')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path', requestName: 'Test' })
    ).rejects.toThrow('Request execution failed');
  });

  test('should handle dry run validation failure', async () => {
    mockBrunoCLI.getRequestDetails = vi.fn().mockRejectedValue(
      new Error('Request not found')
    );

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        requestName: 'NonExistent',
        dryRun: true
      })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        requestName: 'NonExistent',
        dryRun: true
      })
    ).rejects.toThrow('Dry run validation failed');
  });

  test('should call maskSecretsInError on dry run errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.getRequestDetails = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        requestName: 'Test',
        dryRun: true
      })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should throw error for missing required parameters', async () => {
    await expect(handler.handle({})).rejects.toThrow();
    await expect(handler.handle({ collectionPath: '/path' })).rejects.toThrow();
    await expect(handler.handle({ requestName: 'Test' })).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(
      handler.handle({ collectionPath: 123, requestName: 'Test' })
    ).rejects.toThrow();
    await expect(
      handler.handle({ collectionPath: '/path', requestName: 123 })
    ).rejects.toThrow();
  });
});

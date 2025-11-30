import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { BrunoRequest, IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { RunCollectionHandler } from '../../../tools/handlers/RunCollectionHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    logSecurityEvent: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('RunCollectionHandler', () => {
  let handler: RunCollectionHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockRunResult = {
    summary: {
      totalRequests: 3,
      passedRequests: 2,
      failedRequests: 1,
      totalDuration: 750
    },
    results: [
      {
        name: 'Request 1',
        passed: true,
        duration: 250,
        status: 200
      },
      {
        name: 'Request 2',
        passed: true,
        duration: 300,
        status: 200
      },
      {
        name: 'Request 3',
        passed: false,
        duration: 200,
        status: 500,
        error: 'Internal server error'
      }
    ],
    exitCode: 1,
    stdout: 'Execution completed with errors',
    stderr: ''
  };

  const mockRequests: BrunoRequest[] = [
    {
      name: 'Request 1',
      method: 'GET',
      url: '/api/v1',
      folder: 'folder1',
      filePath: '/test/folder1/request1.bru'
    },
    {
      name: 'Request 2',
      method: 'POST',
      url: '/api/v2',
      folder: 'folder2',
      filePath: '/test/folder2/request2.bru'
    },
    {
      name: 'Request 3',
      method: 'GET',
      url: '/api/v3',
      folder: null,
      filePath: '/test/request3.bru'
    }
  ];

  const mockRequestDetails = {
    name: 'Request 1',
    method: 'GET',
    url: '/api/v1',
    auth: 'none',
    headers: {},
    metadata: { type: 'http', seq: 1 }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn().mockResolvedValue(mockRequests),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn().mockResolvedValue(mockRunResult),
      getRequestDetails: vi.fn().mockResolvedValue(mockRequestDetails),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    handler = new RunCollectionHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_run_collection');
  });

  test('should run collection successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection',
      folderPath: undefined,
      envVariables: undefined
    });
    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path/to/collection',
      {
        environment: undefined,
        folderPath: undefined,
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
      environment: 'prod'
    });

    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path',
      expect.objectContaining({ environment: 'prod' })
    );
  });

  test('should handle enviroment typo alias', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      enviroment: 'staging'
    });

    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path',
      expect.objectContaining({ environment: 'staging' })
    );
  });

  test('should pass folderPath parameter', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      folderPath: 'api/v1'
    });

    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path',
      expect.objectContaining({ folderPath: 'api/v1' })
    );
  });

  test('should pass environment variables', async () => {
    const envVars = { API_URL: 'http://localhost:3000' };

    await handler.handle({
      collectionPath: '/valid/path',
      envVariables: envVars
    });

    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path',
      expect.objectContaining({ envVariables: envVars })
    );
  });

  test('should pass reporter parameters', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      reporterJson: '/output/report.json',
      reporterHtml: '/output/report.html',
      reporterJunit: '/output/report.xml'
    });

    expect(mockBrunoCLI.runCollection).toHaveBeenCalledWith(
      '/valid/path',
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
      dryRun: true
    });

    expect(mockBrunoCLI.runCollection).not.toHaveBeenCalled();
    expect(mockBrunoCLI.listRequests).toHaveBeenCalledWith('/valid/path');

    const output = (result.content[0] as any).text;
    expect(output).toContain('DRY RUN');
    expect(output).toContain('Collection validated successfully');
    expect(output).toContain('HTTP calls not executed');
  });

  test('should display collection info in dry run', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      dryRun: true
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Total Requests: 3');
    expect(output).toContain('Request 1');
    expect(output).toContain('Request 2');
    expect(output).toContain('Request 3');
  });

  test('should filter requests by folder in dry run', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      folderPath: 'folder1',
      dryRun: true
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Total Requests: 1');
    expect(output).toContain('Request 1');
    expect(output).not.toContain('Request 2');
    expect(output).not.toContain('Request 3');
    expect(output).toContain('Folder Filter: folder1');
  });

  test('should show environment in dry run output', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      dryRun: true,
      environment: 'dev'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Environment: dev');
  });

  test('should show env variables count in dry run output', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      dryRun: true,
      envVariables: { VAR1: 'value1', VAR2: 'value2' }
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Environment Variables: 2 provided');
  });

  test('should validate each request in dry run', async () => {
    await handler.handle({
      collectionPath: '/valid/path',
      dryRun: true
    });

    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledTimes(3);
    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledWith('/valid/path', 'Request 1');
    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledWith('/valid/path', 'Request 2');
    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledWith('/valid/path', 'Request 3');
  });

  test('should handle request validation errors in dry run', async () => {
    mockBrunoCLI.getRequestDetails = vi.fn()
      .mockResolvedValueOnce(mockRequestDetails)
      .mockRejectedValueOnce(new Error('Invalid request'))
      .mockResolvedValueOnce(mockRequestDetails);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      dryRun: true
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('✓ Request 1');
    expect(output).toContain('✗ Request 2');
    expect(output).toContain('Validation error');
    expect(output).toContain('✓ Request 3');
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid collection path'],
      warnings: []
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path' })
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
      warnings: ['Suspicious folder path detected', 'Another warning']
    });

    await handler.handle({
      collectionPath: '/valid/path'
    });

    expect(security.logSecurityEvent).toHaveBeenCalledTimes(2);
    expect(security.logSecurityEvent).toHaveBeenCalledWith({
      type: 'env_var_validation',
      details: 'Suspicious folder path detected',
      severity: 'warning'
    });
    expect(security.logSecurityEvent).toHaveBeenCalledWith({
      type: 'env_var_validation',
      details: 'Another warning',
      severity: 'warning'
    });
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.runCollection = vi.fn().mockRejectedValue(
      new Error('Collection execution failed')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow('Collection execution failed');
  });

  test('should handle dry run failure', async () => {
    mockBrunoCLI.listRequests = vi.fn().mockRejectedValue(
      new Error('Failed to list requests')
    );

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        dryRun: true
      })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        dryRun: true
      })
    ).rejects.toThrow('Dry run validation failed');
  });

  test('should call maskSecretsInError on dry run errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.listRequests = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({
        collectionPath: '/valid/path',
        dryRun: true
      })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should throw error for missing collectionPath parameter', async () => {
    await expect(handler.handle({})).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(handler.handle({ collectionPath: 123 })).rejects.toThrow();
    await expect(
      handler.handle({ collectionPath: '/path', folderPath: 123 })
    ).rejects.toThrow();
  });

  test('should handle collection with all requests in folders', async () => {
    const requestsInFolders: BrunoRequest[] = [
      { name: 'R1', method: 'GET', url: '/1', folder: 'folder1', filePath: '/f1/r1.bru' },
      { name: 'R2', method: 'GET', url: '/2', folder: 'folder1', filePath: '/f1/r2.bru' }
    ];

    mockBrunoCLI.listRequests = vi.fn().mockResolvedValue(requestsInFolders);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      folderPath: 'folder1',
      dryRun: true
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Total Requests: 2');
  });
});

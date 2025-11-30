import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { BrunoRequest, IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { ListRequestsHandler } from '../../../tools/handlers/ListRequestsHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    logSecurityEvent: vi.fn()
  };
});

describe('ListRequestsHandler', () => {
  let handler: ListRequestsHandler;
  let mockBrunoCLI: IBrunoCLI;
  const mockRequests: BrunoRequest[] = [
    {
      name: 'Get Users',
      method: 'GET',
      url: 'https://api.example.com/users',
      folder: null,
      filePath: '/test/collection/Get Users.bru'
    },
    {
      name: 'Create User',
      method: 'POST',
      url: 'https://api.example.com/users',
      folder: 'users',
      filePath: '/test/collection/users/Create User.bru'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn().mockResolvedValue(mockRequests),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn(),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    handler = new ListRequestsHandler(mockBrunoCLI);

    // Default: validation passes
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_list_requests');
  });

  test('should list requests successfully with valid collection path', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection'
    });
    expect(mockBrunoCLI.listRequests).toHaveBeenCalledWith('/valid/path/to/collection');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('Get Users');
    expect((result.content[0] as any).text).toContain('Create User');
  });

  test('should throw McpError when security validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Path outside allowed directories']
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ collectionPath: '/invalid/path' })
    ).rejects.toThrow('Security validation failed');

    expect(security.logSecurityEvent).toHaveBeenCalledWith({
      type: 'access_denied',
      details: expect.stringContaining('Path outside allowed directories'),
      severity: 'error'
    });
  });

  test('should throw error for missing collection path parameter', async () => {
    await expect(handler.handle({})).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(handler.handle({ collectionPath: 123 })).rejects.toThrow();
    await expect(handler.handle({ collectionPath: null })).rejects.toThrow();
    await expect(handler.handle({ collectionPath: undefined })).rejects.toThrow();
  });

  test('should format empty request list correctly', async () => {
    mockBrunoCLI.listRequests = vi.fn().mockResolvedValue([]);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).toContain('No requests found');
  });

  test('should handle requests with folder hierarchy', async () => {
    const requestsWithFolders: BrunoRequest[] = [
      {
        name: 'Request 1',
        method: 'GET',
        url: '/api/v1',
        folder: 'api/v1/users',
        filePath: '/test.bru'
      }
    ];

    mockBrunoCLI.listRequests = vi.fn().mockResolvedValue(requestsWithFolders);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).toContain('Request 1');
    expect((result.content[0] as any).text).toContain('Folder: api/v1/users');
  });

  test('should call security validation before listing requests', async () => {
    await handler.handle({ collectionPath: '/test/path' });

    expect(security.validateToolParameters).toHaveBeenCalledBefore(
      mockBrunoCLI.listRequests as any
    );
  });

  test('should propagate Bruno CLI errors', async () => {
    mockBrunoCLI.listRequests = vi.fn().mockRejectedValue(
      new Error('Collection not found')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow('Collection not found');
  });

  test('should handle multiple validation errors', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid path format', 'Path contains dangerous characters']
    });

    await expect(
      handler.handle({ collectionPath: '/bad/path' })
    ).rejects.toThrow('Invalid path format, Path contains dangerous characters');
  });
});

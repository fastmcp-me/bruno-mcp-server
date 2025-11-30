import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { DiscoverCollectionsHandler } from '../../../tools/handlers/DiscoverCollectionsHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('DiscoverCollectionsHandler', () => {
  let handler: DiscoverCollectionsHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockCollections = [
    '/home/user/projects/api-tests',
    '/home/user/projects/integration-tests',
    '/home/user/workspace/my-collection'
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn(),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn(),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn(),
      discoverCollections: vi.fn().mockResolvedValue(mockCollections)
    };

    handler = new DiscoverCollectionsHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_discover_collections');
  });

  test('should discover collections successfully', async () => {
    const result = await handler.handle({
      searchPath: '/home/user/projects'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/home/user/projects'
    });
    expect(mockBrunoCLI.discoverCollections).toHaveBeenCalledWith('/home/user/projects', 5);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('Found 3 Bruno collection(s)');
  });

  test('should list all discovered collections', async () => {
    const result = await handler.handle({
      searchPath: '/home/user/projects'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('/home/user/projects/api-tests');
    expect(output).toContain('/home/user/projects/integration-tests');
    expect(output).toContain('/home/user/workspace/my-collection');
  });

  test('should use default maxDepth of 5 when not specified', async () => {
    await handler.handle({
      searchPath: '/home/user/projects'
    });

    expect(mockBrunoCLI.discoverCollections).toHaveBeenCalledWith(
      '/home/user/projects',
      5
    );
  });

  test('should use custom maxDepth when specified', async () => {
    await handler.handle({
      searchPath: '/home/user/projects',
      maxDepth: 10
    });

    expect(mockBrunoCLI.discoverCollections).toHaveBeenCalledWith(
      '/home/user/projects',
      10
    );
  });

  test('should handle empty results gracefully', async () => {
    mockBrunoCLI.discoverCollections = vi.fn().mockResolvedValue([]);

    const result = await handler.handle({
      searchPath: '/empty/directory'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('No Bruno collections found');
    expect(output).toContain('A Bruno collection is a directory containing a bruno.json file');
  });

  test('should number collections in output', async () => {
    const result = await handler.handle({
      searchPath: '/home/user/projects'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('1. /home/user/projects/api-tests');
    expect(output).toContain('2. /home/user/projects/integration-tests');
    expect(output).toContain('3. /home/user/workspace/my-collection');
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid search path']
    });

    await expect(
      handler.handle({ searchPath: '/invalid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ searchPath: '/invalid/path' })
    ).rejects.toThrow('Invalid search path');
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.discoverCollections = vi.fn().mockRejectedValue(
      new Error('Permission denied')
    );

    await expect(
      handler.handle({ searchPath: '/valid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ searchPath: '/valid/path' })
    ).rejects.toThrow('Failed to discover collections');
  });

  test('should call maskSecretsInError on errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.discoverCollections = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({ searchPath: '/valid/path' })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should throw error for missing searchPath parameter', async () => {
    await expect(handler.handle({})).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(handler.handle({ searchPath: 123 })).rejects.toThrow();
    await expect(handler.handle({ searchPath: null })).rejects.toThrow();
    await expect(
      handler.handle({ searchPath: '/valid/path', maxDepth: 'invalid' })
    ).rejects.toThrow();
  });

  test('should handle single collection found', async () => {
    mockBrunoCLI.discoverCollections = vi.fn().mockResolvedValue(['/home/user/single-collection']);

    const result = await handler.handle({
      searchPath: '/home/user'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Found 1 Bruno collection(s)');
    expect(output).toContain('1. /home/user/single-collection');
  });
});

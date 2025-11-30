import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { ValidateCollectionHandler } from '../../../tools/handlers/ValidateCollectionHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('ValidateCollectionHandler', () => {
  let handler: ValidateCollectionHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockValidResult = {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      hasBrunoJson: true,
      totalRequests: 10,
      validRequests: 10,
      invalidRequests: 0,
      environments: 3
    }
  };

  const mockInvalidResult = {
    valid: false,
    errors: ['Missing bruno.json', 'Invalid request syntax in Get Users.bru'],
    warnings: ['Unused environment variable'],
    summary: {
      hasBrunoJson: false,
      totalRequests: 5,
      validRequests: 3,
      invalidRequests: 2,
      environments: 0
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn(),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn(),
      validateCollection: vi.fn().mockResolvedValue(mockValidResult),
      validateEnvironment: vi.fn()
    };

    handler = new ValidateCollectionHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_validate_collection');
  });

  test('should validate a valid collection successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection'
    });
    expect(mockBrunoCLI.validateCollection).toHaveBeenCalledWith('/valid/path/to/collection');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('✅ Collection is valid');
    expect((result.content[0] as any).text).toContain('🎉 Collection is ready to use!');
  });

  test('should display validation summary correctly', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('bruno.json: ✓ Found');
    expect(output).toContain('Total Requests: 10');
    expect(output).toContain('Valid Requests: 10');
    expect(output).toContain('Invalid Requests: 0');
    expect(output).toContain('Environments: 3');
  });

  test('should handle invalid collection with errors', async () => {
    mockBrunoCLI.validateCollection = vi.fn().mockResolvedValue(mockInvalidResult);

    const result = await handler.handle({
      collectionPath: '/invalid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('❌ Collection has errors');
    expect(output).toContain('bruno.json: ✗ Missing');
    expect(output).toContain('Missing bruno.json');
    expect(output).toContain('Invalid request syntax');
    expect(output).not.toContain('🎉 Collection is ready to use!');
  });

  test('should display warnings when present', async () => {
    const resultWithWarnings = {
      ...mockValidResult,
      warnings: ['Unused environment variable: OLD_API', 'Deprecated syntax in request']
    };

    mockBrunoCLI.validateCollection = vi.fn().mockResolvedValue(resultWithWarnings);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Warnings:');
    expect(output).toContain('⚠️  Unused environment variable');
    expect(output).toContain('⚠️  Deprecated syntax');
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid collection path']
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ collectionPath: '/invalid/path' })
    ).rejects.toThrow('Invalid collection path');
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.validateCollection = vi.fn().mockRejectedValue(
      new Error('Collection not found')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow('Failed to validate collection');
  });

  test('should call maskSecretsInError on errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.validateCollection = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should show success message for valid collection without warnings', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).toContain('🎉 Collection is ready to use!');
  });

  test('should not show success message for valid collection with warnings', async () => {
    const resultWithWarnings = {
      ...mockValidResult,
      warnings: ['Some warning']
    };

    mockBrunoCLI.validateCollection = vi.fn().mockResolvedValue(resultWithWarnings);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).not.toContain('🎉 Collection is ready to use!');
  });

  test('should throw error for missing collectionPath parameter', async () => {
    await expect(handler.handle({})).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(handler.handle({ collectionPath: 123 })).rejects.toThrow();
    await expect(handler.handle({ collectionPath: null })).rejects.toThrow();
  });
});

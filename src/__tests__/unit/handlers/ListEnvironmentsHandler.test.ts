import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { ListEnvironmentsHandler } from '../../../tools/handlers/ListEnvironmentsHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('ListEnvironmentsHandler', () => {
  let handler: ListEnvironmentsHandler;
  let mockBrunoCLI: IBrunoCLI;
  const mockEnvironments = [
    {
      name: 'dev',
      path: '/path/to/dev.bru',
      variables: {
        API_URL: 'http://localhost:3000',
        API_KEY: 'dev-secret-key'
      }
    },
    {
      name: 'prod',
      path: '/path/to/prod.bru',
      variables: {
        API_URL: 'https://api.example.com',
        TOKEN: 'prod-token-123'
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn(),
      listEnvironments: vi.fn().mockResolvedValue(mockEnvironments),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn(),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    handler = new ListEnvironmentsHandler(mockBrunoCLI);

    // Default: validation passes
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_list_environments');
  });

  test('should list environments successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection'
    });
    expect(mockBrunoCLI.listEnvironments).toHaveBeenCalledWith('/valid/path/to/collection');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('Found 2 environment(s)');
    expect((result.content[0] as any).text).toContain('dev');
    expect((result.content[0] as any).text).toContain('prod');
  });

  test('should mask secrets in environment variables', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;

    // Should mask API_KEY and TOKEN
    expect(output).toContain('API_KEY: ***');
    expect(output).toContain('TOKEN: ***');
    // Should show API_URL since it's not a secret
    expect(output).toContain('API_URL: http://localhost:3000');
  });

  test('should handle empty environment list', async () => {
    mockBrunoCLI.listEnvironments = vi.fn().mockResolvedValue([]);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).toContain('No environments found');
    expect((result.content[0] as any).text).toContain('environments" directory');
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

  test('should display variable count for each environment', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Variables: 2');
  });

  test('should limit variable preview to first 3 variables', async () => {
    const envWithManyVars = [
      {
        name: 'staging',
        path: '/path/to/staging.bru',
        variables: {
          VAR1: 'value1',
          VAR2: 'value2',
          VAR3: 'value3',
          VAR4: 'value4',
          VAR5: 'value5'
        }
      }
    ];

    mockBrunoCLI.listEnvironments = vi.fn().mockResolvedValue(envWithManyVars);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('... and 2 more');
  });

  test('should truncate long variable values', async () => {
    const envWithLongValue = [
      {
        name: 'test',
        path: '/path/to/test.bru',
        variables: {
          LONG_VALUE: 'a'.repeat(100)
        }
      }
    ];

    mockBrunoCLI.listEnvironments = vi.fn().mockResolvedValue(envWithLongValue);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('...');
    expect(output).not.toContain('a'.repeat(100));
  });

  test('should handle environments without variables', async () => {
    const envWithoutVars = [
      {
        name: 'empty',
        path: '/path/to/empty.bru',
        variables: {}
      }
    ];

    mockBrunoCLI.listEnvironments = vi.fn().mockResolvedValue(envWithoutVars);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('empty');
  });

  test('should mask variables containing "password"', async () => {
    const envWithPassword = [
      {
        name: 'test',
        path: '/path/to/test.bru',
        variables: {
          USER_PASSWORD: 'secret123'
        }
      }
    ];

    mockBrunoCLI.listEnvironments = vi.fn().mockResolvedValue(envWithPassword);

    const result = await handler.handle({
      collectionPath: '/valid/path'
    });

    expect((result.content[0] as any).text).toContain('USER_PASSWORD: ***');
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.listEnvironments = vi.fn().mockRejectedValue(
      new Error('Failed to read environments')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow(McpError);

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow('Failed to list environments');
  });

  test('should call maskSecretsInError on errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.listEnvironments = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({ collectionPath: '/valid/path' })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should throw error for missing collectionPath parameter', async () => {
    await expect(handler.handle({})).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(handler.handle({ collectionPath: 123 })).rejects.toThrow();
    await expect(handler.handle({ collectionPath: null })).rejects.toThrow();
  });
});

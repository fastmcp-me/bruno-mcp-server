import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { ValidateEnvironmentHandler } from '../../../tools/handlers/ValidateEnvironmentHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('ValidateEnvironmentHandler', () => {
  let handler: ValidateEnvironmentHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockValidEnvironment = {
    valid: true,
    exists: true,
    errors: [],
    warnings: [],
    variables: {
      API_URL: 'https://api.example.com',
      API_KEY: 'test-key-123'
    }
  };

  const mockInvalidEnvironment = {
    valid: false,
    exists: true,
    errors: ['Invalid variable syntax', 'Missing required variable: API_URL'],
    warnings: [],
    variables: {}
  };

  const mockNonExistentEnvironment = {
    valid: false,
    exists: false,
    errors: ['Environment file not found: prod.bru'],
    warnings: [],
    variables: undefined
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
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn().mockResolvedValue(mockValidEnvironment)
    };

    handler = new ValidateEnvironmentHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_validate_environment');
  });

  test('should validate a valid environment successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection',
      environmentName: 'dev'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection',
      requestName: 'dev'
    });
    expect(mockBrunoCLI.validateEnvironment).toHaveBeenCalledWith(
      '/valid/path/to/collection',
      'dev'
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toContain('✅ Status: Valid');
  });

  test('should display environment variables', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'dev'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Variables: 2');
    expect(output).toContain('API_URL: https://api.example.com');
  });

  test('should mask sensitive variables', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'dev'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('API_KEY: *** (masked)');
    expect(output).not.toContain('test-key-123');
  });

  test('should handle invalid environment', async () => {
    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(mockInvalidEnvironment);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'staging'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('❌ Status: Invalid');
    expect(output).toContain('Invalid variable syntax');
    expect(output).toContain('Missing required variable');
  });

  test('should handle non-existent environment', async () => {
    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(mockNonExistentEnvironment);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'prod'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('❌ Status: Not Found');
    expect(output).toContain('Environment file not found');
  });

  test('should display warnings when present', async () => {
    const envWithWarnings = {
      ...mockValidEnvironment,
      warnings: ['Variable API_KEY contains hardcoded secret']
    };

    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(envWithWarnings);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'dev'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Warnings:');
    expect(output).toContain('⚠️  Variable API_KEY contains hardcoded secret');
  });

  test('should mask variables containing "password"', async () => {
    const envWithPassword = {
      valid: true,
      exists: true,
      errors: [],
      warnings: [],
      variables: {
        DB_PASSWORD: 'secret123'
      }
    };

    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(envWithPassword);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'test'
    });

    expect((result.content[0] as any).text).toContain('DB_PASSWORD: *** (masked)');
  });

  test('should mask variables containing "secret"', async () => {
    const envWithSecret = {
      valid: true,
      exists: true,
      errors: [],
      warnings: [],
      variables: {
        APP_SECRET: 'secret123'
      }
    };

    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(envWithSecret);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'test'
    });

    expect((result.content[0] as any).text).toContain('APP_SECRET: *** (masked)');
  });

  test('should mask variables containing "token"', async () => {
    const envWithToken = {
      valid: true,
      exists: true,
      errors: [],
      warnings: [],
      variables: {
        AUTH_TOKEN: 'token123'
      }
    };

    mockBrunoCLI.validateEnvironment = vi.fn().mockResolvedValue(envWithToken);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      environmentName: 'test'
    });

    expect((result.content[0] as any).text).toContain('AUTH_TOKEN: *** (masked)');
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid parameters']
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path', environmentName: 'dev' })
    ).rejects.toThrow(McpError);
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.validateEnvironment = vi.fn().mockRejectedValue(
      new Error('Failed to read environment file')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path', environmentName: 'dev' })
    ).rejects.toThrow(McpError);
  });

  test('should call maskSecretsInError on errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.validateEnvironment = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({ collectionPath: '/valid/path', environmentName: 'dev' })
    ).rejects.toThrow();

    expect(security.maskSecretsInError).toHaveBeenCalledWith(error);
  });

  test('should throw error for missing required parameters', async () => {
    await expect(handler.handle({})).rejects.toThrow();
    await expect(handler.handle({ collectionPath: '/path' })).rejects.toThrow();
    await expect(handler.handle({ environmentName: 'dev' })).rejects.toThrow();
  });

  test('should throw error for invalid parameter types', async () => {
    await expect(
      handler.handle({ collectionPath: 123, environmentName: 'dev' })
    ).rejects.toThrow();
  });
});

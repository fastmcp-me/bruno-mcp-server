import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IBrunoCLI } from '../../../interfaces.js';
import * as security from '../../../security.js';
import { GetRequestDetailsHandler } from '../../../tools/handlers/GetRequestDetailsHandler.js';

vi.mock('../../../security.js', async () => {
  const actual = await vi.importActual('../../../security.js');
  return {
    ...actual,
    validateToolParameters: vi.fn(),
    maskSecretsInError: vi.fn((error: Error) => error.message)
  };
});

describe('GetRequestDetailsHandler', () => {
  let handler: GetRequestDetailsHandler;
  let mockBrunoCLI: IBrunoCLI;

  const mockRequestDetails = {
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    auth: 'bearer',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer {{API_KEY}}'
    },
    metadata: {
      type: 'http',
      seq: 1
    }
  };

  const mockRequestWithBody = {
    name: 'Create User',
    method: 'POST',
    url: 'https://api.example.com/users',
    auth: 'none',
    headers: { 'Content-Type': 'application/json' },
    body: {
      type: 'json',
      content: '{"name": "John Doe", "email": "john@example.com"}'
    },
    metadata: { type: 'http', seq: 2 }
  };

  const mockRequestWithTests = {
    name: 'Get User by ID',
    method: 'GET',
    url: 'https://api.example.com/users/1',
    auth: 'none',
    headers: {},
    tests: [
      'expect(res.status).toBe(200);',
      'expect(res.body).toHaveProperty(\'id\');'
    ],
    metadata: { type: 'http', seq: 3 }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrunoCLI = {
      isAvailable: vi.fn(),
      listRequests: vi.fn(),
      listEnvironments: vi.fn(),
      runRequest: vi.fn(),
      runCollection: vi.fn(),
      getRequestDetails: vi.fn().mockResolvedValue(mockRequestDetails),
      validateCollection: vi.fn(),
      validateEnvironment: vi.fn()
    };

    handler = new GetRequestDetailsHandler(mockBrunoCLI);

    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: true,
      errors: []
    });
  });

  test('should return correct tool name', () => {
    expect(handler.getName()).toBe('bruno_get_request_details');
  });

  test('should get request details successfully', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path/to/collection',
      requestName: 'Get Users'
    });

    expect(security.validateToolParameters).toHaveBeenCalledWith({
      collectionPath: '/valid/path/to/collection',
      requestName: 'Get Users'
    });
    expect(mockBrunoCLI.getRequestDetails).toHaveBeenCalledWith(
      '/valid/path/to/collection',
      'Get Users'
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });

  test('should display request method and URL', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Method: GET');
    expect(output).toContain('URL: https://api.example.com/users');
    expect(output).toContain('Auth: bearer');
  });

  test('should display request headers', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Headers:');
    expect(output).toContain('Content-Type: application/json');
    expect(output).toContain('Authorization: Bearer {{API_KEY}}');
  });

  test('should display request body when present', async () => {
    mockBrunoCLI.getRequestDetails = vi.fn().mockResolvedValue(mockRequestWithBody);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Create User'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Body Type: json');
    expect(output).toContain('Body Content:');
    expect(output).toContain('"name": "John Doe"');
  });

  test('should indicate when body is not present', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Body: none');
  });

  test('should display tests when present', async () => {
    mockBrunoCLI.getRequestDetails = vi.fn().mockResolvedValue(mockRequestWithTests);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get User by ID'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Tests: 2');
    expect(output).toContain('expect(res.status).toBe(200);');
    expect(output).toContain('expect(res.body).toHaveProperty');
  });

  test('should indicate when tests are not present', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Tests: none');
  });

  test('should display metadata', async () => {
    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Get Users'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Metadata:');
    expect(output).toContain('Type: http');
    expect(output).toContain('Sequence: 1');
  });

  test('should handle multiline body content with indentation', async () => {
    const requestWithMultilineBody = {
      ...mockRequestWithBody,
      body: {
        type: 'json',
        content: '{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
      }
    };

    mockBrunoCLI.getRequestDetails = vi.fn().mockResolvedValue(requestWithMultilineBody);

    const result = await handler.handle({
      collectionPath: '/valid/path',
      requestName: 'Create User'
    });

    const output = (result.content[0] as any).text;
    expect(output).toContain('Body Content:');
    // Each line should be indented
    expect(output).toMatch(/\n {2}\{/);
    expect(output).toMatch(/\n {4}"name":/);
  });

  test('should throw McpError when validation fails', async () => {
    vi.mocked(security.validateToolParameters).mockResolvedValue({
      valid: false,
      errors: ['Invalid parameters']
    });

    await expect(
      handler.handle({ collectionPath: '/invalid/path', requestName: 'Test' })
    ).rejects.toThrow(McpError);
  });

  test('should throw McpError on Bruno CLI failure', async () => {
    mockBrunoCLI.getRequestDetails = vi.fn().mockRejectedValue(
      new Error('Request not found')
    );

    await expect(
      handler.handle({ collectionPath: '/valid/path', requestName: 'NonExistent' })
    ).rejects.toThrow(McpError);
  });

  test('should call maskSecretsInError on errors', async () => {
    const error = new Error('Error with SECRET=abc123');
    mockBrunoCLI.getRequestDetails = vi.fn().mockRejectedValue(error);

    vi.mocked(security.maskSecretsInError).mockReturnValue('Error with SECRET=***');

    await expect(
      handler.handle({ collectionPath: '/valid/path', requestName: 'Test' })
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
  });
});

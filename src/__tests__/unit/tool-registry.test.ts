import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { IToolHandler } from '../../tools/IToolHandler.js';
import { ToolRegistry } from '../../tools/ToolRegistry.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockHandler1: IToolHandler;
  let mockHandler2: IToolHandler;

  beforeEach(() => {
    registry = new ToolRegistry();

    mockHandler1 = {
      getName: () => 'mock-tool-1',
      handle: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Result 1' }] })
    };

    mockHandler2 = {
      getName: () => 'mock-tool-2',
      handle: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Result 2' }] })
    };
  });

  test('should register a handler successfully', () => {
    registry.register(mockHandler1);

    expect(registry.has('mock-tool-1')).toBe(true);
    expect(registry.get('mock-tool-1')).toBe(mockHandler1);
  });

  test('should throw error when registering duplicate handler', () => {
    registry.register(mockHandler1);

    expect(() => {
      registry.register(mockHandler1);
    }).toThrow("Tool handler 'mock-tool-1' is already registered");
  });

  test('should retrieve registered handler by name', () => {
    registry.register(mockHandler1);
    registry.register(mockHandler2);

    const handler1 = registry.get('mock-tool-1');
    const handler2 = registry.get('mock-tool-2');

    expect(handler1).toBe(mockHandler1);
    expect(handler2).toBe(mockHandler2);
  });

  test('should return undefined for non-existent handler', () => {
    const handler = registry.get('non-existent-tool');

    expect(handler).toBeUndefined();
  });

  test('should return all registered tool names', () => {
    registry.register(mockHandler1);
    registry.register(mockHandler2);

    const toolNames = registry.getAllToolNames();

    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain('mock-tool-1');
    expect(toolNames).toContain('mock-tool-2');
  });

  test('should check if handler exists with has()', () => {
    registry.register(mockHandler1);

    expect(registry.has('mock-tool-1')).toBe(true);
    expect(registry.has('mock-tool-2')).toBe(false);
    expect(registry.has('non-existent')).toBe(false);
  });

  test('should return empty array when no handlers registered', () => {
    const toolNames = registry.getAllToolNames();

    expect(toolNames).toEqual([]);
    expect(toolNames).toHaveLength(0);
  });

  test('should handle multiple handler registrations', () => {
    const handlers: IToolHandler[] = [];
    for (let i = 0; i < 5; i++) {
      handlers.push({
        getName: () => `tool-${i}`,
        handle: vi.fn().mockResolvedValue({ content: [] })
      });
    }

    handlers.forEach(handler => registry.register(handler));

    expect(registry.getAllToolNames()).toHaveLength(5);
    expect(registry.has('tool-0')).toBe(true);
    expect(registry.has('tool-4')).toBe(true);
  });

  test('should preserve handler instance after registration', () => {
    registry.register(mockHandler1);

    const retrieved = registry.get('mock-tool-1');

    // Verify it's the exact same instance
    expect(retrieved).toBe(mockHandler1);
    expect(retrieved?.getName()).toBe('mock-tool-1');
  });

  test('should maintain separate registrations for different handlers', () => {
    registry.register(mockHandler1);
    registry.register(mockHandler2);

    const handler1 = registry.get('mock-tool-1');
    const handler2 = registry.get('mock-tool-2');

    expect(handler1).not.toBe(handler2);
    expect(handler1?.getName()).toBe('mock-tool-1');
    expect(handler2?.getName()).toBe('mock-tool-2');
  });
});

/**
 * Tool Registry
 * Manages registration and lookup of tool handlers
 */

import type { IToolHandler } from './IToolHandler.js';

/**
 * Registry for managing tool handlers
 * Implements the Registry pattern for Open/Closed Principle compliance
 */
export class ToolRegistry {
  private handlers = new Map<string, IToolHandler>();

  /**
   * Register a tool handler
   * @param handler - The handler to register
   */
  register(handler: IToolHandler): void {
    const name = handler.getName();
    if (this.handlers.has(name)) {
      throw new Error(`Tool handler '${name}' is already registered`);
    }
    this.handlers.set(name, handler);
  }

  /**
   * Get a tool handler by name
   * @param name - The tool name
   * @returns The handler if found, undefined otherwise
   */
  get(name: string): IToolHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all registered tool names
   * @returns Array of tool names
   */
  getAllToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a tool is registered
   * @param name - The tool name
   * @returns True if registered, false otherwise
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }
}

/**
 * Tool Handler Interface
 * Defines the contract for all MCP tool handlers
 */

import type { TextContent } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool response format
 */
export interface ToolResponse {
  content: TextContent[];
}

/**
 * Interface for all tool handlers
 * Each tool handler is responsible for:
 * - Validating its parameters
 * - Executing its specific logic
 * - Formatting its response
 */
export interface IToolHandler {
  /**
   * Get the tool name this handler is responsible for
   */
  getName(): string;

  /**
   * Handle the tool execution
   * @param args - Tool arguments (will be validated by the handler)
   * @returns Tool response with formatted content
   */
  handle(args: unknown): Promise<ToolResponse>;
}

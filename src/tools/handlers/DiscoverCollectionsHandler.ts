/**
 * Handler for discovering Bruno collections
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';

const DiscoverCollectionsSchema = z.object({
  searchPath: z.string().describe('Directory path to search for Bruno collections'),
  maxDepth: z.number().optional().describe('Maximum directory depth to search (default: 5)')
});

/**
 * Handler for bruno_discover_collections tool
 * Discovers Bruno collections in a directory tree
 */
export class DiscoverCollectionsHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
  }

  getName(): string {
    return 'bruno_discover_collections';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = DiscoverCollectionsSchema.parse(args);

    // Validate search path
    const validation = await validateToolParameters({
      collectionPath: params.searchPath
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid search path: ${validation.errors.join(', ')}`
      );
    }

    try {
      const collections = await this.brunoCLI.discoverCollections(
        params.searchPath,
        params.maxDepth || 5
      );

      const output: string[] = [];

      if (collections.length === 0) {
        output.push(`No Bruno collections found in: ${params.searchPath}`);
        output.push('');
        output.push('A Bruno collection is a directory containing a bruno.json file.');
      } else {
        output.push(`Found ${collections.length} Bruno collection(s):\n`);

        collections.forEach((collectionPath, index) => {
          output.push(`${index + 1}. ${collectionPath}`);
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to discover collections: ${maskedError}`
      );
    }
  }
}

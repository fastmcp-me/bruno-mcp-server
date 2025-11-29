/**
 * Handler for listing environments in a Bruno collection
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';

const ListEnvironmentsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection')
});

/**
 * Handler for bruno_list_environments tool
 * Lists all environments in a Bruno collection
 */
export class ListEnvironmentsHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
  }

  getName(): string {
    return 'bruno_list_environments';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = ListEnvironmentsSchema.parse(args);

    // Validate collection path
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid collection path: ${validation.errors.join(', ')}`
      );
    }

    try {
      const environments = await this.brunoCLI.listEnvironments(params.collectionPath);

      const output: string[] = [];

      if (environments.length === 0) {
        output.push('No environments found in this collection.');
        output.push('');
        output.push('Environments are stored in the "environments" directory with .bru extension.');
      } else {
        output.push(`Found ${environments.length} environment(s):\n`);

        environments.forEach((env) => {
          output.push(`• ${env.name}`);
          output.push(`  Path: ${env.path}`);

          if (env.variables && Object.keys(env.variables).length > 0) {
            output.push(`  Variables: ${Object.keys(env.variables).length}`);

            // Show first few variables as preview
            const varEntries = Object.entries(env.variables).slice(0, 3);
            varEntries.forEach(([key, value]) => {
              // Mask potential secrets in output
              const displayValue = key.toLowerCase().includes('password') ||
                                   key.toLowerCase().includes('secret') ||
                                   key.toLowerCase().includes('token') ||
                                   key.toLowerCase().includes('key')
                ? '***'
                : value.length > 50 ? value.substring(0, 47) + '...' : value;
              output.push(`    - ${key}: ${displayValue}`);
            });

            if (Object.keys(env.variables).length > 3) {
              output.push(`    ... and ${Object.keys(env.variables).length - 3} more`);
            }
          }

          output.push('');
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
        `Failed to list environments: ${maskedError}`
      );
    }
  }
}

/**
 * Handler for getting request details
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';

const GetRequestDetailsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  requestName: z.string().describe('Name of the request to inspect')
});

/**
 * Handler for bruno_get_request_details tool
 * Gets details of a specific request without executing it
 */
export class GetRequestDetailsHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
  }

  getName(): string {
    return 'bruno_get_request_details';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = GetRequestDetailsSchema.parse(args);

    // Validate parameters
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.requestName
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validation.errors.join(', ')}`
      );
    }

    try {
      const details = await this.brunoCLI.getRequestDetails(
        params.collectionPath,
        params.requestName
      ) as {
        name: string;
        method: string;
        url: string;
        auth: string;
        headers: Record<string, string>;
        body?: { type: string; content: string };
        tests?: string[];
        metadata: { type: string; seq?: number };
      };

      const output: string[] = [];
      output.push(`=== Request Details: ${details.name} ===`);
      output.push('');

      // Method and URL
      output.push(`Method: ${details.method}`);
      output.push(`URL: ${details.url}`);
      output.push(`Auth: ${details.auth}`);
      output.push('');

      // Headers
      if (Object.keys(details.headers).length > 0) {
        output.push('Headers:');
        Object.entries(details.headers).forEach(([key, value]) => {
          output.push(`  ${key}: ${value}`);
        });
        output.push('');
      }

      // Body
      if (details.body) {
        output.push(`Body Type: ${details.body.type}`);
        output.push('Body Content:');

        // Format body content with indentation
        const bodyLines = details.body.content.split('\n');
        bodyLines.forEach(line => {
          output.push(`  ${line}`);
        });
        output.push('');
      } else {
        output.push('Body: none');
        output.push('');
      }

      // Tests
      if (details.tests && details.tests.length > 0) {
        output.push(`Tests: ${details.tests.length}`);
        details.tests.forEach((test, index) => {
          output.push(`  ${index + 1}. ${test}`);
        });
        output.push('');
      } else {
        output.push('Tests: none');
        output.push('');
      }

      // Metadata
      output.push('Metadata:');
      output.push(`  Type: ${details.metadata.type}`);
      if (details.metadata.seq !== undefined) {
        output.push(`  Sequence: ${details.metadata.seq}`);
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
        `Failed to get request details: ${maskedError}`
      );
    }
  }
}

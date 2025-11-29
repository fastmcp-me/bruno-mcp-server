/**
 * Handler for listing requests in a Bruno collection
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { logSecurityEvent, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';
import { RequestListFormatter } from '../formatters/RequestListFormatter.js';

const ListRequestsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection')
});

/**
 * Handler for bruno_list_requests tool
 * Lists all requests in a Bruno collection
 */
export class ListRequestsHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;
  private readonly formatter: RequestListFormatter;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
    this.formatter = new RequestListFormatter();
  }

  getName(): string {
    return 'bruno_list_requests';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = ListRequestsSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `List requests blocked: ${validation.errors.join(', ')}`,
        severity: 'error'
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Security validation failed: ${validation.errors.join(', ')}`
      );
    }

    const requests = await this.brunoCLI.listRequests(params.collectionPath);

    return {
      content: [
        {
          type: 'text',
          text: this.formatter.format(requests)
        } as TextContent
      ]
    };
  }
}

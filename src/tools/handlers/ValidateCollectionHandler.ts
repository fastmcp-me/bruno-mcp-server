/**
 * Handler for validating Bruno collections
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';

const ValidateCollectionSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection to validate')
});

/**
 * Handler for bruno_validate_collection tool
 * Validates a Bruno collection's structure and configuration
 */
export class ValidateCollectionHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
  }

  getName(): string {
    return 'bruno_validate_collection';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = ValidateCollectionSchema.parse(args);

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
      const result = await this.brunoCLI.validateCollection(params.collectionPath);

      const output: string[] = [];
      output.push('=== Collection Validation ===');
      output.push('');

      if (result.valid) {
        output.push('✅ Collection is valid');
      } else {
        output.push('❌ Collection has errors');
      }
      output.push('');

      // Summary
      output.push('Summary:');
      output.push(`  bruno.json: ${result.summary.hasBrunoJson ? '✓ Found' : '✗ Missing'}`);
      output.push(`  Total Requests: ${result.summary.totalRequests}`);
      output.push(`  Valid Requests: ${result.summary.validRequests}`);
      output.push(`  Invalid Requests: ${result.summary.invalidRequests}`);
      output.push(`  Environments: ${result.summary.environments}`);
      output.push('');

      // Errors
      if (result.errors.length > 0) {
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  ✗ ${err}`));
        output.push('');
      }

      // Warnings
      if (result.warnings.length > 0) {
        output.push('Warnings:');
        result.warnings.forEach(warn => output.push(`  ⚠️  ${warn}`));
        output.push('');
      }

      if (result.valid && result.warnings.length === 0) {
        output.push('🎉 Collection is ready to use!');
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
        `Failed to validate collection: ${maskedError}`
      );
    }
  }
}

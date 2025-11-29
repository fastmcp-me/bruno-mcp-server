/**
 * Handler for validating Bruno environments
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';

const ValidateEnvironmentSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  environmentName: z.string().describe('Name of the environment to validate')
});

/**
 * Handler for bruno_validate_environment tool
 * Validates an environment file in a Bruno collection
 */
export class ValidateEnvironmentHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
  }

  getName(): string {
    return 'bruno_validate_environment';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = ValidateEnvironmentSchema.parse(args);

    // Validate collection path and environment name
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.environmentName // Reuse request validation for env name
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validation.errors.join(', ')}`
      );
    }

    try {
      const result = await this.brunoCLI.validateEnvironment(
        params.collectionPath,
        params.environmentName
      );

      const output: string[] = [];
      output.push(`=== Environment Validation: ${params.environmentName} ===`);
      output.push('');

      if (!result.exists) {
        output.push(`❌ Status: Not Found`);
        output.push('');
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  • ${err}`));
      } else if (!result.valid) {
        output.push(`❌ Status: Invalid`);
        output.push('');
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  • ${err}`));
      } else {
        output.push(`✅ Status: Valid`);
        output.push('');

        if (result.variables && Object.keys(result.variables).length > 0) {
          output.push(`Variables: ${Object.keys(result.variables).length}`);
          output.push('');

          Object.entries(result.variables).forEach(([key, value]) => {
            // Mask sensitive values
            const displayValue = key.toLowerCase().includes('password') ||
                                 key.toLowerCase().includes('secret') ||
                                 key.toLowerCase().includes('token') ||
                                 key.toLowerCase().includes('key')
              ? '*** (masked)'
              : value;
            output.push(`  ${key}: ${displayValue}`);
          });
          output.push('');
        }
      }

      if (result.warnings.length > 0) {
        output.push('Warnings:');
        result.warnings.forEach(warn => output.push(`  ⚠️  ${warn}`));
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
        `Failed to validate environment: ${maskedError}`
      );
    }
  }
}

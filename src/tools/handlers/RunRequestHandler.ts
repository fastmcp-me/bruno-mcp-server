/**
 * Handler for running individual Bruno requests
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { logSecurityEvent, maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';
import { RunResultFormatter } from '../formatters/RunResultFormatter.js';

const RunRequestSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  requestName: z.string().describe('Name of the request to run'),
  environment: z.string().optional().describe('Name or path of the environment to use'),
  enviroment: z.string().optional().describe('Alias for environment (to handle common typo)'),
  envVariables: z.record(z.string()).optional().describe('Environment variables as key-value pairs'),
  reporterJson: z.string().optional().describe('Path to write JSON report'),
  reporterJunit: z.string().optional().describe('Path to write JUnit XML report'),
  reporterHtml: z.string().optional().describe('Path to write HTML report'),
  dryRun: z.boolean().optional().describe('Validate request without executing HTTP call')
});

type RunRequestParams = z.infer<typeof RunRequestSchema>;

/**
 * Handler for bruno_run_request tool
 * Executes a single request from a Bruno collection
 */
export class RunRequestHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;
  private readonly formatter: RunResultFormatter;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
    this.formatter = new RunResultFormatter();
  }

  getName(): string {
    return 'bruno_run_request';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = RunRequestSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.requestName,
      envVariables: params.envVariables
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `Run request blocked: ${validation.errors.join(', ')}`,
        severity: 'error'
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Security validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        logSecurityEvent({
          type: 'env_var_validation',
          details: warning,
          severity: 'warning'
        });
      });
    }

    // Handle dry run mode
    if (params.dryRun) {
      return await this.handleDryRun(params);
    }

    const result = await this.brunoCLI.runRequest(
      params.collectionPath,
      params.requestName,
      {
        environment: params.environment || params.enviroment,
        envVariables: params.envVariables,
        reporterJson: params.reporterJson,
        reporterJunit: params.reporterJunit,
        reporterHtml: params.reporterHtml
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: this.formatter.format(result)
        } as TextContent
      ]
    };
  }

  private async handleDryRun(params: RunRequestParams): Promise<ToolResponse> {
    try {
      // Get request details to validate structure
      const details = await this.brunoCLI.getRequestDetails(
        params.collectionPath,
        params.requestName
      );

      const output: string[] = [];
      output.push('=== DRY RUN: Request Validation ===');
      output.push('');
      output.push(`✅ Request validated successfully (HTTP call not executed)`);
      output.push('');
      output.push(`Request: ${details.name}`);
      output.push(`Method: ${details.method}`);
      output.push(`URL: ${details.url}`);
      output.push('');

      // Show what would be executed
      output.push('Configuration Summary:');
      output.push(`  Headers: ${Object.keys(details.headers).length}`);
      output.push(`  Body: ${details.body ? details.body.type : 'none'}`);
      output.push(`  Auth: ${details.auth}`);
      output.push(`  Tests: ${details.tests?.length || 0}`);
      output.push('');

      if (params.environment) {
        output.push(`Environment: ${params.environment}`);
        output.push('');
      }

      if (params.envVariables && Object.keys(params.envVariables).length > 0) {
        output.push(`Environment Variables: ${Object.keys(params.envVariables).length} provided`);
        output.push('');
      }

      output.push('ℹ️  This was a dry run - no HTTP request was sent.');
      output.push('   Remove dryRun parameter to execute the actual request.');

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
        `Dry run validation failed: ${maskedError}`
      );
    }
  }
}

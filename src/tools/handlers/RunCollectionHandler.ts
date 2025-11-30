/**
 * Handler for running Bruno collections
 */

import { ErrorCode, McpError, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IBrunoCLI } from '../../interfaces.js';
import { logSecurityEvent, maskSecretsInError, validateToolParameters } from '../../security.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';
import { RunResultFormatter } from '../formatters/RunResultFormatter.js';

const RunCollectionSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  environment: z.string().optional().describe('Name or path of the environment to use'),
  enviroment: z.string().optional().describe('Alias for environment (to handle common typo)'),
  folderPath: z.string().optional().describe('Specific folder within collection to run'),
  envVariables: z.record(z.string()).optional().describe('Environment variables as key-value pairs'),
  reporterJson: z.string().optional().describe('Path to write JSON report'),
  reporterJunit: z.string().optional().describe('Path to write JUnit XML report'),
  reporterHtml: z.string().optional().describe('Path to write HTML report'),
  dryRun: z.boolean().optional().describe('Validate requests without executing HTTP calls')
});

type RunCollectionParams = z.infer<typeof RunCollectionSchema>;

/**
 * Handler for bruno_run_collection tool
 * Executes an entire collection or folder of requests
 */
export class RunCollectionHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;
  private readonly formatter: RunResultFormatter;

  constructor(brunoCLI: IBrunoCLI) {
    this.brunoCLI = brunoCLI;
    this.formatter = new RunResultFormatter();
  }

  getName(): string {
    return 'bruno_run_collection';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = RunCollectionSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      folderPath: params.folderPath,
      envVariables: params.envVariables
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `Run collection blocked: ${validation.errors.join(', ')}`,
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

    const result = await this.brunoCLI.runCollection(
      params.collectionPath,
      {
        environment: params.environment || params.enviroment,
        folderPath: params.folderPath,
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

  private async handleDryRun(params: RunCollectionParams): Promise<ToolResponse> {
    try {
      // List all requests in the collection/folder
      const requests = await this.brunoCLI.listRequests(params.collectionPath);

      // Filter by folder if specified
      let requestsToValidate = requests;
      if (params.folderPath) {
        requestsToValidate = requests.filter(req =>
          req.folder && params.folderPath && req.folder.includes(params.folderPath)
        );
      }

      const output: string[] = [];
      output.push('=== DRY RUN: Collection Validation ===');
      output.push('');
      output.push(`✅ Collection validated successfully (HTTP calls not executed)`);
      output.push('');
      output.push(`Total Requests: ${requestsToValidate.length}`);
      output.push('');

      // Validate each request
      output.push('Requests that would be executed:');
      for (const req of requestsToValidate) {
        try {
          const details = await this.brunoCLI.getRequestDetails(
            params.collectionPath,
            req.name
          );
          output.push(`  ✓ ${req.name} - ${details.method} ${details.url}`);
        } catch (error) {
          output.push(`  ✗ ${req.name} - Validation error: ${error}`);
        }
      }
      output.push('');

      if (params.folderPath) {
        output.push(`Folder Filter: ${params.folderPath}`);
        output.push('');
      }

      if (params.environment) {
        output.push(`Environment: ${params.environment}`);
        output.push('');
      }

      if (params.envVariables && Object.keys(params.envVariables).length > 0) {
        output.push(`Environment Variables: ${Object.keys(params.envVariables).length} provided`);
        output.push('');
      }

      output.push('ℹ️  This was a dry run - no HTTP requests were sent.');
      output.push('   Remove dryRun parameter to execute the actual collection.');

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

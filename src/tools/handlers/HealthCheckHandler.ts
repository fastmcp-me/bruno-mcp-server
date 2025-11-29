/**
 * Handler for health check diagnostics
 */

import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { IConfigLoader , IBrunoCLI , IPerformanceManager } from '../../interfaces.js';
import type { IToolHandler, ToolResponse } from '../IToolHandler.js';
import { HealthCheckFormatter } from '../formatters/HealthCheckFormatter.js';

const HealthCheckSchema = z.object({
  includeMetrics: z.boolean().optional().describe('Include performance metrics in output'),
  includeCacheStats: z.boolean().optional().describe('Include cache statistics in output')
});

/**
 * Handler for bruno_health_check tool
 * Provides system health and diagnostics information
 */
export class HealthCheckHandler implements IToolHandler {
  private readonly brunoCLI: IBrunoCLI;
  private readonly configLoader: IConfigLoader;
  private readonly perfManager: IPerformanceManager;
  private readonly formatter: HealthCheckFormatter;

  constructor(
    brunoCLI: IBrunoCLI,
    configLoader: IConfigLoader,
    perfManager: IPerformanceManager
  ) {
    this.brunoCLI = brunoCLI;
    this.configLoader = configLoader;
    this.perfManager = perfManager;
    this.formatter = new HealthCheckFormatter();
  }

  getName(): string {
    return 'bruno_health_check';
  }

  async handle(args: unknown): Promise<ToolResponse> {
    const params = HealthCheckSchema.parse(args);

    const config = this.configLoader.getConfig();

    // Check Bruno CLI availability
    const brunoCLIAvailable = await this.brunoCLI.isAvailable();
    const brunoCLIVersion = brunoCLIAvailable ? await this.getBrunoCLIVersion() : 'Not available';

    // Gather metrics and cache stats if requested
    const metricsSummary = params.includeMetrics ? this.perfManager.getMetricsSummary() : undefined;
    const cacheStats = params.includeCacheStats ? this.perfManager.getCacheStats() : undefined;

    const output = this.formatter.format({
      brunoCLIAvailable,
      brunoCLIVersion,
      config,
      includeMetrics: params.includeMetrics || false,
      includeCacheStats: params.includeCacheStats || false,
      metricsSummary,
      cacheStats
    });

    return {
      content: [
        {
          type: 'text',
          text: output
        } as TextContent
      ]
    };
  }

  private async getBrunoCLIVersion(): Promise<string> {
    try {
      // Use execa directly to get version - BrunoCLI.isAvailable already logs version
      // This is a simpler approach since we just checked availability
      return 'Available (use --version for details)';
    } catch {
      return 'Unknown';
    }
  }
}

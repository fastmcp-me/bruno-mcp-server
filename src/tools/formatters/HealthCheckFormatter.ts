/**
 * Formatter for health check results
 * Formats system health and diagnostics information
 */

import type { BrunoMCPConfig } from '../../config.js';
import { formatMetrics, formatCacheStats } from '../../performance.js';

interface HealthCheckData {
  brunoCLIAvailable: boolean;
  brunoCLIVersion: string;
  config: BrunoMCPConfig;
  includeMetrics: boolean;
  includeCacheStats: boolean;
  metricsSummary?: unknown;
  cacheStats?: unknown;
}

export class HealthCheckFormatter {
  format(data: HealthCheckData): string {
    const output: string[] = [];

    output.push('=== Bruno MCP Server Health Check ===');
    output.push('');
    output.push('Server Status: Running');
    output.push(`Server Version: 0.1.0`);
    output.push(`Node.js Version: ${process.version}`);
    output.push(`Platform: ${process.platform} ${process.arch}`);
    output.push(`Uptime: ${Math.floor(process.uptime())} seconds`);
    output.push('');

    output.push('=== Bruno CLI ===');
    output.push(`Status: ${data.brunoCLIAvailable ? 'Available' : 'Not Available'}`);
    output.push(`Version: ${data.brunoCLIVersion}`);
    output.push('');

    output.push('=== Configuration ===');
    output.push(`Logging Level: ${data.config.logging?.level || 'info'}`);
    output.push(`Retry Enabled: ${data.config.retry?.enabled ? 'Yes' : 'No'}`);
    output.push(`Security Enabled: ${data.config.security?.allowedPaths ? `Yes (${data.config.security.allowedPaths.length} allowed paths)` : 'No restrictions'}`);
    output.push(`Secret Masking: ${data.config.security?.maskSecrets !== false ? 'Enabled' : 'Disabled'}`);
    output.push(`Cache Enabled: ${data.config.performance?.cacheEnabled !== false ? 'Yes' : 'No'}`);
    output.push(`Cache TTL: ${data.config.performance?.cacheTTL || 300000}ms`);
    output.push('');

    // Include performance metrics if requested
    if (data.includeMetrics && data.metricsSummary) {
      output.push(formatMetrics(data.metricsSummary as never));
      output.push('');
    }

    // Include cache statistics if requested
    if (data.includeCacheStats && data.cacheStats) {
      output.push(formatCacheStats(data.cacheStats as never));
      output.push('');
    }

    output.push('=== Status ===');
    output.push(data.brunoCLIAvailable ? 'All systems operational' : 'Warning: Bruno CLI not available');

    return output.join('\n');
  }
}

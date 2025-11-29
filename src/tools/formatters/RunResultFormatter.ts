/**
 * Formatter for Bruno run results
 * Formats execution results in a human-readable format
 */

import type { BrunoRunResult } from '../../bruno-cli.js';

export class RunResultFormatter {
  format(result: BrunoRunResult): string {
    const output = [];

    if (result.summary) {
      output.push('=== Execution Summary ===');
      output.push(`Total Requests: ${result.summary.totalRequests || 0}`);
      output.push(`Passed: ${result.summary.passedRequests || 0}`);
      output.push(`Failed: ${result.summary.failedRequests || 0}`);
      output.push(`Duration: ${result.summary.totalDuration || 0}ms`);
      output.push('');
    }

    if (result.results && result.results.length > 0) {
      output.push('=== Request Results ===');
      result.results.forEach((req) => {
        output.push(`
[${req.passed ? '✓' : '✗'}] ${req.name}`);

        // Request details
        if (req.request) {
          output.push(`  Request: ${req.request.method || 'GET'} ${req.request.url || ''}`);
        }

        // Response details
        if (req.response) {
          output.push(`  Status: ${req.response.status} ${req.response.statusText || ''}`);
          output.push(`  Duration: ${req.response.responseTime || req.duration}ms`);

          // Show response headers
          if (req.response.headers) {
            const headerKeys = Object.keys(req.response.headers);
            if (headerKeys.length > 0) {
              output.push('  Response Headers:');
              // Show most important headers first
              const importantHeaders = ['content-type', 'content-length', 'date', 'server'];
              const shownHeaders = new Set<string>();

              importantHeaders.forEach(key => {
                if (req.response?.headers?.[key]) {
                  output.push(`    ${key}: ${req.response?.headers?.[key]}`);
                  shownHeaders.add(key);
                }
              });

              // Show remaining headers (limit to first 5 additional)
              let count = 0;
              for (const [key, value] of Object.entries(req.response.headers)) {
                if (!shownHeaders.has(key) && count < 5) {
                  output.push(`    ${key}: ${value}`);
                  count++;
                }
              }

              if (headerKeys.length > shownHeaders.size + count) {
                output.push(`    ... and ${headerKeys.length - shownHeaders.size - count} more headers`);
              }
            }
          }

          // Show response body (limited to prevent huge outputs)
          if (req.response.body !== undefined && req.response.body !== null) {
            output.push('  Response Body:');
            const bodyStr = typeof req.response.body === 'string'
              ? req.response.body
              : JSON.stringify(req.response.body, null, 2);

            // Limit output size
            const maxLength = 2000;
            if (bodyStr.length > maxLength) {
              output.push(`    ${bodyStr.substring(0, maxLength)}...`);
              output.push(`    [Truncated - ${bodyStr.length} total characters]`);
            } else {
              bodyStr.split('\n').forEach((line) => {
                output.push(`    ${line}`);
              });
            }
          }
        } else if (req.status) {
          output.push(`  Status: ${req.status}`);
          output.push(`  Duration: ${req.duration}ms`);
        }

        if (req.error) {
          output.push(`  Error: ${req.error}`);
        }

        // Test assertions
        if (req.assertions && req.assertions.length > 0) {
          output.push('  Assertions:');
          req.assertions.forEach((assertion) => {
            output.push(`    ${assertion.passed ? '✓' : '✗'} ${assertion.name}`);
            if (!assertion.passed && assertion.error) {
              output.push(`      Error: ${assertion.error}`);
            }
          });
        }
      });
    }

    // Check for generated reports in stdout
    if (result.stdout) {
      const reportLines = result.stdout.split('\n').filter((line: string) =>
        line.includes('Wrote') && (line.includes('json') || line.includes('junit') || line.includes('html'))
      );

      if (reportLines.length > 0) {
        output.push('');
        output.push('=== Generated Reports ===');
        reportLines.forEach((line: string) => {
          output.push(`  ${line.trim()}`);
        });
      }
    }

    // Fallback to raw output if no structured data
    if (!result.summary && !result.results) {
      if (result.stdout) {
        output.push('\n=== Raw Output ===');
        output.push(result.stdout);
      }

      if (result.stderr) {
        output.push('\n=== Errors ===');
        output.push(result.stderr);
      }
    }

    return output.join('\n');
  }
}

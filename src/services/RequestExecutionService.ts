/**
 * Service for executing Bruno requests and collections
 * Handles running requests, collections, and parsing results
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { getConfigLoader } from '../config.js';
import type { BrunoRunOptions, BrunoRunResult } from '../bruno-cli.js';

/**
 * Service responsible for executing Bruno requests and collections
 * Single Responsibility: Execute and parse Bruno CLI operations
 */
export class RequestExecutionService {
  constructor(private readonly brunoCommand: string) {}

  /**
   * Run a single request from a collection
   */
  async runRequest(
    collectionPath: string,
    requestName: string,
    options: BrunoRunOptions = {},
    findRequestFile: (collectionPath: string, requestName: string) => Promise<string | null>
  ): Promise<BrunoRunResult> {
    // Find the .bru file for this request
    const requestFile = await findRequestFile(collectionPath, requestName);
    if (!requestFile) {
      throw new Error(`Request "${requestName}" not found in collection`);
    }

    // Get relative path from collection root
    const relativePath = path.relative(collectionPath, requestFile);

    // Create temporary file for JSON output
    const tempFile = path.join(tmpdir(), `bruno-result-${randomUUID()}.json`);

    // Build command arguments - run specific file
    const args = ['run', relativePath];

    // Always use JSON format to capture response data
    args.push('--format', 'json');
    args.push('--output', tempFile);

    // Add optional parameters
    this.addEnvironmentArgs(args, options);
    this.addEnvironmentVariableArgs(args, options);
    this.addTestArgs(args, options);
    this.addReporterArgs(args, options);

    try {
      // Get timeout configuration
      const configLoader = getConfigLoader();
      const timeout = configLoader.getTimeout();

      // Run Bruno CLI from within the collection directory
      const result = await execa(this.brunoCommand, args, {
        cwd: collectionPath,
        env: { ...process.env },
        reject: false,
        timeout: timeout.request
      });

      // If Bruno CLI failed, handle the error
      if (result.exitCode !== 0 || result.failed) {
        throw result;
      }

      // Read the JSON output file
      const jsonResult = await this.readJsonOutput(tempFile, options);

      // Clean up temp file
      await this.cleanupTempFile(tempFile);

      return this.parseRunResult(result, jsonResult);
    } catch (error) {
      // Clean up temp file on error
      await this.cleanupTempFile(tempFile);
      throw error;
    }
  }

  /**
   * Run an entire collection or folder
   */
  async runCollection(
    collectionPath: string,
    options: BrunoRunOptions = {}
  ): Promise<BrunoRunResult> {
    // Determine what to run (folder or entire collection)
    let targetPath = '.';

    if (options.folderPath) {
      // Run specific folder
      targetPath = options.folderPath;
    }

    // Create temporary file for JSON output
    const tempFile = path.join(tmpdir(), `bruno-result-${randomUUID()}.json`);

    // Build command arguments
    const args = ['run', targetPath];

    // Add recursive flag (usually needed for folders)
    if (options.recursive !== false) {
      args.push('-r');
    }

    // Always use JSON format to capture response data
    args.push('--format', 'json');
    args.push('--output', tempFile);

    // Add optional parameters
    this.addEnvironmentArgs(args, options);
    this.addEnvironmentVariableArgs(args, options);
    this.addTestArgs(args, options);
    this.addReporterArgs(args, options);

    try {
      // Get timeout configuration
      const configLoader = getConfigLoader();
      const timeout = configLoader.getTimeout();

      // Run Bruno CLI from within the collection directory
      const result = await execa(this.brunoCommand, args, {
        cwd: collectionPath,
        env: { ...process.env },
        reject: false,
        timeout: timeout.collection
      });

      // Read the JSON output file
      const jsonResult = await this.readJsonOutput(tempFile, options);

      // Clean up temp file
      await this.cleanupTempFile(tempFile);

      return this.parseRunResult(result, jsonResult);
    } catch (error) {
      // Clean up temp file on error
      await this.cleanupTempFile(tempFile);
      throw error;
    }
  }

  /**
   * Add environment arguments to command
   */
  private addEnvironmentArgs(args: string[], options: BrunoRunOptions): void {
    if (options.environment) {
      let envPath = options.environment;

      // Check if it's an absolute path
      if (path.isAbsolute(envPath)) {
        // If absolute path, get just the filename without extension
        // Bruno expects just the environment name, not the full path
        const basename = path.basename(envPath, '.bru');
        envPath = basename;
      } else if (envPath.includes('/') || envPath.includes('\\')) {
        // If it's a relative path with separators, get just the filename
        const basename = path.basename(envPath, '.bru');
        envPath = basename;
      } else if (envPath.endsWith('.bru')) {
        // If it ends with .bru, remove the extension
        envPath = envPath.replace(/\.bru$/, '');
      }
      // If just a name (no path separators, no extension), use as-is

      args.push('--env', envPath);
    }
  }

  /**
   * Add environment variable overrides to command
   */
  private addEnvironmentVariableArgs(args: string[], options: BrunoRunOptions): void {
    if (options.envVariables) {
      for (const [key, value] of Object.entries(options.envVariables)) {
        args.push('--env-var', `${key}=${value}`);
      }
    }
  }

  /**
   * Add test-related arguments to command
   */
  private addTestArgs(args: string[], options: BrunoRunOptions): void {
    if (options.testsOnly) {
      args.push('--tests-only');
    }

    if (options.bail) {
      args.push('--bail');
    }
  }

  /**
   * Add reporter arguments to command
   */
  private addReporterArgs(args: string[], options: BrunoRunOptions): void {
    if (options.reporterJson) {
      args.push('--reporter-json', options.reporterJson);
    }

    if (options.reporterJunit) {
      args.push('--reporter-junit', options.reporterJunit);
    }

    if (options.reporterHtml) {
      args.push('--reporter-html', options.reporterHtml);
    }
  }

  /**
   * Read JSON output from temp file
   */
  private async readJsonOutput(tempFile: string, options: BrunoRunOptions): Promise<any> {
    const hasCustomReporters = options.reporterJson || options.reporterJunit || options.reporterHtml;

    if (!hasCustomReporters) {
      // Only try to read temp file if no custom reporters are specified
      try {
        const jsonContent = await fs.readFile(tempFile, 'utf-8');
        return JSON.parse(jsonContent);
      } catch (error) {
        console.error('Failed to read Bruno output file:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Clean up temporary file
   */
  private async cleanupTempFile(tempFile: string): Promise<void> {
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Parse Bruno CLI execution result
   */
  private parseRunResult(result: any, jsonOutput?: any): BrunoRunResult {
    const runResult: BrunoRunResult = {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0
    };

    // Use the JSON output if available (from file)
    let jsonResult = jsonOutput || this.tryParseJson(result.stdout);

    // Bruno CLI returns an array with a single object containing summary and results
    // Unwrap it if needed
    if (Array.isArray(jsonResult) && jsonResult.length > 0) {
      jsonResult = jsonResult[0];
    }

    if (jsonResult) {
      // Extract summary information
      if (jsonResult.summary) {
        runResult.summary = {
          totalRequests: jsonResult.summary.totalRequests || jsonResult.summary.total || 0,
          passedRequests: jsonResult.summary.passedRequests || jsonResult.summary.passed || 0,
          failedRequests: jsonResult.summary.failedRequests || jsonResult.summary.failed || 0,
          totalDuration: jsonResult.summary.totalDuration || jsonResult.summary.duration || 0
        };
      }

      // Extract individual results with response data
      if (jsonResult.results && Array.isArray(jsonResult.results)) {
        runResult.results = jsonResult.results.map((r: any) => {
          const result: any = {
            name: r.suitename || r.name || r.test?.filename || 'Unknown',
            passed: r.error === null || r.error === undefined,
            status: r.response?.status || 0,
            duration: r.response?.responseTime || r.runtime || 0,
            error: r.error
          };

          // Add request details if available
          if (r.request) {
            result.request = {
              method: r.request.method,
              url: r.request.url,
              headers: r.request.headers,
              body: r.request.body || r.request.data
            };
          }

          // Add response details if available
          if (r.response) {
            result.response = {
              status: r.response.status,
              statusText: r.response.statusText,
              headers: r.response.headers,
              body: r.response.data || r.response.body,
              responseTime: r.response.responseTime
            };
          }

          // Add test/assertion results (Bruno uses testResults and assertionResults)
          const testResults = r.testResults || r.tests || r.assertions;
          const assertionResults = r.assertionResults || [];

          const allTests = [];

          if (Array.isArray(testResults)) {
            allTests.push(...testResults.map((t: any) => ({
              name: t.description || t.name || t.test,
              passed: t.status === 'pass' || t.passed === true,
              error: t.status === 'fail' ? t.error || t.message : undefined
            })));
          }

          if (Array.isArray(assertionResults)) {
            allTests.push(...assertionResults.map((a: any) => ({
              name: a.description || a.name,
              passed: a.status === 'pass' || a.passed === true,
              error: a.status === 'fail' ? a.error || a.message : undefined
            })));
          }

          if (allTests.length > 0) {
            result.assertions = allTests;
          }

          return result;
        });
      }

      // If results are in a different structure (check for 'items' or direct array)
      if (!runResult.results && jsonResult.items && Array.isArray(jsonResult.items)) {
        runResult.results = this.parseItems(jsonResult.items);
      }
    }

    return runResult;
  }

  /**
   * Try to parse JSON from string
   */
  private tryParseJson(str: string): any {
    if (!str || !str.trim()) return null;

    try {
      // Try to parse as-is
      if (str.trim().startsWith('{') || str.trim().startsWith('[')) {
        return JSON.parse(str);
      }

      // Look for JSON in the output (sometimes there's extra text)
      const jsonMatch = str.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch {
      // Not JSON or parsing failed
    }

    return null;
  }

  /**
   * Parse items from alternative JSON structure
   */
  private parseItems(items: any[]): any[] {
    return items.map((item: any) => {
      const result: any = {
        name: item.name || 'Unknown',
        passed: item.status === 'passed' || item.passed !== false,
        status: item.response?.status || 0,
        duration: item.duration || 0
      };

      if (item.request) {
        result.request = {
          method: item.request.method,
          url: item.request.url,
          headers: item.request.headers,
          body: item.request.body
        };
      }

      if (item.response) {
        result.response = {
          status: item.response.status,
          statusText: item.response.statusText,
          headers: item.response.headers,
          body: item.response.body || item.response.data,
          responseTime: item.response.time || item.response.responseTime
        };
      }

      if (item.tests) {
        result.assertions = item.tests.map((t: any) => ({
          name: t.name || t.test,
          passed: t.passed || t.status === 'passed',
          error: t.error
        }));
      }

      return result;
    });
  }
}

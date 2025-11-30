import { createRequire } from 'module';

import { execa } from 'execa';

import type { ConfigLoader } from './config.js';
import type { IBrunoCLI } from './interfaces.js';
import type { PerformanceManager } from './performance.js';
import { CollectionDiscoveryService } from './services/CollectionDiscoveryService.js';
import { EnvironmentService } from './services/EnvironmentService.js';
import { RequestExecutionService } from './services/RequestExecutionService.js';
import { ValidationService } from './services/ValidationService.js';

export interface BrunoRunOptions {
  environment?: string;
  envVariables?: Record<string, string>;
  folderPath?: string;
  format?: 'json' | 'junit' | 'html';
  output?: string;
  recursive?: boolean;
  testsOnly?: boolean;
  bail?: boolean;
  // Report generation options
  reporterJson?: string;    // Path to write JSON report
  reporterJunit?: string;   // Path to write JUnit XML report
  reporterHtml?: string;    // Path to write HTML report
}

export interface BrunoRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  summary?: {
    totalRequests: number;
    passedRequests: number;
    failedRequests: number;
    totalDuration: number;
  };
  results?: Array<{
    name: string;
    passed: boolean;
    status: number;
    duration: number;
    error?: string;
    request?: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: any;
    };
    response?: {
      status?: number;
      statusText?: string;
      headers?: Record<string, string>;
      body?: any;
      responseTime?: number;
    };
    assertions?: Array<{
      name: string;
      passed: boolean;
      error?: string;
    }>;
  }>;
}

export interface BrunoRequest {
  name: string;
  method?: string;
  url?: string;
  folder?: string;
  path?: string;
}

/**
 * Facade for Bruno CLI operations
 * Delegates to focused service classes following Single Responsibility Principle
 */
export class BrunoCLI implements IBrunoCLI {
  private brunoCommand: string = 'bru';
  private requestExecutionService: RequestExecutionService;
  private collectionDiscoveryService: CollectionDiscoveryService;
  private environmentService: EnvironmentService;
  private validationService: ValidationService;
  private configLoader: ConfigLoader;
  private performanceManager: PerformanceManager;

  constructor(configLoader: ConfigLoader, performanceManager: PerformanceManager, brunoPath?: string) {
    this.configLoader = configLoader;
    this.performanceManager = performanceManager;

    if (brunoPath) {
      this.brunoCommand = brunoPath;
    } else {
      // Check configuration for custom Bruno CLI path
      const config = this.configLoader.getConfig();

      if (config.brunoCliPath) {
        this.brunoCommand = config.brunoCliPath;
      } else {
        // Try to find the local Bruno CLI installation
        this.brunoCommand = this.findBrunoCLI();
      }
    }

    // Initialize services with dependencies
    this.requestExecutionService = new RequestExecutionService(this.brunoCommand, this.configLoader);
    this.collectionDiscoveryService = new CollectionDiscoveryService(this.performanceManager);
    this.environmentService = new EnvironmentService(this.performanceManager);
    this.validationService = new ValidationService();
  }

  /**
   * Find the Bruno CLI executable
   */
  private findBrunoCLI(): string {
    const require = createRequire(import.meta.url);
    const fsSync = require('fs');

    try {
      // Try to resolve the Bruno CLI package
      const brunoPkgPath = require.resolve('@usebruno/cli/package.json');
      const brunoPkgDir = brunoPkgPath.substring(0, brunoPkgPath.lastIndexOf('/'));
      const brunoBinPath = `${brunoPkgDir}/bin/bru.js`;

      // Check if the binary exists
      if (fsSync.existsSync(brunoBinPath)) {
        return brunoBinPath;  // Return the full path to bru.js
      }
    } catch {
      // Package not found, try global installation
    }

    // Fall back to trying the global 'bru' command
    return 'bru';
  }

  /**
   * Check if Bruno CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execa(this.brunoCommand, ['--version'], {
        timeout: 5000,
        reject: false
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a single request
   * Delegates to RequestExecutionService
   */
  async runRequest(
    collectionPath: string,
    requestName: string,
    options: BrunoRunOptions = {}
  ): Promise<BrunoRunResult> {
    try {
      return await this.requestExecutionService.runRequest(
        collectionPath,
        requestName,
        options,
        (cp, rn) => this.collectionDiscoveryService.findRequestFile(cp, rn)
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Run a collection or folder
   * Delegates to RequestExecutionService
   */
  async runCollection(
    collectionPath: string,
    options: BrunoRunOptions = {}
  ): Promise<BrunoRunResult> {
    try {
      return await this.requestExecutionService.runCollection(collectionPath, options);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List all requests in a collection
   * Delegates to CollectionDiscoveryService
   */
  async listRequests(collectionPath: string): Promise<BrunoRequest[]> {
    return this.collectionDiscoveryService.listRequests(collectionPath);
  }

  /**
   * Discover Bruno collections in a directory
   * Delegates to CollectionDiscoveryService
   */
  async discoverCollections(searchPath: string, maxDepth: number = 5): Promise<string[]> {
    return this.collectionDiscoveryService.discoverCollections(searchPath, maxDepth);
  }

  /**
   * List environments in a collection
   * Delegates to EnvironmentService
   */
  async listEnvironments(collectionPath: string): Promise<Array<{
    name: string;
    path: string;
    variables?: Record<string, string>;
  }>> {
    return this.environmentService.listEnvironments(collectionPath);
  }

  /**
   * Validate an environment file
   * Delegates to EnvironmentService
   */
  async validateEnvironment(collectionPath: string, environmentName: string): Promise<{
    valid: boolean;
    exists: boolean;
    errors: string[];
    warnings: string[];
    variables?: Record<string, string>;
  }> {
    return this.environmentService.validateEnvironment(collectionPath, environmentName);
  }

  /**
   * Get detailed information about a request
   * Delegates to ValidationService via CollectionDiscoveryService
   */
  async getRequestDetails(collectionPath: string, requestName: string): Promise<{
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: {
      type: string;
      content: string;
    };
    auth: string;
    tests?: string[];
    metadata: {
      type: string;
      seq?: number;
    };
  }> {
    // Find the request file
    const requestFile = await this.collectionDiscoveryService.findRequestFile(collectionPath, requestName);
    if (!requestFile) {
      throw new Error(`Request "${requestName}" not found in collection`);
    }

    // Get details from validation service
    return this.validationService.getRequestDetails(requestFile, requestName);
  }

  /**
   * Validate a Bruno collection
   * Delegates to ValidationService with callbacks to other services
   */
  async validateCollection(collectionPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      hasBrunoJson: boolean;
      totalRequests: number;
      validRequests: number;
      invalidRequests: number;
      environments: number;
    };
  }> {
    return this.validationService.validateCollection(
      collectionPath,
      () => this.listRequests(collectionPath),
      () => this.listEnvironments(collectionPath),
      (envName) => this.validateEnvironment(collectionPath, envName),
      (reqName) => this.getRequestDetails(collectionPath, reqName)
    );
  }

  /**
   * Handle errors from Bruno CLI
   */
  private handleError(error: any): Error {
    // Check if it's an execa error by checking for specific properties
    if (error && typeof error === 'object' && 'stderr' in error) {
      if (error.stderr?.includes('command not found') ||
          error.stderr?.includes('not recognized') ||
          error.stderr?.includes('ENOENT')) {
        return new Error(
          `Bruno CLI not found at: ${this.brunoCommand}. ` +
          'Please ensure Bruno CLI is installed by running: npm install'
        );
      }

      if (error.stderr?.includes('You can run only at the root of a collection')) {
        return new Error(
          'Invalid collection directory. Bruno CLI must be run from the root of a Bruno collection. ' +
          'Ensure the directory contains a bruno.json or collection.bru file.'
        );
      }

      if (error.stderr) {
        return new Error(`Bruno CLI error: ${error.stderr}`);
      }

      return new Error(`Bruno CLI failed: ${error.message || 'Unknown error'}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

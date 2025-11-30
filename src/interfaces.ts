/**
 * Core interfaces for bruno-mcp-server
 * These interfaces enable dependency injection and testability
 */

import type { BrunoRunResult, BrunoRequest } from './bruno-cli.js';
import type { BrunoMCPConfig } from './config.js';

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface IConfigLoader {
  getConfig(): BrunoMCPConfig;
  getTimeout(): BrunoMCPConfig['timeout'];
  getRetry(): BrunoMCPConfig['retry'];
  getSecurity(): BrunoMCPConfig['security'];
  getLogging(): BrunoMCPConfig['logging'];
  getPerformance(): BrunoMCPConfig['performance'];
  maskSecrets(text: string): string;
}

// ============================================================================
// Logging Interfaces
// ============================================================================

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): Promise<void>;
  info(message: string, context?: Record<string, unknown>): Promise<void>;
  warning(message: string, context?: Record<string, unknown>): Promise<void>;
  error(message: string, error?: Error, context?: Record<string, unknown>): Promise<void>;
  logToolExecution(toolName: string, params: unknown, duration: number, success: boolean): void;
  logSecurityEvent(event: string, details: string, severity: 'info' | 'warning' | 'error'): void;
}

// ============================================================================
// Performance Management Interfaces
// ============================================================================

export interface IPerformanceManager {
  // Cache management for request lists
  cacheRequestList(collectionPath: string, requests: BrunoRequest[]): void;
  getCachedRequestList(collectionPath: string): BrunoRequest[] | null;

  // Cache management for collection discovery
  cacheCollectionDiscovery(searchPath: string, collections: string[]): void;
  getCachedCollectionDiscovery(searchPath: string): string[] | null;

  // Cache management for environments
  cacheEnvironmentList(collectionPath: string, environments: unknown[]): void;
  getCachedEnvironmentList(collectionPath: string): unknown[] | null;

  // Metrics tracking
  recordMetric(metric: unknown): void;
  getMetricsSummary(): unknown;

  // Cache statistics
  getCacheStats(): unknown;

  // Cache clearing
  clearCache(cacheType?: 'requestList' | 'collectionDiscovery' | 'environments'): void;
}

// ============================================================================
// Bruno CLI Interfaces
// ============================================================================

/**
 * Base options for running Bruno requests/collections
 */
export interface BaseRunOptions {
  environment?: string;
  envVariables?: Record<string, string>;
  testsOnly?: boolean;
  bail?: boolean;
}

/**
 * Reporter options (shared across request and collection runs)
 */
export interface ReporterOptions {
  reporterJson?: string;
  reporterJunit?: string;
  reporterHtml?: string;
}

/**
 * Options specific to running individual requests
 */
export interface RequestRunOptions extends BaseRunOptions, ReporterOptions {
  dryRun?: boolean;
}

/**
 * Options specific to running collections
 */
export interface CollectionRunOptions extends BaseRunOptions, ReporterOptions {
  folderPath?: string;
  recursive?: boolean;
  dryRun?: boolean;
}

/**
 * Main interface for Bruno CLI operations
 */
export interface IBrunoCLI {
  /**
   * Check if Bruno CLI is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Run a single request from a collection
   */
  runRequest(
    collectionPath: string,
    requestName: string,
    options?: RequestRunOptions
  ): Promise<BrunoRunResult>;

  /**
   * Run an entire collection or folder
   */
  runCollection(
    collectionPath: string,
    options?: CollectionRunOptions
  ): Promise<BrunoRunResult>;

  /**
   * List all requests in a collection
   */
  listRequests(collectionPath: string): Promise<BrunoRequest[]>;

  /**
   * Discover Bruno collections in a directory tree
   */
  discoverCollections(searchPath: string, maxDepth?: number): Promise<string[]>;

  /**
   * List all environments in a collection
   */
  listEnvironments(collectionPath: string): Promise<Array<{
    name: string;
    path: string;
    variables?: Record<string, string>;
  }>>;

  /**
   * Validate an environment file
   */
  validateEnvironment(
    collectionPath: string,
    environmentName: string
  ): Promise<{
    valid: boolean;
    exists: boolean;
    errors: string[];
    warnings: string[];
    variables?: Record<string, string>;
  }>;

  /**
   * Get details of a specific request without executing it
   */
  getRequestDetails(
    collectionPath: string,
    requestName: string
  ): Promise<{
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
  }>;

  /**
   * Validate a collection's structure and configuration
   */
  validateCollection(collectionPath: string): Promise<{
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
  }>;
}

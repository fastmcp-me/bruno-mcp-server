/**
 * Service for managing Bruno collection environments
 * Handles listing, validating, and parsing environment files
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { getPerformanceManager } from '../performance.js';

export interface Environment {
  name: string;
  path: string;
  variables?: Record<string, string>;
}

export interface EnvironmentValidationResult {
  valid: boolean;
  exists: boolean;
  errors: string[];
  warnings: string[];
  variables?: Record<string, string>;
}

/**
 * Service responsible for environment management
 * Single Responsibility: Environment operations (list, validate, parse)
 */
export class EnvironmentService {
  /**
   * List all environments in a collection
   */
  async listEnvironments(collectionPath: string): Promise<Environment[]> {
    const perfManager = getPerformanceManager();

    // Check cache first
    const cached = perfManager.getCachedEnvironmentList(collectionPath);
    if (cached) {
      return cached;
    }

    const environmentsPath = path.join(collectionPath, 'environments');
    const environments: Environment[] = [];

    try {
      const entries = await fs.readdir(environmentsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.bru')) {
          const envName = path.basename(entry.name, '.bru');
          const envPath = path.join(environmentsPath, entry.name);

          try {
            const content = await fs.readFile(envPath, 'utf-8');
            const variables = this.parseEnvironmentVariables(content);

            environments.push({
              name: envName,
              path: envPath,
              variables
            });
          } catch (error) {
            // Include environment even if we can't parse it
            environments.push({
              name: envName,
              path: envPath
            });
          }
        }
      }
    } catch (error) {
      // Return empty array if environments directory doesn't exist
      return [];
    }

    // Cache the results
    perfManager.cacheEnvironmentList(collectionPath, environments);

    return environments;
  }

  /**
   * Validate an environment file
   */
  async validateEnvironment(
    collectionPath: string,
    environmentName: string
  ): Promise<EnvironmentValidationResult> {
    const result: EnvironmentValidationResult = {
      valid: true,
      exists: false,
      errors: [],
      warnings: [],
      variables: undefined
    };

    const envPath = path.join(collectionPath, 'environments', `${environmentName}.bru`);

    try {
      await fs.access(envPath);
      result.exists = true;
    } catch {
      result.valid = false;
      result.errors.push(`Environment file not found: ${envPath}`);
      return result;
    }

    try {
      const content = await fs.readFile(envPath, 'utf-8');

      // Check basic structure
      if (!content.includes('vars {')) {
        result.warnings.push('Environment file does not contain a "vars {}" block');
      }

      // Parse variables
      result.variables = this.parseEnvironmentVariables(content);

      // Check for common issues
      if (Object.keys(result.variables).length === 0) {
        result.warnings.push('No variables defined in environment');
      }

      // Check for potentially sensitive data that might be hardcoded
      for (const [key, value] of Object.entries(result.variables)) {
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token')) {
          if (value && !value.startsWith('{{') && !value.startsWith('$')) {
            result.warnings.push(`Variable "${key}" may contain hardcoded sensitive data`);
          }
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to read environment file: ${error}`);
    }

    return result;
  }

  /**
   * Parse environment variables from .bru file content
   */
  private parseEnvironmentVariables(content: string): Record<string, string> {
    const variables: Record<string, string> = {};

    // Match vars { ... } block
    const varsMatch = content.match(/vars\s*\{([^}]*)\}/s);
    if (!varsMatch) {
      return variables;
    }

    const varsContent = varsMatch[1];

    // Match variable assignments: name: value
    const varRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$/gm;
    let match;

    while ((match = varRegex.exec(varsContent)) !== null) {
      const [, key, value] = match;
      variables[key] = value;
    }

    return variables;
  }
}

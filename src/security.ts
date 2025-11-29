import * as fs from 'fs/promises';
import * as path from 'path';

import type { ConfigLoader } from './config.js';
import { getContainer, ServiceKeys } from './di/Container.js';
import type { Logger } from './logger.js';

/**
 * Security utilities for Bruno MCP Server
 */

/**
 * Validate if a path is within allowed directories (with DI)
 */
export async function validatePathWithConfig(targetPath: string, configLoader: ConfigLoader): Promise<{ valid: boolean; error?: string }> {
  const security = configLoader.getSecurity();

  // If no allowed paths configured, allow all paths
  if (!security.allowedPaths || security.allowedPaths.length === 0) {
    return { valid: true };
  }

  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(targetPath);

    // Check if path exists
    try {
      await fs.access(absolutePath);
    } catch {
      return { valid: false, error: `Path does not exist: ${targetPath}` };
    }

    // Check if path is within any allowed directory
    for (const allowedPath of security.allowedPaths) {
      const absoluteAllowedPath = path.resolve(allowedPath);
      const relativePath = path.relative(absoluteAllowedPath, absolutePath);

      // If relative path doesn't start with '..' it means it's inside the allowed path
      if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      error: `Path is not within allowed directories: ${targetPath}. Allowed paths: ${security.allowedPaths.join(', ')}`
    };
  } catch (error) {
    return {
      valid: false,
      error: `Path validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Sanitize input to prevent command injection
 */
export function sanitizeInput(input: string): string {
  // Remove or escape potentially dangerous characters
  // Allow alphanumeric, common path characters, and safe punctuation
  return input.replace(/[;&|`$(){}[\]<>\\]/g, '');
}

/**
 * Validate environment variable name
 */
export function validateEnvVarName(name: string): boolean {
  // Environment variable names should only contain alphanumeric characters and underscores
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/**
 * Validate environment variable value
 */
export function validateEnvVarValue(value: string): boolean {
  // Check for potentially malicious patterns
  const dangerousPatterns = [
    /[;&|`$()]/,           // Command injection characters
    /\$\{.*\}/,            // Variable expansion
    /\$\(.*\)/,            // Command substitution
    /`.*`/,                // Backtick command execution
  ];

  return !dangerousPatterns.some(pattern => pattern.test(value));
}

/**
 * Sanitize environment variables
 */
export function sanitizeEnvVariables(envVars: Record<string, string>): {
  sanitized: Record<string, string>;
  warnings: string[];
} {
  const sanitized: Record<string, string> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(envVars)) {
    // Validate key
    if (!validateEnvVarName(key)) {
      warnings.push(`Invalid environment variable name: ${key}`);
      continue;
    }

    // Validate value
    if (!validateEnvVarValue(value)) {
      warnings.push(`Potentially unsafe environment variable value for: ${key}`);
      continue;
    }

    sanitized[key] = value;
  }

  return { sanitized, warnings };
}

/**
 * Validate if a path is within allowed directories (uses DI container)
 */
export async function validatePath(targetPath: string): Promise<{ valid: boolean; error?: string }> {
  const container = getContainer();
  const configLoader = container.get<ConfigLoader>(ServiceKeys.CONFIG_LOADER);
  return validatePathWithConfig(targetPath, configLoader);
}

/**
 * Mask secrets in error messages (with DI)
 */
export function maskSecretsInErrorWithConfig(error: Error, configLoader: ConfigLoader): Error {
  const maskedMessage = configLoader.maskSecrets(error.message);
  const maskedStack = error.stack ? configLoader.maskSecrets(error.stack) : undefined;

  const maskedError = new Error(maskedMessage);
  maskedError.name = error.name;
  maskedError.stack = maskedStack;

  return maskedError;
}

/**
 * Mask secrets in error messages (uses DI container)
 */
export function maskSecretsInError(error: Error): Error {
  const container = getContainer();
  const configLoader = container.get<ConfigLoader>(ServiceKeys.CONFIG_LOADER);
  return maskSecretsInErrorWithConfig(error, configLoader);
}

/**
 * Validate request name for safety
 */
export function validateRequestName(name: string): { valid: boolean; error?: string } {
  // Request names should not contain path traversal attempts
  if (name.includes('..') || name.includes('\\') || name.startsWith('/')) {
    return {
      valid: false,
      error: 'Request name contains invalid characters (path traversal attempt)'
    };
  }

  // Check for null bytes
  if (name.includes('\0')) {
    return {
      valid: false,
      error: 'Request name contains null bytes'
    };
  }

  return { valid: true };
}

/**
 * Validate folder path for safety
 */
export function validateFolderPath(folderPath: string): { valid: boolean; error?: string } {
  // Folder paths should be relative and not contain path traversal
  if (folderPath.includes('..')) {
    return {
      valid: false,
      error: 'Folder path contains path traversal attempts (..)'
    };
  }

  // Should not be absolute path
  if (path.isAbsolute(folderPath)) {
    return {
      valid: false,
      error: 'Folder path must be relative to collection root'
    };
  }

  return { valid: true };
}

/**
 * Comprehensive security validation for tool parameters (with DI)
 */
export async function validateToolParametersWithConfig(
  params: {
    collectionPath?: string;
    requestName?: string;
    folderPath?: string;
    envVariables?: Record<string, string>;
  },
  configLoader: ConfigLoader
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate collection path
  if (params.collectionPath) {
    const pathValidation = await validatePathWithConfig(params.collectionPath, configLoader);
    if (!pathValidation.valid) {
      errors.push(pathValidation.error || 'Invalid collection path');
    }
  }

  // Validate request name
  if (params.requestName) {
    const nameValidation = validateRequestName(params.requestName);
    if (!nameValidation.valid) {
      errors.push(nameValidation.error || 'Invalid request name');
    }
  }

  // Validate folder path
  if (params.folderPath) {
    const folderValidation = validateFolderPath(params.folderPath);
    if (!folderValidation.valid) {
      errors.push(folderValidation.error || 'Invalid folder path');
    }
  }

  // Validate environment variables
  if (params.envVariables) {
    const { warnings: envWarnings } = sanitizeEnvVariables(params.envVariables);
    warnings.push(...envWarnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Comprehensive security validation for tool parameters (uses DI container)
 */
export async function validateToolParameters(
  params: {
    collectionPath?: string;
    requestName?: string;
    folderPath?: string;
    envVariables?: Record<string, string>;
  }
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const container = getContainer();
  const configLoader = container.get<ConfigLoader>(ServiceKeys.CONFIG_LOADER);
  return validateToolParametersWithConfig(params, configLoader);
}

/**
 * Security audit logger (with DI)
 */
export function logSecurityEventWithLogger(
  event: {
    type: 'path_validation' | 'input_sanitization' | 'env_var_validation' | 'access_denied';
    details: string;
    severity: 'info' | 'warning' | 'error';
  },
  logger: Logger
): void {
  // Use logger's logSecurityEvent method
  logger.logSecurityEvent(event.type, event.details, event.severity);
}

/**
 * Security audit logger (uses DI container)
 */
export function logSecurityEvent(
  event: {
    type: 'path_validation' | 'input_sanitization' | 'env_var_validation' | 'access_denied';
    details: string;
    severity: 'info' | 'warning' | 'error';
  }
): void {
  const container = getContainer();
  const logger = container.get<Logger>(ServiceKeys.LOGGER);
  logSecurityEventWithLogger(event, logger);
}

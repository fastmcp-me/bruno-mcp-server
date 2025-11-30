/**
 * Test DI Helper Utilities
 * Factory functions for creating properly-injected service instances in tests
 */

import { BrunoCLI } from '../../bruno-cli.js';
import { ConfigLoader, type BrunoMCPConfig } from '../../config.js';
import { Logger } from '../../logger.js';
import { PerformanceManager } from '../../performance.js';

/**
 * Create a ConfigLoader with optional overrides for testing
 */
export function createTestConfigLoader(overrides?: Partial<BrunoMCPConfig>): ConfigLoader {
  const loader = new ConfigLoader();
  if (overrides) {
    loader.updateConfig(overrides);
  }
  return loader;
}

/**
 * Create all core service instances for testing
 */
export function createTestServices(configOverrides?: Partial<BrunoMCPConfig>): {
  configLoader: ConfigLoader;
  logger: Logger;
  performanceManager: PerformanceManager;
} {
  const configLoader = createTestConfigLoader(configOverrides);
  const logger = new Logger(configLoader);
  const performanceManager = new PerformanceManager(configLoader);

  return { configLoader, logger, performanceManager };
}

/**
 * Create a fully-configured BrunoCLI instance for testing
 */
export function createTestBrunoCLI(
  configOverrides?: Partial<BrunoMCPConfig>,
  brunoPath?: string
): BrunoCLI {
  const { configLoader, performanceManager } = createTestServices(configOverrides);
  return new BrunoCLI(configLoader, performanceManager, brunoPath);
}

/**
 * Create a Logger instance for testing
 */
export function createTestLogger(configOverrides?: Partial<BrunoMCPConfig>): Logger {
  const configLoader = createTestConfigLoader(configOverrides);
  return new Logger(configLoader);
}

/**
 * Create a PerformanceManager instance for testing
 */
export function createTestPerformanceManager(configOverrides?: Partial<BrunoMCPConfig>): PerformanceManager {
  const configLoader = createTestConfigLoader(configOverrides);
  return new PerformanceManager(configLoader);
}

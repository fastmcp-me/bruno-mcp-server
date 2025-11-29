/**
 * Simple Dependency Injection Container
 * Manages singleton instances of services and utilities
 */

export class Container {
  private services: Map<string, unknown> = new Map();

  /**
   * Register a service instance
   */
  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  /**
   * Get a service instance
   */
  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service '${key}' not found in container. Did you forget to register it?`);
    }
    return service as T;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all registered services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * Service keys for type-safe retrieval
 */
export const ServiceKeys = {
  CONFIG_LOADER: 'configLoader',
  LOGGER: 'logger',
  PERFORMANCE_MANAGER: 'performanceManager',
  BRUNO_CLI: 'brunoCLI',
  REQUEST_EXECUTION_SERVICE: 'requestExecutionService',
  COLLECTION_DISCOVERY_SERVICE: 'collectionDiscoveryService',
  ENVIRONMENT_SERVICE: 'environmentService',
  VALIDATION_SERVICE: 'validationService'
} as const;

/**
 * Global container instance
 */
let containerInstance: Container | null = null;

/**
 * Get the global container instance
 */
export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}

/**
 * Set a custom container instance (useful for testing)
 */
export function setContainer(container: Container): void {
  containerInstance = container;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  containerInstance = null;
}

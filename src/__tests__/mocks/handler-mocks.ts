/**
 * Centralized mock data for handler tests
 * Provides reusable mock objects for BrunoRequest, environments, validation results, etc.
 */

import type { BrunoRequest } from '../../bruno-cli.js';

// Mock BrunoRequest objects
export const mockRequests: BrunoRequest[] = [
  {
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    folder: undefined,
    path: '/test/collection/Get Users.bru'
  },
  {
    name: 'Create User',
    method: 'POST',
    url: 'https://api.example.com/users',
    folder: 'users',
    path: '/test/collection/users/Create User.bru'
  },
  {
    name: 'Update User',
    method: 'PUT',
    url: 'https://api.example.com/users/1',
    folder: 'users',
    path: '/test/collection/users/Update User.bru'
  },
  {
    name: 'Delete User',
    method: 'DELETE',
    url: 'https://api.example.com/users/1',
    folder: 'users',
    path: '/test/collection/users/Delete User.bru'
  }
];

// Mock environments
export const mockEnvironments = [
  {
    name: 'dev',
    path: '/path/to/dev.bru',
    variables: {
      API_URL: 'http://localhost:3000',
      API_KEY: 'dev-key-123'
    }
  },
  {
    name: 'staging',
    path: '/path/to/staging.bru',
    variables: {
      API_URL: 'https://staging.api.example.com',
      API_KEY: 'staging-key-456'
    }
  },
  {
    name: 'prod',
    path: '/path/to/prod.bru',
    variables: {
      API_URL: 'https://api.example.com',
      API_KEY: 'prod-key-789'
    }
  }
];

// Mock validation results
export const mockValidationResults = {
  valid: {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      hasBrunoJson: true,
      totalRequests: 10,
      validRequests: 10,
      invalidRequests: 0,
      environments: 3
    }
  },
  invalid: {
    valid: false,
    errors: ['Missing bruno.json', 'Invalid request syntax in Get Users.bru'],
    warnings: [],
    summary: {
      hasBrunoJson: false,
      totalRequests: 5,
      validRequests: 3,
      invalidRequests: 2,
      environments: 0
    }
  },
  withWarnings: {
    valid: true,
    errors: [],
    warnings: ['Unused environment variable: OLD_API_KEY', 'Deprecated syntax in Create User.bru'],
    summary: {
      hasBrunoJson: true,
      totalRequests: 8,
      validRequests: 8,
      invalidRequests: 0,
      environments: 2
    }
  }
};

// Mock environment validation results
export const mockEnvironmentValidation = {
  valid: {
    valid: true,
    exists: true,
    errors: [],
    warnings: [],
    variables: {
      API_URL: 'https://api.example.com',
      API_KEY: 'test-key'
    }
  },
  nonExistent: {
    valid: false,
    exists: false,
    errors: ['Environment file not found: nonexistent.bru'],
    warnings: [],
    variables: undefined
  },
  withWarnings: {
    valid: true,
    exists: true,
    errors: [],
    warnings: ['Variable API_KEY contains hardcoded secret'],
    variables: {
      API_URL: 'https://api.example.com',
      API_KEY: 'hardcoded-secret-123'
    }
  }
};

// Mock request details
export const mockRequestDetails = {
  basic: {
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer {{API_KEY}}'
    },
    auth: 'bearer',
    metadata: {
      type: 'http',
      seq: 1
    }
  },
  withBody: {
    name: 'Create User',
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      type: 'json',
      content: '{"name": "John Doe", "email": "john@example.com"}'
    },
    auth: 'none',
    metadata: {
      type: 'http',
      seq: 2
    }
  },
  withTests: {
    name: 'Get User by ID',
    method: 'GET',
    url: 'https://api.example.com/users/1',
    headers: {},
    auth: 'none',
    tests: [
      'expect(res.status).toBe(200);',
      'expect(res.body).toHaveProperty(\'id\');',
      'expect(res.body.id).toBe(1);'
    ],
    metadata: {
      type: 'http',
      seq: 3
    }
  }
};

// Mock health check data
export const mockHealthCheckData = {
  basic: {
    config: {},
    brunoCliAvailable: true,
    brunoCLIVersion: '1.0.0',
    includeMetrics: false,
    includeCacheStats: false
  },
  withMetrics: {
    config: {},
    brunoCliAvailable: true,
    brunoCLIVersion: '1.0.0',
    includeMetrics: true,
    includeCacheStats: false,
    metricsSummary: {
      totalExecutions: 100,
      successRate: 95,
      byTool: {
        'bruno_run_request': { count: 50, avgDuration: 250, successRate: 98 },
        'bruno_list_requests': { count: 30, avgDuration: 50, successRate: 100 },
        'bruno_run_collection': { count: 20, avgDuration: 2000, successRate: 90 }
      }
    }
  },
  withCacheStats: {
    config: {},
    brunoCliAvailable: true,
    brunoCLIVersion: '1.0.0',
    includeMetrics: false,
    includeCacheStats: true,
    cacheStats: {
      requestList: { size: 10, keys: ['/collection1', '/collection2'] },
      collectionDiscovery: { size: 5, keys: ['/search1'] },
      environmentList: { size: 3, keys: ['/env1', '/env2', '/env3'] },
      fileContent: { size: 20, keys: ['/file1.bru', '/file2.bru'] }
    }
  }
};

// Mock run results
export const mockRunResults = {
  successful: {
    summary: {
      totalRequests: 1,
      passedRequests: 1,
      failedRequests: 0,
      totalDuration: 250
    },
    results: [
      {
        name: 'Get Users',
        passed: true,
        duration: 250,
        request: { method: 'GET', url: '/users' },
        response: {
          status: 200,
          statusText: 'OK',
          responseTime: 250,
          headers: { 'content-type': 'application/json' },
          body: { users: [] }
        }
      }
    ],
    exitCode: 0,
    stdout: 'Execution completed successfully',
    stderr: ''
  },
  failed: {
    summary: {
      totalRequests: 1,
      passedRequests: 0,
      failedRequests: 1,
      totalDuration: 100
    },
    results: [
      {
        name: 'Create User',
        passed: false,
        duration: 100,
        request: { method: 'POST', url: '/users' },
        response: {
          status: 400,
          statusText: 'Bad Request',
          responseTime: 100,
          headers: {},
          body: { error: 'Invalid data' }
        },
        error: 'Request failed with status 400'
      }
    ],
    exitCode: 1,
    stdout: '',
    stderr: 'Error: Request failed'
  }
};

// Mock discovered collections
export const mockCollections = [
  '/home/user/collections/api-tests',
  '/home/user/collections/integration-tests',
  '/home/user/projects/my-api/bruno-collection'
];

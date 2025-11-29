/**
 * Service for validating Bruno collections and requests
 * Handles request detail parsing and collection validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface RequestDetails {
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
}

export interface CollectionValidationResult {
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
}

/**
 * Service responsible for validation operations
 * Single Responsibility: Validate collections and parse request details
 */
export class ValidationService {
  /**
   * Get detailed information about a request
   */
  async getRequestDetails(
    requestFilePath: string,
    requestName: string
  ): Promise<RequestDetails> {
    // Read and parse the .bru file
    const content = await fs.readFile(requestFilePath, 'utf-8');

    const details: RequestDetails = {
      name: requestName,
      method: 'GET',
      url: '',
      headers: {},
      body: undefined,
      auth: 'none',
      tests: [],
      metadata: {
        type: 'http',
        seq: undefined
      }
    };

    // Parse metadata block
    const metaMatch = content.match(/meta\s*\{([\s\S]*?)\n\}/s);
    if (metaMatch) {
      const metaContent = metaMatch[1];
      const nameMatch = metaContent.match(/name:\s*(.+)/);
      if (nameMatch) details.name = nameMatch[1].trim();

      const typeMatch = metaContent.match(/type:\s*(.+)/);
      if (typeMatch) details.metadata.type = typeMatch[1].trim();

      const seqMatch = metaContent.match(/seq:\s*(\d+)/);
      if (seqMatch) details.metadata.seq = parseInt(seqMatch[1]);
    }

    // Parse method block (get, post, put, patch, delete, etc.)
    const methodBlocks = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methodBlocks) {
      const methodRegex = new RegExp(`${method}\\s*\\{([\\s\\S]*?)\\n\\}`, 's');
      const methodMatch = content.match(methodRegex);
      if (methodMatch) {
        details.method = method.toUpperCase();
        const methodContent = methodMatch[1];

        const urlMatch = methodContent.match(/url:\s*(.+)/);
        if (urlMatch) details.url = urlMatch[1].trim();

        const authMatch = methodContent.match(/auth:\s*(.+)/);
        if (authMatch) details.auth = authMatch[1].trim();

        break;
      }
    }

    // Parse headers block
    const headersMatch = content.match(/headers\s*\{([\s\S]*?)\n\}/s);
    if (headersMatch) {
      const headersContent = headersMatch[1];
      const headerLines = headersContent.split('\n').filter(line => line.trim());

      for (const line of headerLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          details.headers[key] = value;
        }
      }
    }

    // Parse body block
    const bodyTypeMatch = content.match(/body:(json|text|xml|formUrlEncoded|multipartForm|graphql|sparql|none)\s*\{/);
    if (bodyTypeMatch) {
      const bodyType = bodyTypeMatch[1];
      const bodyRegex = new RegExp(`body:${bodyType}\\s*\\{([\\s\\S]*?)\\n\\}`, 's');
      const bodyMatch = content.match(bodyRegex);

      if (bodyMatch) {
        details.body = {
          type: bodyType,
          content: bodyMatch[1].trim()
        };
      }
    }

    // Parse tests block
    const testsMatch = content.match(/tests\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
    if (testsMatch) {
      const testsContent = testsMatch[1];
      // Extract test function calls
      const testRegex = /test\s*\(\s*["']([^"']+)["']/g;
      let testMatch;

      while ((testMatch = testRegex.exec(testsContent)) !== null) {
        details.tests!.push(testMatch[1]);
      }
    }

    return details;
  }

  /**
   * Validate a Bruno collection
   */
  async validateCollection(
    collectionPath: string,
    listRequests: () => Promise<any[]>,
    listEnvironments: () => Promise<any[]>,
    validateEnvironment: (envName: string) => Promise<any>,
    getRequestDetails: (reqName: string) => Promise<any>
  ): Promise<CollectionValidationResult> {
    const result: CollectionValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        hasBrunoJson: false,
        totalRequests: 0,
        validRequests: 0,
        invalidRequests: 0,
        environments: 0
      }
    };

    // Check if collection directory exists
    try {
      await fs.access(collectionPath);
    } catch {
      result.valid = false;
      result.errors.push(`Collection directory not found: ${collectionPath}`);
      return result;
    }

    // Check for bruno.json
    const brunoJsonPath = path.join(collectionPath, 'bruno.json');
    try {
      await fs.access(brunoJsonPath);
      result.summary.hasBrunoJson = true;

      // Validate bruno.json structure
      const brunoJsonContent = await fs.readFile(brunoJsonPath, 'utf-8');
      try {
        const brunoJson = JSON.parse(brunoJsonContent);

        // Check required fields
        if (!brunoJson.version) {
          result.warnings.push('bruno.json missing "version" field');
        }
        if (!brunoJson.name) {
          result.warnings.push('bruno.json missing "name" field');
        }
        if (!brunoJson.type) {
          result.warnings.push('bruno.json missing "type" field');
        } else if (brunoJson.type !== 'collection') {
          result.errors.push(`Invalid type in bruno.json: expected "collection", got "${brunoJson.type}"`);
          result.valid = false;
        }
      } catch (error) {
        result.errors.push(`Invalid JSON in bruno.json: ${error}`);
        result.valid = false;
      }
    } catch {
      result.errors.push('bruno.json not found in collection root');
      result.valid = false;
      return result;
    }

    // Validate requests
    try {
      const requests = await listRequests();
      result.summary.totalRequests = requests.length;

      if (requests.length === 0) {
        result.warnings.push('Collection contains no requests');
      }

      // Validate each request file
      for (const req of requests) {
        try {
          await getRequestDetails(req.name);
          result.summary.validRequests++;
        } catch (error) {
          result.summary.invalidRequests++;
          result.errors.push(`Invalid request "${req.name}": ${error}`);
          result.valid = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to list requests: ${error}`);
      result.valid = false;
    }

    // Check for environments
    try {
      const environments = await listEnvironments();
      result.summary.environments = environments.length;

      if (environments.length === 0) {
        result.warnings.push('No environments found in collection');
      }

      // Validate each environment
      for (const env of environments) {
        const validation = await validateEnvironment(env.name);
        if (!validation.valid) {
          result.warnings.push(`Environment "${env.name}" has issues: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
          validation.warnings.forEach((w: string) => result.warnings.push(`Environment "${env.name}": ${w}`));
        }
      }
    } catch (error) {
      // Environments are optional, so this is just a warning
      result.warnings.push('Could not validate environments');
    }

    return result;
  }
}

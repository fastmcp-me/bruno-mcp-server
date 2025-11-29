/**
 * Service for discovering and listing Bruno collections and requests
 * Handles collection discovery, request listing, and file searching
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { BrunoRequest } from '../bruno-cli.js';
import { getPerformanceManager } from '../performance.js';

// Re-export BrunoRequest for convenience
export type { BrunoRequest };

/**
 * Service responsible for discovering collections and listing requests
 * Single Responsibility: Collection and request discovery operations
 */
export class CollectionDiscoveryService {
  /**
   * List all requests in a collection
   */
  async listRequests(collectionPath: string): Promise<BrunoRequest[]> {
    try {
      // Check cache first
      const perfManager = getPerformanceManager();
      const cached = perfManager.getCachedRequestList(collectionPath);
      if (cached) {
        console.error(`Using cached request list for: ${collectionPath}`);
        return cached;
      }

      // Check if the collection path exists
      const stats = await fs.stat(collectionPath);
      if (!stats.isDirectory()) {
        throw new Error(`Collection path is not a directory: ${collectionPath}`);
      }

      // Check if it's a valid Bruno collection (should have bruno.json or collection.bru)
      const hasCollectionFile = await this.hasCollectionFile(collectionPath);
      if (!hasCollectionFile) {
        throw new Error(`Not a valid Bruno collection: ${collectionPath}`);
      }

      // Find all .bru files in the collection
      const requests = await this.findBrunoRequests(collectionPath);

      // Cache the results
      perfManager.cacheRequestList(collectionPath, requests);

      return requests;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Collection not found: ${collectionPath}`);
      }
      throw error;
    }
  }

  /**
   * Discover Bruno collections in a directory tree
   */
  async discoverCollections(searchPath: string, maxDepth: number = 5): Promise<string[]> {
    const perfManager = getPerformanceManager();

    // Check cache first
    const cached = perfManager.getCachedCollectionDiscovery(searchPath);
    if (cached) {
      return cached;
    }

    const collections: string[] = [];
    const maxSearchDepth = Math.min(maxDepth, 10); // Cap at 10 for safety

    const searchDirectory = async (dirPath: string, currentDepth: number): Promise<void> => {
      if (currentDepth > maxSearchDepth) {
        return;
      }

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        // Check if this directory contains bruno.json
        const hasBrunoJson = entries.some(entry =>
          entry.isFile() && entry.name === 'bruno.json'
        );

        if (hasBrunoJson) {
          collections.push(dirPath);
          // Don't search subdirectories of a collection
          return;
        }

        // Recursively search subdirectories
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subPath = path.join(dirPath, entry.name);
            await searchDirectory(subPath, currentDepth + 1);
          }
        }
      } catch (error) {
        // Silently skip directories we can't read
        console.error(`Cannot read directory: ${dirPath}`, error);
      }
    };

    await searchDirectory(searchPath, 0);

    // Cache the results
    perfManager.cacheCollectionDiscovery(searchPath, collections);

    return collections;
  }

  /**
   * Find a specific request file by name
   */
  async findRequestFile(collectionPath: string, requestName: string): Promise<string | null> {
    const requests = await this.findBrunoRequests(collectionPath);

    // Try exact match first
    let request = requests.find(r => r.name === requestName);

    // Try case-insensitive match
    if (!request) {
      request = requests.find(r => r.name.toLowerCase() === requestName.toLowerCase());
    }

    // Try partial match
    if (!request) {
      request = requests.find(r => r.name.includes(requestName));
    }

    return request?.path || null;
  }

  /**
   * Check if directory has a Bruno collection file
   */
  private async hasCollectionFile(dirPath: string): Promise<boolean> {
    try {
      // Check for bruno.json or collection.bru
      const brunoJsonPath = path.join(dirPath, 'bruno.json');
      const collectionBruPath = path.join(dirPath, 'collection.bru');

      try {
        await fs.access(brunoJsonPath);
        return true;
      } catch {
        // Try collection.bru
        try {
          await fs.access(collectionBruPath);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Recursively find all Bruno request files
   */
  private async findBrunoRequests(
    dirPath: string,
    basePath: string = dirPath,
    requests: BrunoRequest[] = []
  ): Promise<BrunoRequest[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Skip node_modules and other common non-request directories
        if (entry.name === 'node_modules' || entry.name === 'environments') {
          continue;
        }
        // Recursively search subdirectories
        await this.findBrunoRequests(fullPath, basePath, requests);
      } else if (entry.isFile() && entry.name.endsWith('.bru')) {
        // Skip collection.bru as it's not a request
        if (entry.name === 'collection.bru') {
          continue;
        }

        // Parse the .bru file for basic info
        const requestInfo = await this.parseBrunoFile(fullPath);
        const relativePath = path.relative(basePath, dirPath);

        requests.push({
          name: path.basename(entry.name, '.bru'),
          folder: relativePath || undefined,
          path: fullPath,
          ...requestInfo
        });
      }
    }

    return requests;
  }

  /**
   * Parse a Bruno request file for basic information
   */
  private async parseBrunoFile(filePath: string): Promise<Partial<BrunoRequest>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const info: Partial<BrunoRequest> = {};

      // Look for meta name first
      let inMeta = false;
      for (const line of lines) {
        if (line.trim() === 'meta {') {
          inMeta = true;
          continue;
        }
        if (inMeta && line.trim() === '}') {
          inMeta = false;
          continue;
        }
        if (inMeta) {
          const nameMatch = line.match(/^\s*name:\s*(.+)/);
          if (nameMatch) {
            info.name = nameMatch[1].trim();
          }
        }

        // Look for method and URL
        const methodMatch = line.match(/^(get|post|put|delete|patch|head|options)\s*\{/i);
        if (methodMatch) {
          info.method = methodMatch[1].toUpperCase();
          // Look for URL in the next few lines
          const urlIndex = lines.indexOf(line);
          for (let i = urlIndex + 1; i < Math.min(urlIndex + 5, lines.length); i++) {
            const urlMatch = lines[i].match(/^\s*url:\s*(.+)/);
            if (urlMatch) {
              info.url = urlMatch[1].trim();
              break;
            }
          }
        }
      }

      return info;
    } catch {
      // If we can't parse the file, just return empty info
      return {};
    }
  }
}

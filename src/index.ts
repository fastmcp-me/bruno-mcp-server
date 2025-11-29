#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { BrunoCLI } from './bruno-cli.js';
import { initializeConfig, getConfigLoader } from './config.js';
import { getLogger } from './logger.js';
import { getPerformanceManager } from './performance.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { DiscoverCollectionsHandler } from './tools/handlers/DiscoverCollectionsHandler.js';
import { GetRequestDetailsHandler } from './tools/handlers/GetRequestDetailsHandler.js';
import { HealthCheckHandler } from './tools/handlers/HealthCheckHandler.js';
import { ListEnvironmentsHandler } from './tools/handlers/ListEnvironmentsHandler.js';
import { ListRequestsHandler } from './tools/handlers/ListRequestsHandler.js';
import { RunCollectionHandler } from './tools/handlers/RunCollectionHandler.js';
import { RunRequestHandler } from './tools/handlers/RunRequestHandler.js';
import { ValidateCollectionHandler } from './tools/handlers/ValidateCollectionHandler.js';
import { ValidateEnvironmentHandler } from './tools/handlers/ValidateEnvironmentHandler.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'bruno_run_request',
    description: 'Run a specific request from a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        requestName: {
          type: 'string',
          description: 'Name of the request to run'
        },
        environment: {
          type: 'string',
          description: 'Name or path of the environment to use'
        },
        enviroment: {
          type: 'string',
          description: 'Alias for environment (to handle common typo)'
        },
        envVariables: {
          type: 'object',
          description: 'Environment variables as key-value pairs',
          additionalProperties: { type: 'string' }
        },
        reporterJson: {
          type: 'string',
          description: 'Path to write JSON report'
        },
        reporterJunit: {
          type: 'string',
          description: 'Path to write JUnit XML report'
        },
        reporterHtml: {
          type: 'string',
          description: 'Path to write HTML report'
        },
        dryRun: {
          type: 'boolean',
          description: 'Validate request without executing HTTP call'
        }
      },
      required: ['collectionPath', 'requestName']
    }
  },
  {
    name: 'bruno_run_collection',
    description: 'Run all requests in a Bruno collection or specific folder',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        environment: {
          type: 'string',
          description: 'Name or path of the environment to use'
        },
        enviroment: {
          type: 'string',
          description: 'Alias for environment (to handle common typo)'
        },
        folderPath: {
          type: 'string',
          description: 'Specific folder within collection to run'
        },
        envVariables: {
          type: 'object',
          description: 'Environment variables as key-value pairs',
          additionalProperties: { type: 'string' }
        },
        reporterJson: {
          type: 'string',
          description: 'Path to write JSON report'
        },
        reporterJunit: {
          type: 'string',
          description: 'Path to write JUnit XML report'
        },
        reporterHtml: {
          type: 'string',
          description: 'Path to write HTML report'
        },
        dryRun: {
          type: 'boolean',
          description: 'Validate requests without executing HTTP calls'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_list_requests',
    description: 'List all requests in a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_health_check',
    description: 'Check the health status of the Bruno MCP server and Bruno CLI',
    inputSchema: {
      type: 'object',
      properties: {
        includeMetrics: {
          type: 'boolean',
          description: 'Include performance metrics in output'
        },
        includeCacheStats: {
          type: 'boolean',
          description: 'Include cache statistics in output'
        }
      }
    }
  },
  {
    name: 'bruno_discover_collections',
    description: 'Discover Bruno collections in a directory tree',
    inputSchema: {
      type: 'object',
      properties: {
        searchPath: {
          type: 'string',
          description: 'Directory path to search for Bruno collections'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum directory depth to search (default: 5)'
        }
      },
      required: ['searchPath']
    }
  },
  {
    name: 'bruno_list_environments',
    description: 'List all environments in a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_validate_environment',
    description: 'Validate an environment file in a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        environmentName: {
          type: 'string',
          description: 'Name of the environment to validate'
        }
      },
      required: ['collectionPath', 'environmentName']
    }
  },
  {
    name: 'bruno_get_request_details',
    description: 'Get detailed information about a specific request without executing it',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        requestName: {
          type: 'string',
          description: 'Name of the request to inspect'
        }
      },
      required: ['collectionPath', 'requestName']
    }
  },
  {
    name: 'bruno_validate_collection',
    description: "Validate a Bruno collection's structure and configuration",
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection to validate'
        }
      },
      required: ['collectionPath']
    }
  }
];

class BrunoMCPServer {
  private server: Server;
  private brunoCLI: BrunoCLI;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: 'bruno-mcp-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.brunoCLI = new BrunoCLI();
    this.toolRegistry = new ToolRegistry();

    this.registerToolHandlers();
    this.setupHandlers();

    // Check Bruno CLI availability on startup
    void this.checkBrunoCLI();
  }

  private async checkBrunoCLI(): Promise<void> {
    const logger = getLogger();
    const isAvailable = await this.brunoCLI.isAvailable();
    if (!isAvailable) {
      void logger.warning('Bruno CLI is not available', { suggestion: 'Run npm install to install dependencies' });
      console.error('Warning: Bruno CLI is not available. Please run "npm install" to install dependencies.');
    } else {
      void logger.info('Bruno CLI is available and ready');
    }
  }

  private registerToolHandlers(): void {
    const configLoader = getConfigLoader();
    const perfManager = getPerformanceManager();

    // Register all tool handlers
    this.toolRegistry.register(new RunRequestHandler(this.brunoCLI));
    this.toolRegistry.register(new RunCollectionHandler(this.brunoCLI));
    this.toolRegistry.register(new ListRequestsHandler(this.brunoCLI));
    this.toolRegistry.register(new HealthCheckHandler(this.brunoCLI, configLoader, perfManager));
    this.toolRegistry.register(new DiscoverCollectionsHandler(this.brunoCLI));
    this.toolRegistry.register(new ListEnvironmentsHandler(this.brunoCLI));
    this.toolRegistry.register(new ValidateEnvironmentHandler(this.brunoCLI));
    this.toolRegistry.register(new GetRequestDetailsHandler(this.brunoCLI));
    this.toolRegistry.register(new ValidateCollectionHandler(this.brunoCLI));
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS
    }));

    // Handle tool execution using registry
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const logger = getLogger();
      const startTime = Date.now();

      try {
        void logger.info(`Executing tool: ${name}`, { tool: name });

        // Get handler from registry
        const handler = this.toolRegistry.get(name);

        if (!handler) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool '${name}' is not supported by Bruno MCP server`
          );
        }

        // Execute handler
        const result = await handler.handle(args);

        // Log successful execution
        const duration = Date.now() - startTime;
        logger.logToolExecution(name, args, duration, true);

        return {
          content: result.content
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution(name, args, duration, false);

        if (error instanceof McpError) {
          void logger.error(`Tool execution failed: ${name}`, error, { tool: name });
          throw error;
        }

        // Convert other errors to MCP errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        void logger.error(`Tool execution error: ${name}`, error instanceof Error ? error : new Error(errorMessage), { tool: name });

        throw new McpError(
          ErrorCode.InternalError,
          `Bruno CLI error: ${errorMessage}`
        );
      }
    });
  }

  async run(): Promise<void> {
    const logger = getLogger();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    const configLoader = getConfigLoader();
    const config = configLoader.getConfig();

    void logger.info('Bruno MCP Server started successfully', {
      version: '0.1.0',
      loggingLevel: config.logging?.level || 'info',
      retryEnabled: config.retry?.enabled || false,
      cacheEnabled: config.performance?.cacheEnabled !== false
    });

    console.error('Bruno MCP Server started successfully');
    console.error(`Configuration: ${config.logging?.level || 'info'} logging, ${config.retry?.enabled ? 'retry enabled' : 'retry disabled'}`);
  }
}

// Initialize configuration and start the server
void (async () => {
  try {
    await initializeConfig();
    const server = new BrunoMCPServer();
    await server.run();
  } catch (error) {
    console.error('Fatal error starting Bruno MCP Server:', error);
    process.exit(1);
  }
})();

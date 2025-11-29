/**
 * Formatter for request lists
 * Formats a list of Bruno requests in a human-readable format
 */

import type { BrunoRequest } from '../../bruno-cli.js';

export class RequestListFormatter {
  format(requests: BrunoRequest[]): string {
    if (requests.length === 0) {
      return 'No requests found in the collection.';
    }

    const output = [`Found ${requests.length} request(s):\n`];

    requests.forEach(req => {
      output.push(`• ${req.name}`);
      if (req.method && req.url) {
        output.push(`  ${req.method} ${req.url}`);
      }
      if (req.folder) {
        output.push(`  Folder: ${req.folder}`);
      }
    });

    return output.join('\n');
  }
}

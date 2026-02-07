import { minimatch } from 'minimatch';
import * as path from 'path';
import { DestinationMapping, getDestinationMappings, getFileExtensions } from '../config/settings';

export function resolveDestination(
  remotePath: string,
  mappings?: DestinationMapping
): string {
  const effectiveMappings = mappings ?? getDestinationMappings();

  // Use posix paths for matching (GitHub always uses forward slashes)
  const posixPath = remotePath.replace(/\\/g, '/');

  // Check if the remote path already starts with the default destination
  // to avoid duplication like .github/.github/agents/file.md
  const defaultDest = effectiveMappings.default.replace(/\\/g, '/');

  if (posixPath.startsWith(defaultDest + '/') || posixPath === defaultDest) {
    // Path already includes the destination directory - use it as-is
    return posixPath;
  }

  // Path doesn't include destination - prepend it
  return path.posix.join(defaultDest, posixPath);
}

export function isAllowedExtension(
  fileName: string,
  allowedExtensions?: string[]
): boolean {
  const extensions = allowedExtensions ?? getFileExtensions();
  const ext = path.posix.extname(fileName).toLowerCase();
  return extensions.some((allowed) => allowed.toLowerCase() === ext);
}

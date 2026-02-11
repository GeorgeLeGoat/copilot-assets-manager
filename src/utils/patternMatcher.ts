import { minimatch } from 'minimatch';
import * as path from 'path';
import { DestinationMapping, getDestinationMappings, getFileExtensions, getExcludePatterns } from '../config/settings';

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

/**
 * Returns true if the given file path matches any of the exclude patterns.
 * Patterns follow glob syntax (like .gitignore):
 *   - "README.md"     → matches any file named README.md (any depth)
 *   - "docs/**"       → matches everything inside docs/
 *   - "**\/*.test.md" → matches all .test.md files
 *   - ".github/CODEOWNERS" → matches this exact path
 */
export function isExcluded(filePath: string, patterns?: string[]): boolean {
  const effectivePatterns = patterns ?? getExcludePatterns();
  if (effectivePatterns.length === 0) {
    return false;
  }

  // Normalize to forward slashes (GitHub paths, also handles Windows paths in tests)
  const posixPath = filePath.replace(/\\/g, '/');

  return effectivePatterns.some((pattern) =>
    minimatch(posixPath, pattern, { matchBase: true, dot: true })
  );
}

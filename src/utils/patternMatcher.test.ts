import { describe, it, expect } from 'vitest';
import { resolveDestination, isAllowedExtension, isExcluded } from './patternMatcher';

describe('resolveDestination', () => {
  const mappings = {
    default: '.github',
    rules: [],
  };

  it('preserves full path structure from repository', () => {
    expect(resolveDestination('readme.md', mappings)).toBe('.github/readme.md');
  });

  it('preserves path for files at root', () => {
    expect(resolveDestination('copilot-instructions.md', mappings)).toBe(
      '.github/copilot-instructions.md'
    );
  });

  it('preserves subdirectory structure for agents', () => {
    expect(resolveDestination('agents/cobol-reviewer.md', mappings)).toBe(
      '.github/agents/cobol-reviewer.md'
    );
  });

  it('preserves nested directory structure', () => {
    expect(resolveDestination('src/agents/reviewer.md', mappings)).toBe(
      '.github/src/agents/reviewer.md'
    );
  });

  it('preserves subdirectory structure for prompts', () => {
    expect(resolveDestination('prompts/my-prompt.md', mappings)).toBe(
      '.github/prompts/my-prompt.md'
    );
  });

  it('preserves deep directory structures', () => {
    expect(resolveDestination('team/agents/cobol/reviewer.md', mappings)).toBe(
      '.github/team/agents/cobol/reviewer.md'
    );
  });

  it('works with custom default destination', () => {
    expect(resolveDestination('agents/file.md', { default: 'copilot-assets', rules: [] })).toBe(
      'copilot-assets/agents/file.md'
    );
  });

  it('avoids duplication when path already starts with destination', () => {
    expect(resolveDestination('.github/agents/file.md', mappings)).toBe(
      '.github/agents/file.md'
    );
  });

  it('avoids duplication for nested paths already in destination', () => {
    expect(resolveDestination('.github/skills/my-skill/SKILL.md', mappings)).toBe(
      '.github/skills/my-skill/SKILL.md'
    );
  });

  it('handles case where remote path is exactly the destination', () => {
    expect(resolveDestination('.github', mappings)).toBe('.github');
  });

  it('prepends destination when path does not start with it', () => {
    expect(resolveDestination('skills/my-skill/SKILL.md', mappings)).toBe(
      '.github/skills/my-skill/SKILL.md'
    );
  });
});

describe('isAllowedExtension', () => {
  const extensions = ['.md', '.json', '.yml', '.yaml', '.prompt'];

  it('allows .md', () => {
    expect(isAllowedExtension('file.md', extensions)).toBe(true);
  });

  it('allows .json', () => {
    expect(isAllowedExtension('config.json', extensions)).toBe(true);
  });

  it('allows .yml', () => {
    expect(isAllowedExtension('config.yml', extensions)).toBe(true);
  });

  it('allows .prompt', () => {
    expect(isAllowedExtension('my.prompt', extensions)).toBe(true);
  });

  it('rejects .ts', () => {
    expect(isAllowedExtension('code.ts', extensions)).toBe(false);
  });

  it('rejects .js', () => {
    expect(isAllowedExtension('code.js', extensions)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAllowedExtension('README.MD', extensions)).toBe(true);
  });

  it('rejects files without extension', () => {
    expect(isAllowedExtension('Dockerfile', extensions)).toBe(false);
  });
});

describe('isExcluded', () => {
  it('returns false when no patterns are provided', () => {
    expect(isExcluded('README.md', [])).toBe(false);
  });

  it('matches exact filename at root', () => {
    expect(isExcluded('README.md', ['README.md'])).toBe(true);
  });

  it('matches filename in subdirectory (matchBase)', () => {
    expect(isExcluded('docs/README.md', ['README.md'])).toBe(true);
  });

  it('matches filename deeply nested (matchBase)', () => {
    expect(isExcluded('agents/cobol/README.md', ['README.md'])).toBe(true);
  });

  it('matches glob pattern with wildcard', () => {
    expect(isExcluded('docs/guide.md', ['docs/**'])).toBe(true);
  });

  it('does not match when pattern is different filename', () => {
    expect(isExcluded('SKILL.md', ['README.md'])).toBe(false);
  });

  it('matches with **/*.test.md pattern', () => {
    expect(isExcluded('agents/cobol.test.md', ['**/*.test.md'])).toBe(true);
  });

  it('does not exclude non-matching files', () => {
    expect(isExcluded('agents/cobol.md', ['**/*.test.md'])).toBe(false);
  });

  it('matches exact path pattern', () => {
    expect(isExcluded('.github/CODEOWNERS', ['.github/CODEOWNERS'])).toBe(true);
  });

  it('matches dot files', () => {
    expect(isExcluded('.gitignore', ['.gitignore'])).toBe(true);
  });

  it('supports multiple patterns (any match)', () => {
    expect(isExcluded('README.md', ['CHANGELOG.md', 'README.md'])).toBe(true);
  });

  it('normalizes Windows backslashes before matching', () => {
    expect(isExcluded('docs\\README.md', ['README.md'])).toBe(true);
  });
});

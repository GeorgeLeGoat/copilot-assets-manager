import { describe, it, expect } from 'vitest';
import { resolveDestination, isAllowedExtension } from './patternMatcher';

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

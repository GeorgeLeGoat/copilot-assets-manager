# Changelog

All notable changes to the Copilot Assets Manager extension will be documented in this file.

## [0.2.6] - 2026-02-07

### Added
- **Exclude Patterns**: New `copilotAssetsManager.excludePatterns` setting to hide files or directories from scanning
  - Supports glob syntax like `.gitignore` (e.g. `README.md`, `docs/**`, `**/*.test.md`)
  - A pattern without a slash matches any file with that name at any depth
  - An exact path like `.github/CODEOWNERS` matches only that specific file
  - Applied during repository scanning — excluded files never appear in the tree view

## [0.2.5] - 2026-02-07

### Changed
- **Description View**: Replaced TreeView with WebView for better text display
  - Native word-wrap and automatic line breaks
  - Text is selectable and copyable
  - Better visual styling with VS Code theme integration
  - Scrollable content for long descriptions
  - Styled container with proper padding and borders

## [0.2.4] - 2026-02-07

### Added
- **Description View**: New panel below the Assets view that displays the description of the selected asset
  - Automatically extracts description from YAML frontmatter (`description:` field)
  - Supports multi-line descriptions with `|` or `>` syntax
  - Falls back to Markdown `## Description` section if no frontmatter found
  - Works for all file types: agents (`.md`), instructions (`.md`), prompts (`.md`)
  - For skills, displays description from `SKILL.md` file
  - Updates in real-time when selecting different assets in the tree

## [0.2.3] - 2026-02-07

### Fixed
- **Skills update detection**: Skills now use combined SHA hash of ALL files in the directory
  - Previously only `SKILL.md` file was checked for updates
  - Now any change to any file or subdirectory in a skill triggers an update notification
  - Added `computeCombinedRemoteSha()` and `computeCombinedLocalHash()` functions
  - Skills manifest entry stores combined hash for accurate change detection

### Added
- 9 new unit tests for combined hash computation (71 total tests, all passing)

## [0.2.2] - 2026-02-07

### Fixed
- **Critical fix**: Skills detection now correctly looks for `SKILL.md` (singular) instead of `SKILLS.md` (plural)
- Updated all documentation to reflect the correct filename

## [0.2.1] - 2026-02-07

### Changed
- Enhanced skill display in TreeView with emoji indicator 🎓 and file count
- Skill description now shows: `🎓 Skill (X files) - [status]` for better visibility

## [0.2.0] - 2026-02-07

### Added
- **Skills Support**: Detection and management of skills (complete folders in `skills/` containing `SKILL.md`)
  - Skills are downloaded recursively with all files and subdirectories
  - **Displayed as a single node in TreeView** (folder name only, contained files are hidden)
  - All actions (Download, Update, Remove) apply to the entire skill folder
  - Update and remove operations handle all files in the skill folder
- **Manual Deletion Detection**: Extension now detects when files are manually deleted from workspace
  - Assets appear as "Not installed" in TreeView when local files are missing
  - File existence is verified on every status computation

### Changed
- **Directory Structure Preservation**: All files are now downloaded with their complete path structure preserved
  - Example: `agents/file.md` from repo → `.github/agents/file.md` in workspace
  - Skills maintain their complete folder hierarchy
- **Smart Path Resolution**: Automatic detection and prevention of destination directory duplication
  - If repo path is `.github/agents/file.md`, workspace gets `.github/agents/file.md` (not `.github/.github/...`)
  - Works with any configured destination directory

### Fixed
- Prevented duplication when repository files already include the destination directory in their path

### Technical
- 62 unit tests passing (all green)
- Full TypeScript strict mode compliance
- Zero compilation errors

## [0.1.0] - 2026-02-07

### Added
- Initial release
- TreeView with hierarchical display of assets (repositories, folders, files)
- Status indicators: not-installed, up-to-date, update-available, locally-modified
- Download and update operations for individual files
- Batch operations: Download All, Update All
- Conflict detection and resolution for locally modified files
- Manifest management (`.copilot-assets.json`)
- GitHub and GitHub Enterprise authentication support
- Configurable destination mappings
- Status bar with update count
- Startup notification for available updates
- 9 commands: refresh, download, downloadAll, update, updateAll, showDiff, openOnGithub, remove, configureRepos
- SHA-256 hash comparison for local modifications
- Rate limit handling and error management
- 57 unit tests covering core functionality

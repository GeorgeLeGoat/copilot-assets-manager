# Troubleshooting - Skills not displaying correctly

If you see individual `.md` files from skills instead of a single skill node, here's how to debug:

## Expected Behavior

**Correct display:**
```
📁 skills
  🎓 my-skill  (🎓 Skill (5 files) - Not installed)
```

**Incorrect display (old behavior):**
```
📁 skills
  📁 my-skill
    📄 SKILL.md
    📄 README.md
    📄 config.json
```

## How Skills are Detected

A folder is recognized as a skill if:
1. It's located inside a `skills/` directory
2. It contains a file named `SKILL.md` (case-insensitive)

Example valid paths:
- `skills/my-skill/SKILL.md` ✅
- `.github/skills/my-skill/SKILL.md` ✅
- `foo/skills/my-skill/SKILL.md` ✅

## Debugging Steps

### 1. Check your repository structure

Make sure your skill folder:
- Is inside a `skills/` directory
- Contains a `SKILL.md` file (exact name, case-insensitive)

### 2. Verify the extension version

In VS Code:
1. Extensions panel (Ctrl+Shift+X)
2. Find "Copilot Assets Manager"
3. Check version is **0.2.2** or higher

### 3. Reload VS Code

After installing the new version:
1. Press F1
2. Type "Reload Window"
3. Press Enter

### 4. Check the TreeView description

If skills are detected correctly, you should see:
- **Description**: `🎓 Skill (X files) - [status]`
- **Not**: just `Skill - [status]` (old version)

The emoji 🎓 and file count are the key indicators.

### 5. Clear and refresh

1. Click the "Refresh" button in the TreeView
2. Check the display again

## Common Issues

### Issue: Files in `skills/` but no `SKILL.md`

**Problem**: Folder contains `README.md`, `guide.md`, etc. but no `SKILL.md`

**Solution**: Create a `SKILL.md` file in the skill folder

### Issue: Skills at wrong location

**Problem**: Skills are at root or in a different folder

**Repository structure:**
```
my-skill/         ❌ Wrong (not in skills/)
  SKILL.md
```

**Correct structure:**
```
skills/           ✅ Correct
  my-skill/
    SKILL.md
```

### Issue: Old extension still loaded

**Problem**: VS Code didn't reload the extension after update

**Solution**:
1. Uninstall old version completely
2. Restart VS Code
3. Install version 0.2.2
4. Reload window (F1 → Reload Window)

## Still Not Working?

If skills still appear as individual files:

1. **Check exact file names in your repo**
   - Is the file named exactly `SKILL.md` (not `skills.md`, `Skill.md`, etc.)?
   - Note: Detection is case-insensitive, but the file must be named `SKILL.md`

2. **Verify path structure**
   - Use GitHub web interface to confirm the exact path
   - Copy the full path of `SKILL.md` from GitHub
   - Verify it contains `/skills/` in the path

3. **Check configured path in settings**
   - If you configured a `path` in repository settings
   - Make sure it doesn't exclude the `skills/` folder

Example configuration:
```json
{
  "copilotAssetsManager.repositories": [
    {
      "owner": "my-org",
      "repo": "copilot-config",
      "path": "/",              // ✅ Includes everything
      // NOT: "path": "/agents"  // ❌ Would exclude skills/
    }
  ]
}
```

## Version History

- **0.2.2**: Fixed skills detection to use correct filename `SKILL.md` (was incorrectly looking for `SKILLS.md`)
- **0.2.1**: Enhanced skill description with 🎓 emoji and file count
- **0.2.0**: Initial skills support (single node display)
- **0.1.0**: Individual file display only

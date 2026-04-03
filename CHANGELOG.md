# Changelog

## [3.0.0](https://github.com/michaeljauk/brain-starter/compare/v2.0.0...v3.0.0) (2026-04-03)


### ⚠ BREAKING CHANGES

* **vault:** Directory structure completely changed. notes/, context/, working-files/, and logs/ are removed. Content now lives in projects/{project}/, research/{topic}/, and knowledge/. Existing users must migrate their files.

### Features

* **vault:** restructure to project/topic-based directory layout ([7017b4d](https://github.com/michaeljauk/brain-starter/commit/7017b4de7be13f5ae8e98d36f3b686050f5fce6c))

## 2.0.0 (2026-03-24)

Fresh start with sanitized history. All personal and confidential references removed.

### Features

- 39 Claude Code skills (9 vault + 30 global auto-discovered)
- LLM-powered auto-linking via local Ollama
- Local semantic search via QMD
- Conventional commits enforced via commitlint + husky
- Obsidian-native: wikilinks, frontmatter, callouts, Bases, JSON Canvas
- Integration guides: Telegram Channels, Obsidian CLI, QMD, Google Calendar, Microsoft 365
- Automated sync script with personal reference sanitization
- Daily Drip personalization hook
- Decision logging workflow
- Automated releases via release-please

### Previous releases (v1.0.0 - v1.5.0)

History squashed to remove personal references. See the [README](README.md) for current capabilities.

# Changelog

## [3.8.1](https://github.com/michaeljauk/brain-starter/compare/v3.8.0...v3.8.1) (2026-11-05)


### Bug Fixes

* **skill:** have claude mention a new brain-starter release in its first reply ([740497e](https://github.com/michaeljauk/brain-starter/commit/740497e8132c0f794ab8a1432174f576740c4f7c))
* **skill:** name the issue tracker in wrap-up instead of only jira ([432386b](https://github.com/michaeljauk/brain-starter/commit/432386ba3fc033bf5127da3e10851ed09cfe0376))
* **skill:** stop wrap-up from missing tracked tasks ([9b7b498](https://github.com/michaeljauk/brain-starter/commit/9b7b49882009a96252ab616279a7fb6e0718e26c))
* **skill:** stop wrap-up from missing tracked tasks ([995b56b](https://github.com/michaeljauk/brain-starter/commit/995b56b47b1fb26b8ad4f51705228b092c4056a0))

## [3.8.0](https://github.com/michaeljauk/brain-starter/compare/v3.7.0...v3.8.0) (2026-11-04)


### Features

* **skill:** check for new brain-starter releases and merge them in ([165f87f](https://github.com/michaeljauk/brain-starter/commit/165f87f83897a09dfb6def57fba235bb8d62f998))
* **skill:** rename /wrap-session-up to /wrap-up ([27cd5e0](https://github.com/michaeljauk/brain-starter/commit/27cd5e067c25939adc23b89418da5d34cf185467))


### Bug Fixes

* **skill:** bring the release workflow guard to existing vaults on update ([8186d3a](https://github.com/michaeljauk/brain-starter/commit/8186d3a4b682e4977008eda092395668e7c5e6cc))

## [3.7.0](https://github.com/michaeljauk/brain-starter/compare/v3.6.0...v3.7.0) (2026-11-03)


### Features

* **skill:** fix friction at the source instead of logging it in wrap-session-up ([662a744](https://github.com/michaeljauk/brain-starter/commit/662a744b02b6b04770bcb91a8471fd2bda0bab1c))


### Removed

* **Daily Drip:** the `UserPromptSubmit` hook in `.claude/settings.json`, `docs/scripts/daily-drip.sh` and the question pool in `docs/templates.md` ([15371df](https://github.com/michaeljauk/brain-starter/commit/15371df)). Forks that use it keep their copy.

## [3.6.0](https://github.com/michaeljauk/brain-starter/compare/v3.5.0...v3.6.0) (2026-08-27)


### Features

* **scripts:** add a runnable leak gate for private to public syncs ([1dafedd](https://github.com/michaeljauk/brain-starter/commit/1dafedd95adf1ea528e6e484ccac978e3c01a626))
* **skill:** add kickoff for guided first-run setup ([3d89ff3](https://github.com/michaeljauk/brain-starter/commit/3d89ff34fbe99b58cbc3715f3f524261ae03aa8c))


### Bug Fixes

* **hooks:** point the daily drip hook at the script that exists ([c5387ce](https://github.com/michaeljauk/brain-starter/commit/c5387cec4e8b21c54eceb299c6f9c73eb2e2aade))
* **scripts:** run the name and token passes over separate inputs ([ec07ed5](https://github.com/michaeljauk/brain-starter/commit/ec07ed50556f1768f468a534831514549bb21b0e))

## [3.5.0](https://github.com/michaeljauk/brain-starter/compare/v3.4.0...v3.5.0) (2026-08-14)


### Features

* **skill:** sync brain-starter with enhanced ingest, lint, and research skills ([7551aff](https://github.com/michaeljauk/brain-starter/commit/7551affc774e4fc891e61fca14206731ed499391))

## [3.4.0](https://github.com/michaeljauk/brain-starter/compare/v3.3.1...v3.4.0) (2026-04-24)


### Features

* **skill:** sync latest skills and docs from brain vault ([843f7a1](https://github.com/michaeljauk/brain-starter/commit/843f7a1fb88437bbb6a4349966b5353b26fc5a45))

## [3.3.1](https://github.com/michaeljauk/brain-starter/compare/v3.3.0...v3.3.1) (2026-04-07)


### Bug Fixes

* correct file placement rules, outputs go to project directories not tmp/ ([c1d22a2](https://github.com/michaeljauk/brain-starter/commit/c1d22a2103d8f440aabbadc60f3199757cc78fc5))

## [3.3.0](https://github.com/michaeljauk/brain-starter/compare/v3.2.0...v3.3.0) (2026-04-07)


### Features

* **skill:** switch to plugin architecture, keep only 15 vault-native skills ([0759bb7](https://github.com/michaeljauk/brain-starter/commit/0759bb7e1e7d9462c266c680c6c59932cfc501b9))


### Bug Fixes

* **docs:** use bun instead of npm for qmd install instructions ([13d452b](https://github.com/michaeljauk/brain-starter/commit/13d452be22f36750d5725f03dd5f3de5d767706e))

## [3.2.0](https://github.com/michaeljauk/brain-starter/compare/v3.1.0...v3.2.0) (2026-04-07)


### Features

* **skill:** sync 80 skills from brain vault, add 5 new skills ([449a633](https://github.com/michaeljauk/brain-starter/commit/449a63389cfbfbd673c6018683751ec5079a26d6))

## [3.1.0](https://github.com/michaeljauk/brain-starter/compare/v3.0.0...v3.1.0) (2026-04-04)


### Features

* add automatic meeting classification script ([08eb9d4](https://github.com/michaeljauk/brain-starter/commit/08eb9d42df31e5d8e0304631116385abe2a79b12))
* remove auto-link script, replace with lint-brain + wrap-session-up ([62ff71e](https://github.com/michaeljauk/brain-starter/commit/62ff71ea2c2ee0d57fa121b37be380ce0c4c8e18))
* **skill:** add lint-brain, manifest indexes, pre-commit meta-doc sync ([0abb798](https://github.com/michaeljauk/brain-starter/commit/0abb7986cc5075404d8affe14821fd941b267939))

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

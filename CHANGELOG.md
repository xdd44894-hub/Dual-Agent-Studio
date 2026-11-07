# Changelog / 更新日志

All future changes should be recorded here. / 后续更新在此记录。

## [Unreleased] — GitHub preparation

- Added English/Chinese project documentation, MIT license, contributor guidelines, security notes, architecture and roadmap.
- Added GitHub issue templates, CI smoke-test workflow, and automatic local test suite (no model calls).
- Added request validation improvements: loopback `Host` checks, JSON-only POST, byte-size cap, and job-lock cleanup fix.
- Added a lightweight SVG architecture diagram for the current prototype.
- Added npm `repository`, `homepage`, and `bugs` metadata pointing at this GitHub project.
- Fixed the Windows SEA CI job by creating `dist/` before `node --build-sea`, matching `build.cmd`.
- **No Electron desktop app or official Windows installer has been implemented in this documentation-preparation step.**

## [0.1.1] — Legacy Windows SEA build kit

- Embedded the webpage as a Node Single Executable Application asset.
- Added `build.cmd`, `sea-config.json`, and Windows CLI detection.
- Retained local browser-based dashboard and one-shot invocation architecture.
- **EXE builds and live Agent responses remain pending independent Windows verification.**

## [0.1.0] — Initial local coordinator prototype

- Added parallel one-shot answer mode and two-round exchange of perspectives.
- Added local-only HTTP dashboard and basic CLI subprocess orchestration.

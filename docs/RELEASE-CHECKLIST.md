# Release checklist / 发布检查清单

Use this checklist before tagging a public release. / 发布公开版本前使用此清单。

## Source and security / 源码与安全

- [ ] Review the full diff and confirm no credentials, personal data, local workspaces, or private prompts are included.
- [ ] Run `node --check server.js` and `node --test` on Windows and Linux.
- [ ] Review `SECURITY.md` and known limitations; do not describe the prototype as a security sandbox.
- [ ] Audit dependency licenses and update notes for any bundled third-party assets.
- [ ] Verify the README accurately describes implemented features and planned work.

## Windows build / Windows 构建

- [ ] Build on a clean Windows x64 runner using the documented Node.js version.
- [ ] Test first launch, browser opening, port conflicts, CLI detection, and clean shutdown.
- [ ] Test with a dedicated non-sensitive workspace and provider test accounts.
- [ ] Confirm the unsigned binary warning is documented; sign binaries if a trusted signing identity is available.
- [ ] Record build provenance and checksums for release assets.

## GitHub release / GitHub 发布

- [ ] Update `CHANGELOG.md` and version in `package.json`.
- [ ] Create and review a version tag.
- [ ] Attach only validated release artifacts; never attach `.env`, logs, databases, or local workspaces.
- [ ] Publish release notes in English and Chinese.
- [ ] Verify the release page and installation instructions after publication.

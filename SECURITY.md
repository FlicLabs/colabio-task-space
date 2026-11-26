# Package security and maintenance

This public MIT-licensed task-space package is independent of the private Colabio application. Public security notes cover this package only.

## Published security checkpoint

[Version 0.3.1](https://github.com/FlicLabs/colabio-task-space/releases/tag/v0.3.1) updates the dependency manifest to Zod ^4.6.7 for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). [PR #2](https://github.com/FlicLabs/colabio-task-space/pull/2) pins the test Actions, disables retained checkout credentials and adds weekly dependency updates with a seven-day routine-update cooldown. The source-only release was published immutable.

At the 21 November 2026 checkpoint, all nine package tests passed; an installed dependency audit reported zero findings and manual Zod 4 hosted-view size/revision boundary checks passed. These are dated results, not a claim about every later installation, dependency resolution or advisory.

## Continuing safely

- Read AGENTS.md and HOSTED.md; personal views apply only to their owner, while shared task edits still use the service's existing permissions.
- Use the normal one-time project connection flow. The device session has the member's normal permissions; do not describe it as a restricted task-only credential. Keep tokens outside repository/page/browser storage and preserve loopback, host, origin and request-nonce checks.
- Preserve the opaque-origin hosted-frame sandbox and network restrictions. Do not expand a custom view's authority or execute instructions copied from external content.
- Check all package manifests and consumers. A clean root lockfile does not assess a separate embedded package manifest; major validation-library updates need schema-boundary/consumer compatibility checks.
- Run npm test and appropriate dependency/build checks for the current source. Record actual version, date and test results. A published tag and an installed client are different verification surfaces.
- Never commit credentials, signing containers or private application/customer/infrastructure incident details to this public repository. Use the repository's private vulnerability-reporting channel if available; otherwise contact the maintainer for a private route before disclosing sensitive evidence in an issue.

Update this document and the release notes when verified package behavior changes. Consult the advisory and the current lockfile rather than treating the historical version above as permanently current.

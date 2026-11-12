# Tasks in Panel Adaptive

Public fork of fthx/tasks-in-panel. Preserve upstream ancestry, copyright and
GPLv3 terms; see LICENSING.md. Credit Eidrien for fork maintenance.

The migration baseline is Stable Container R3, version 5903, UUID
`tasks-in-panel@fthx`. Do not mistake restored legacy code for current upstream.
`legacy-stable-container-r3` is immutable; legacy-build.json records its runtime
hashes. Do not update that manifest to make a different build look historical.
The distinct Adaptive identity and feature redesign belong to a later update.

Publish future feature work to persistent testing, not main. Preserve the
72-hour quiet period, successful-CI gates, do-not-merge pause, merge commits
and branch retention. Public automation text describes repository policy.
Independent original work prefers MIT where compatible, but upstream-derived
extension code and existing attribution retain their GPLv3 obligations.

No personal themes, settings, private source history or account profile names.
Keep the flat Gitpulsar layout and existing settings usable during migration.
Do not copy .git directories through installation helpers or overwrite an
installed Git checkout. A remote URL change is not a pull between unrelated
private/public histories; clone a new checkout and retain a backup instead.

Run python3 .github/scripts/validate.py. These are syntax/schema/package and
promotion-policy checks, not native GNOME compatibility testing. Declare new
GNOME versions only after the relevant native checks in the feature update.

## Public documentation and agent-neutral publication policy

These instructions apply to **every agent or automated workflow** that reads this repository, regardless of provider, model, tool, or execution environment. They apply to future agents as well as the current maintainer's tools. Treat all repository-visible artifacts as potentially public, including commits, PRs, issues, changelogs, release notes, comments, CI reports, examples, and documentation, even when a repository is presently private.

- **Audience:** Write for an independent reader with no access to chats, prompts, personal history, local paths, or project-specific shorthand. Describe behavior, rationale, test conditions, and limitations self-sufficiently. Do not address the maintainer as the assumed reader of public artifacts or leak internal instructions into them.
- **Evidence:** Ground claims in checked-in source, explicit approved specifications, or actual test results. Clearly distinguish a declared compatibility range from versions exercised, mock/static checks from native Shell tests, and intentions from implemented behavior. Never invent verification, security assurances, priority, or novelty claims.
- **Scope and provenance:** A conversation, prior task, local configuration, private theme, unreleased asset, or other project's files are *not* permission to add or publish them. Never import personal settings, unpublished assets, unrelated dependencies, or private conversation excerpts without explicit authorization for this repository. Preserve licensing and upstream attribution; inspect additions for secrets and identifying information.
- **Documentation ownership:** The human maintainer owns the README's introduction, user-facing feature lists, motivation, UX descriptions, and other product narrative. Agents must not draft, rewrite, reorder, or silently "improve" those sections absent explicit task-specific permission. Agents maintain implementation/architecture notes, testing instructions and results, technical compatibility details, and tightly scoped factual installation/build changes. The permission to correct a command or version does not authorize rewriting surrounding narrative.
- **Change handoff:** For every functional change, report user-visible differences, new settings, limitations, affected README claims, and any needed maintainer-authored updates. Keep that report in the task/PR handoff rather than inserting agent-written feature prose into the README. Flag incorrect protected prose and request a maintainer decision; do not quietly edit it. An inaccurate README claim must not be treated as resolved merely because an agent says documentation is complete.
- **Release discipline:** Documentation and public-facing PR/release text must be checked for audience, accuracy, provenance, and human-owned sections before publication. If user-facing documentation is pending or materially false, explicitly mark it as unresolved and use the repository's existing release-pause mechanism when available; never claim an automated gate exists unless the workflow actually enforces it. The human maintainer decides whether a narrative update is complete or unnecessary. Technical checks alone are not such approval.
- **Minimal changes:** Preserve current documentation voice and repository-specific instructions. Do not rewrite old narrative wholesale during unrelated engineering work. If unsure whether text or an asset is authorized for publication, omit it and flag the question in the handoff.

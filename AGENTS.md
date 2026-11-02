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

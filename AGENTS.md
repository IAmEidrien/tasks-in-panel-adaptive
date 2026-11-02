# Tasks in Panel Adaptive

Public fork of fthx/tasks-in-panel, maintained by Eidrien. Preserve upstream
ancestry, copyright and GPLv3 obligations. Independent original modules may use
MIT where compatible; see LICENSING.md. Never credit account profile names.

Keep this extension focused on panel tasks. Container styling and scrolling must
stay inside TIP-A's actors. Do not add global panel styles, indicator management,
date-menu relocation or power controls. Task buttons remain flat. Preferences
hide irrelevant controls rather than leaving disabled clutter.

Identity: tasks-in-panel-adaptive@eidrien.local; settings schema and path use
org.gnome.shell.extensions.tasks-in-panel-adaptive. The compact original schema
exists only for one-time import of explicit task preferences. Do not import
unrelated global settings or overwrite existing Adaptive values.

Runtime stays at repository root for Git-managed installations. Never copy .git
through installers or overwrite installed Git checkouts. Do not commit personal
themes, settings, generated schemas, screenshots or native runtime output.

Run make check. Use tests/native in disposable GNOME sessions for actor lifecycle,
input and API changes; document exact versions and inferred checks honestly in
TESTING.md. Never equate static CI with live GNOME compatibility testing. Keep
preview clones, signal handlers, timeouts and menus cleaned up on disable.

Publish feature work to persistent testing, not main. Preserve the 72-hour quiet
period, current-head CI gates, do-not-merge pause, merge commits and branch
retention. Keep existing release tags immutable. Public documentation describes
current product behavior without private repository history.

Version policy: use a whole release number for feature progress and a point
release for pure fixes/polish. Once testing has a pending release number, further
commits retain it unless a point release must become a feature release. Metadata
version remains the integer required by GNOME; version-name is the public label.

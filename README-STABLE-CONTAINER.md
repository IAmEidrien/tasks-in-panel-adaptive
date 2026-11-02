# Tasks in Panel — Stable Container R3

Based on Tasks in Panel v59 by @fthx.

## Stable-container architecture retained from R2

R1 proved that the extension itself could remain enabled, but its nested task actors did not render on GNOME 46. R2 removes the most suspect part of that architecture:

- GNOME still receives exactly one top-level status-area object: `tasksInPanelTaskbar`.
- Individual tasks are now ordinary `St.Button` children instead of nested `PanelMenu.Button` instances.
- The visible icon/title/app state is populated *before* AppMenu registration. If menu registration fails, the task remains visible and usable rather than construction aborting on a blank actor.
- The outer strip no longer asks to expand horizontally inside the panel; it reports the natural width of its children and lets the panel constrain it.
- The outer wrapper remains reactive so Clutter can pick its reactive descendants normally.
- AppMenu still uses the task actor as its source and is registered with the panel menu manager when possible.

This is intentionally still an architectural test, not a feature release.

## Test priorities

1. Do task titles/icons render at all? This is the R2 pass/fail criterion.
2. With Top Panel Organizer enabled, confirm it sees only `tasksInPanelTaskbar` as the Tasks in Panel object while windows open and close.
3. Test primary-click switching/minimizing and hover behavior.
4. Test right-click AppMenu and middle-click New Window. If the task renders but the context menu fails, that is now an isolated secondary problem.
5. Open enough Nemo windows to stress width allocation. We have not yet proven that nested `St.BoxLayout` allocation reproduces upstream's per-status-item compression behavior.

## If R2 still does not render

The next diagnostic is the GNOME Shell journal. Filter for `Tasks in Panel` immediately after enabling/opening a window. R2 logs AppMenu registration failures without allowing them to abort task construction.


## R3: Dynamic task display

R3 adds one new presentation mode while preserving the stable-container architecture:

- `Dynamic task display` is opt-in and defaults off for upgrade safety.
- The mode evaluates only task actors that are actually visible after the extension's existing workspace, focus, grouping, and skip-taskbar filters.
- If every visible task belongs to a different application, all task buttons use icons only.
- If any application has multiple visible task instances, the entire task strip switches together to icon + window-title presentation.
- The decision is global, never per-application, so task presentation stays visually regular.
- Application-name labels are suppressed in dynamic mode because they do not contribute to window disambiguation.
- Visibility/app changes queue one coalesced idle update instead of rebuilding task actors. Existing `St.Button` tasks remain alive; only their child visibility and natural-width style change.
- The fixed `Show window icon`, `Show window title`, and `Show application name` controls remain stored for non-dynamic mode and are disabled in Preferences while dynamic display is active.

### Visibility semantics

“Visible” deliberately means the final set of task buttons visible in the panel. For example, with `Show on active workspace only` enabled, two Firefox windows on different workspaces do not trigger titles. If both Firefox tasks become visible on the same panel, titles appear globally. Grouped-away windows likewise do not count as separate visible task instances.

### R3 test priorities

1. Enable Dynamic task display with one window each from several apps: tasks should be icons only.
2. Open a second visible window of one app: all visible tasks should immediately gain window titles.
3. Close, move, or hide the duplicate window: the taskbar should collapse back to icons only.
4. With `Show on active workspace only`, place duplicate app windows on different workspaces and verify they do not trigger title mode until both are visible together.
5. Exercise Group by app and Show focused window only; dynamic mode should follow the final visible task set, not the application's total window count.
6. Recheck task clicks, hover raising, context menus, close animation, and Top Panel Organizer integration. Dynamic display does not recreate task actors or the stable outer container.

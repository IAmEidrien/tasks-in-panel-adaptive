# Tasks in Panel Adaptive

A focused task list for the GNOME panel, maintained by [Eidrien](https://github.com/IAmEidrien).
TIP-A keeps windows within reach with contextual titles, window previews and
container styling that leaves the rest of the panel to its own theme.

## Task display

**Dynamic task display** is enabled by default. Distinct applications use icons;
when an application has multiple visible tasks, every task shows its title to
make those windows easy to distinguish. Turn dynamic display off to choose
icons, window titles and application names individually.

Tasks follow the last computed overview layout in reading order, including
V-Shell’s position, MRU and stable-order modes. That order stays fixed between
overview visits; new windows append in creation order. Before a usable overview
layout exists, creation order is the fallback. Grouped applications keep stable
slots when their representative window changes.

Tasks show windows on the **active workspace** and the **panel's monitor** by
default. Both filters are optional. Application grouping shows one representative
per application, with all matching windows available in its preview. Grouping
respects the workspace and monitor filters. Focused-window-only display is also
available.

Buttons have a flat appearance, with feedback for the active window, pointer
hover and keyboard focus. Icon-only tasks have extra horizontal padding. The
outer container uses a faint neutral hover tint without button press effects or
animated transitions. Optional monochrome icons and closing animations are
available. **Maximum task width** caps each button in logical pixels; **−1**
means no configured maximum. Short titles retain their natural width, and the
available panel space and theme's minimum button size still apply.

**Fill available space**, under Container, is enabled by default and gives the container the
unused panel space while task buttons retain their normal sizing and alignment.
Centered widgets and the opposite panel section keep their space. With an empty
center section, a left container reaches the right-side widgets. The allocated
region remains even when no tasks are visible. An empty container becomes
transparent and non-interactive: no hover background, scroll interception or
accessibility control. Window/workspace events restore it when tasks become
relevant, including minimized windows that qualify for display. Turn filling off
for compact, content-sized placement. Explicitly saved preferences are preserved.

## Interaction

- **Primary click:** activate a window, or minimize it when already focused.
  In focused-window-only mode, open its application menu instead.
- **Secondary click:** open GNOME's application menu.
- **Middle click:** close the represented window. Grouped tasks close only that
  window; other windows stay open. Turn off **Close window on middle-click** in
  Tasks → Interaction to open another application window instead, when supported.
- **Scroll over the container:** cycle through represented windows. This can be
  disabled in Container preferences.
- **Keyboard:** focus tasks through GNOME's panel navigation; Space or Enter
  performs the primary action. Down opens the native application menu.

Choose one **hover action**: **Preview** (default), **Raise**, or **None**. Preview
and Raise share one delay setting, initially **300 ms**. None hides that setting.
**Preview height** appears only for Preview. It ranges from **80–320 logical
pixels**, initially **160**. Width scales with height, window proportions are
preserved, and previews are capped to fit the current monitor.

Raise temporarily brings a window forward without focusing it and restores the
previous stacking when the pointer leaves.

Previews show live thumbnails with 12-pixel rounded corners and an 8-pixel inset without changing
window focus. Titles ellipsize inside compact cards, with padded headers and
subtly outlined 48×32 close buttons that stay independent of title length.
Preview titles follow the task’s theme font weight or the Container override.
Move into a preview to select a window or use its close button. Grouped applications show multiple
cards, with horizontal scrolling when needed. A minimized window has a labeled
placeholder: displaying a preview never unminimizes it. Escape dismisses a preview during keyboard navigation in the panel.

## Container preferences

Choose left, center or right placement, font weight (theme, normal or bold), an
optional background color including transparency, and scrolling behavior. These
settings affect **only TIP-A's container**. TIP-A does not manage other indicators,
the date menu, panel-wide styling or desktop power controls.

Preferences show controls only when relevant: fixed display choices appear when
dynamic display is off, the color picker appears with a custom background, and
the hover delay appears for Preview or Raise.

## Install

GNOME Shell **46–51** is supported. See [TESTING.md](TESTING.md) for the tested
runtimes and the limits of compatibility validation.

Clone the repository into the directory matching its extension UUID:

```sh
git clone https://github.com/IAmEidrien/tasks-in-panel-adaptive.git \
  ~/.local/share/gnome-shell/extensions/tasks-in-panel-adaptive@eidrien.local
glib-compile-schemas ~/.local/share/gnome-shell/extensions/tasks-in-panel-adaptive@eidrien.local/schemas
```

Log out and back in, then enable **Tasks in Panel Adaptive** in Extensions.
Disable any other Tasks in Panel extension first. Explicit task preferences from
Tasks in Panel are imported once when applicable; unrelated panel settings are
not imported, and existing TIP-A preferences take priority.

Use **main** for released changes or **testing** for development candidates.
Gitpulsar can track either branch. After pulling schema changes, compile schemas
again and restart the session. Keep backups outside GNOME's extensions directory;
do not install a release ZIP over a Git-managed checkout.

To build an installable ZIP:

```sh
make pack
gnome-extensions install dist/tasks-in-panel-adaptive@eidrien.local.shell-extension.zip
```

## Development

Run `make check` for syntax, schemas, policy regressions, packaging and promotion
checks. [TESTING.md](TESTING.md) documents isolated native tests.
[TESTING-WORKFLOW.md](TESTING-WORKFLOW.md) describes automatic promotion after
72 quiet hours and successful CI; `do-not-merge` pauses promotion.

The implementation separates task actors (`extension.js`), preview lifecycle
(`preview.js`), filtering and display policy (`policy.js`), computed overview order
(`overviewOrder.js`), and one-time settings import (`settings.js`). Preferences update the running container without
restarting the extension. Packaging compiles schemas in a temporary directory
and includes only runtime files and their documentation/licenses.

## Credits and license

Based on [Tasks in Panel by fthx](https://github.com/fthx/tasks-in-panel).
Dash-to-Panel's preview behavior served as a design reference. Maintained by
Eidrien with AI assistance.

The upstream-derived extension is **GPLv3**; independent original modules use
**MIT** where marked. See [LICENSE](LICENSE), [COPYING](COPYING) and
[LICENSING.md](LICENSING.md) for terms and provenance.

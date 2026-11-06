# Validation

## Automated checks

```sh
make check
make pack
```

CI checks JavaScript syntax, strict GSettings schemas, window-filter/group/display
policy, safe container styling, installable ZIP contents and promotion policy.
Packaging compiles schemas in a temporary directory. These checks run on each
push to `testing` and `main`; they do not launch GNOME Shell.

## Native compatibility

The Adaptive update was exercised on these actual runtimes with real GTK window
clients and virtual pointer/keyboard input:

| GNOME Shell | Environment | Coverage |
| --- | --- | --- |
| 46.0 | Nested Wayland and Xorg | Task and preview interaction suite |
| 47 | Source/API review | Inferred from the tested neighboring runtime families |
| 48.7 | Nested Wayland | Task and preview interaction suite |
| 49 | Source/API review | Inferred from the tested neighboring runtime families |
| 50.1 | Headless Wayland, two virtual monitors | Interaction suite and monitor filtering |
| 51.0 | Headless Wayland | Interaction suite, native key controllers and menu teardown |

The suite checks three real windows from two applications, dynamic display,
maximum and natural widths, stable actors across settings changes, delayed hover,
pointer transfer into previews, activation and close buttons, grouped thumbnails,
workspace filtering, container scrolling with previews open, temporary Raise and
stack restoration, None, native application menus, keyboard activation, Escape
from panel navigation, scoped styling and placement, minimized placeholders,
disable with an open preview, and re-enable.

GTK/libadwaita preferences were also opened on GNOME 46 and 51. Tests verify
contextual row visibility, defaults, one-time explicit task-settings import,
removed preference sections and preservation of new choices.

GNOME 47/49 were **not launched**. Their AppMenu and BoxPointer interfaces were
reviewed against GNOME's tagged sources; compatibility is inferred rather than a
separate live pass. Full mixed-DPI hardware, third-party themes/panel organizers
and long-running daily sessions remain desktop testing work. Native acceptance
runs use scale 1; screenshots were inspected for ordinary and grouped previews.

The disposable runtimes omit system services such as logind, GDM and calendar
providers, so their logs contain expected fixture warnings. A GNOME 50/51 dash
redisplay exception also occurred while test clients were closing; its stack
was entirely in Shell's dash/deferred-work code. No TIP-A-origin exception or
disposed-actor access was observed in the accepted runs.

## Upstream maintenance regression checks

The creation-order and middle-click update was additionally exercised on GNOME
46 and 51. The real-input suite checks the default middle-click setting, stable
ordering through focus/settings changes and reconstruction after re-enable,
and middle-click closing of one represented window while another remains open.
The existing preview/menu/filter/disable checks run alongside these regressions.

## Visual polish regression checks

GNOME 46 and 51 additionally exercise long preview titles, compact card bounds,
3:2 close-button allocations, wider icon-only task targets and removal of the
outer container's panel-button styling. Actual Adwaita light (with 125% text)
and dark stylesheets were loaded and screenshots inspected; task hover tint is
checked against the computed theme color, including native panel selectors.
Preview titles are checked against the resolved task font weight and both
normal/bold overrides. Live thumbnail rounded clipping is checked on both shader
backends (Shell on 46, Clutter on 51), with additional full runs on GNOME 48
and GNOME 50 (two monitors). Preview activation, close controls, keyboard navigation
and lifecycle checks continue to run alongside these checks.

Preview-height controls are checked for visibility in Preview versus Raise/None,
settings binding and the 160-pixel default. Live tests exercise both range limits
(80/320), grouped layouts and monitor bounds after resizing. The close target
is checked for a usable allocation and approximately 3:2 proportions; its dimensions
now follow the theme font (2.1em × 1.5em before borders).

The thumbnail inset is verified at 8 logical pixels on the sides and bottom,
with a reduced 2-pixel top inset and a 12-pixel
rounded mask and aspect-preserving allocation. A generic popup-button theme
stress rule checks that the close target retains its outline and background.

## Overview ordering

The ordering reader samples computed overview rows without opening the overview,
then keeps that snapshot stable outside it. Missing/replaced private layout APIs
fall back to creation order. Pure regressions cover missing views, sticky-window
deduplication, workspace/monitor grouping and newly appended windows.
Native checks compare task order against actual overview slots, then change focus
to verify that the snapshot remains stable. V-Shell tests cycle its stable, MRU
and position sort modes using V-Shell 51.3 (`6f22b98`) on GNOME 46 and 51.
Stock GNOME 51 is also checked. Grouped application slots remain fixed when
focus changes the representative window.

## Reproduce native tests

Use a disposable session or container with the matching Shell/GJS/St/Clutter,
GTK4, libadwaita, `glib-compile-schemas`, D-Bus and Xvfb installed. The harness
creates separate data/config/cache/runtime directories and a private D-Bus bus;
it does not use an existing desktop session's settings.

```sh
python3 tests/native/run.py --version 46 --output /tmp/tip-a-46
python3 tests/native/run.py --version 46 --xorg --output /tmp/tip-a-46-xorg
python3 tests/native/run.py --version 50 --multi-monitor --output /tmp/tip-a-50
python3 tests/native/run.py --version 46 --vshell /path/to/vertical-workspaces --output /tmp/tip-a-vshell
```

Each output directory must be new. The version argument selects compositor flags;
it does not install or simulate that GNOME version. Versions 50+ use headless
virtual monitors. Software rendering, disabled Shell animations and disabled hot
corners make virtual input deterministic. Closing animations were additionally
exercised in GNOME 46 runs with animations enabled.

The result JSON records the actual Shell version and each accepted check; logs
and screenshots remain outside the checkout. Review failures before accepting a
candidate, and apply `do-not-merge` to pause promotion if desktop issues arise.

For preferences, compile schemas first and run the test with an in-memory settings
backend in a private display/session:

```sh
glib-compile-schemas --strict schemas
GSETTINGS_BACKEND=memory GTK_A11Y=none dbus-run-session -- \
  xvfb-run -a gjs -m tests/native/prefs.js "$PWD"
```

The preferences runner requires the installed GNOME Extensions preferences
resource and Shell typelibs/library search paths appropriate to the distribution.


## Fill-space layout and compact preview spacing

The optional container fill uses a removable allocation constraint on its panel
section. Centered widgets retain GNOME's work-area-adjusted position; the opposite
section retains its requested space. No panel style, clock placement or allocation
method is replaced. Task buttons do not expand with the container.

Native tests cover an empty filled container, the centered clock boundary,
empty-center layout, presentation stability, all three placements, toggling off,
and removal of an active constraint on disable. Preview checks retain rounded
thumbnails and side/bottom insets while using a tighter top inset and a smaller,
font-relative close target. Screenshots are inspected outside the repository.

The fill/compact-preview candidate passed native GNOME 46.0 (77 checks) and
GNOME 51.0 (75 checks). Empty-container and active-constraint cleanup checks
were additionally included in the final GNOME 46 run. This update did not repeat
the historical 47–50, V-Shell or multi-monitor runs described above.


## Adaptive empty-container behavior

Filling now defaults to on; GSettings still honors explicit saved choices.
The native probe checks that empty containers remain visible/mapped and allocated
with zero opacity, no reactive/hover surface, and no scroll-input inspection.
Displayed tasks restore interaction; minimized windows remain in the normal task
eligibility policy. Empty actors use the redundant accessibility role.
Right placement now has explicit centered-clock boundary, width-stability and
empty-workspace/return checks, alongside the existing left-side checks.

This update passed GNOME 46.0 (85 checks) and GNOME 51.0 (85 checks).

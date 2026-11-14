# Task layout and overflow

This document describes the implementation and maintenance boundaries. The
human-owned README feature descriptions are maintained separately.

## Display policy

`dynamic-task-display` remains the saved key; its preferences label is **Adaptive
task display**. The default remains enabled. Eligibility is evaluated after the
existing workspace, monitor, focused-window and application-group filters.

`iconIdentity.js` resolves the application's GIcon at the same 18-pixel icon size
and theme scale used by task buttons. Resolved filenames identify themed/file
icons; unresolved names use the rendered executable-icon fallback. This catches
shared icons across applications and aliases resolving to the same file. It does
not compare pixels: different files containing identical artwork, transformations
inside custom icon loaders, or visually similar artwork are not detected. No
window-specific icon extraction is performed. Application icon notifications,
Shell icon-theme notifications and theme/scale changes invalidate the relevant
cached measurements or identities.

Only members of an icon collision receive titles in Adaptive mode. Fixed mode
continues using the saved icon/title/application-name choices. Full accessible
names and preview titles are independent of the panel label's visibility.

## Readability

`minimum-title-characters` is an integer from 1 through 12, default 3. Both modes
apply it to title-bearing tasks. A complete title with fewer meaningful grapheme
clusters remains valid; whitespace and ellipsis do not count. Application-name
suffixes cannot satisfy a window title's threshold.

An invisible measurement button under the same panel/container theme measures
the unsuppressed candidate, including icon, padding, border, label margins and
font override. Child margins are read from theme nodes because preferred widths
omit them and hidden actors need not have synchronized margin properties. The Pango font is resolved from the theme, preserving fractional font sizes that
a pre-allocation Clutter font name can round. Its layout identifies which UTF-8 ranges the actual
ellipsization run removes. `Intl.Segmenter` supplies grapheme boundaries where
available. Older GJS uses native Pango cursor boundaries on a bounded prefix
long enough for the setting's maximum, including combining marks, emoji sequences
and bidirectional text. This avoids traversing an arbitrarily long title through
expensive cursor calls on Shell's main thread. Measurements are cached by text,
icon, display state, font/maximum-width settings and theme generation.

`displayPolicy.js` distributes the available candidate budget evenly above each
task's usable minimum, stopping short tasks at their natural width. This budget
is computed before any title suppression. If any eligible title is unreadable,
all visible tasks with that application identity receive icon-only styling.
An unrelated application retains its own independent readability decision,
including when its icon collides with the suppressed application.

The candidate evaluation never reuses space freed by suppressed titles. This
prevents the hide → extra space → show → insufficient space cycle. Restoration
requires two extra logical pixels of readable space, except when the complete
candidate reaches its full natural width; suppression happens at the actual
threshold. Widths are rounded down before evaluation to avoid fractional
rounding creating incidental overflow. Explicit maxima smaller than a usable
icon-only target yield to that minimum target size. Layouts too narrow even for
these minima scroll rather than squeezing targets further.

## Viewport and input

The existing task box lives in one clipped `St.ScrollView`. Its horizontal
adjustment survives refreshes and reorders, and St clamps it as contents shrink.
The viewport is capped to the existing work-area-aware panel region after peer
widgets' requests. Fill mode retains its existing removable allocation constraint;
no global panel style or allocation method is replaced. The native scroll fade
uses opacity on task contents, leaving the container background intact and
adding no input actors, arrows or permanent scrollbar.

One container capture handler owns wheel input; automatic mouse scrolling in
the nested viewport is disabled. Vertical input retains window switching when
enabled. Otherwise overflowing contents scroll. Horizontal or Shift+wheel input
manually scrolls even with switching enabled. Empty containers and non-overflowing
manual scrolling propagate events. Preview popups remain outside this actor
hierarchy and keep their own scrolling behavior.

Focus changes schedule a coalesced reveal of the exact task, transient parent,
or grouped representative. The adjustment moves only enough to expose the
button; there is no scroll animation to accumulate during rapid cycling. For
buttons wider than the viewport, the current overlapping segment stays put, or
the nearest edge is revealed. Ordinary refresh/reorder alone does not force a
focus reveal. Membership or viewport-size changes may reveal the focused task
again because its visibility constraints have changed.

## Lifecycle

Refreshes use the existing owned idle callback. Layout uses a coalesced compositor
later; reveal uses one owned after-paint callback so its geometry reflects completed
allocation. There is no polling. Teardown removes these callbacks,
theme/panel/application signals and the measurement actors, and releases the
additional candidate/member/suppression references. Closed or closing task actors
are excluded from delayed layout and reveal operations. Existing preview/menu
cleanup and overview-order snapshots remain in place.

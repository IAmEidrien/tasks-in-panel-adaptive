# Task layout update handoff

User-visible changes:

- Crowded task containers scroll horizontally inside their allocated panel region,
  with native edge fades and no permanent scrollbar. Vertical wheel input retains
  window switching when enabled; horizontal and Shift+wheel input scroll manually.
- Focused task buttons are automatically revealed with minimal movement.
- **Adaptive task display** replaces the preferences label **Dynamic task display**.
  Titles now identify tasks sharing a displayed icon, including cross-application
  collisions, while unique icons remain compact.
- **Tasks → Display → Minimum visible title characters** defaults to 3 (range
  1–12). Unreadable titles disappear together by application in either display mode.
  Complete short titles remain valid. The threshold row hides in manual mode
  when window titles are switched off, following the existing contextual-preferences
  rule.

The human-owned README has intentionally not been rewritten. Its statement that
multiple windows from one application cause titles globally is outdated; describe
per-icon ambiguity and per-application readability instead. Its natural-width and
container-scrolling descriptions should account for crowding, viewport scrolling,
automatic focus reveal and horizontal/Shift+wheel behavior. Add the new title
threshold to the preferences description if desired. The README also still says
72 quiet hours for promotion; the existing controller and TESTING-WORKFLOW.md
already use seven days. This update leaves that workflow unchanged.

Technical policy and limitations are in [TASK-LAYOUT.md](TASK-LAYOUT.md); native
coverage and reproduction commands are recorded in [TESTING.md](TESTING.md).
Existing setting keys and explicit values are retained. The pending feature
release number remains unchanged. There are no unrelated user-visible changes.

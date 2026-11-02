# Git-managed installation

The public home is https://github.com/IAmEidrien/tasks-in-panel-adaptive.
Upstream Git ancestry is retained. Runtime lives at the repository root.
The migration baseline retains tasks-in-panel@fthx and its existing schema.

The former private Stable repository is an independent snapshot history.
Changing its remote URL does not make an ordinary Pull safe between these
histories. Back up/move the old checkout outside the Shell extensions directory
and clone this fork afresh; see README.md. Existing GSettings remain outside
Git. Never force-push either history to simulate a migration.

Use main for the published baseline and testing for development candidates.
After Gitpulsar Pull, recompile schemas when changed and restart the GNOME
session. Keep local settings and generated schemas out of Git.

The historical tag and release preserve the current build; subsequent Adaptive
features are developed on testing. The old private repository is retained as
an archive/reference and is not deleted by this migration.

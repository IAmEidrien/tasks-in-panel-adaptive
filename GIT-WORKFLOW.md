# Git-managed installation

Runtime files live at the repository root. Clone this repository directly into
`~/.local/share/gnome-shell/extensions/tasks-in-panel-adaptive@eidrien.local`.
See [README.md](README.md) for installation commands.

Use `main` for released changes and the persistent `testing` branch for candidates.
After pulling changes to schemas, run `glib-compile-schemas schemas` from the
checkout and restart the GNOME session. User settings live outside Git. Generated
schemas, distribution ZIPs and local settings must remain untracked.

Do not copy `.git` through installers, replace a Git-managed installation with a
release ZIP, or force-push shared branches. Keep installation backups outside the
Shell extensions directory. The UUID and installation-directory name must match.

Development publishes to `testing`; promotion uses a merge commit, retains the
branch, and requires successful validation plus 72 quiet hours. See
[TESTING-WORKFLOW.md](TESTING-WORKFLOW.md). Public workflow messages describe
repository policy without addressing an individual reader.

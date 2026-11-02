# Tasks in Panel Adaptive

A public fork of [fthx/tasks-in-panel](https://github.com/fthx/tasks-in-panel),
maintained by Eidrien with AI assistance. This repository retains upstream Git
ancestry and now houses the former private Stable Container build.

## Current baseline

The current build is **Stable Container R3**, version **5903**, based on upstream
Tasks in Panel v59. It places ordinary task buttons inside one stable panel
container and offers optional dynamic icon/title display and monitor filtering.
Its runtime files and settings are unchanged by this repository migration.
See [the existing build notes](README-STABLE-CONTAINER.md).

The fork initially contained newer upstream history. Importing this legacy
baseline preserves that history but deliberately restores the older Stable
runtime; it does not claim to incorporate all later upstream features or fixes.

The metadata retains its existing GNOME 46–49 declarations. The Stable build was
developed for GNOME 46; this migration adds no new compatibility testing or claims.
Native GNOME 46–51 testing belongs to the upcoming Adaptive feature update.

## Branches and historical build

- **main:** released baseline and repository infrastructure.
- **testing:** persistent development branch for the upcoming Adaptive update.
- **legacy-stable-container-r3:** immutable historical snapshot of the current
  runtime, with an installable ZIP in [Releases](https://github.com/IAmEidrien/tasks-in-panel-adaptive/releases).

The planned update will focus the extension on tasks, remove unrelated global
panel/indicator controls, and add container preferences and hover previews.
Those changes are **not implemented in this baseline**.

Testing changes promote after 72 quiet hours and successful validation, unless
paused with `do-not-merge`. Every push restarts the timer. See
[TESTING-WORKFLOW.md](TESTING-WORKFLOW.md).

## Install or move an existing Gitpulsar checkout

The current baseline still uses **tasks-in-panel@fthx** and its existing schema.
It replaces the upstream extension; do not enable both copies simultaneously.
A distinct Adaptive identity and any required migration belong to the next update.

For an existing Stable checkout, change its remote URL in Gitpulsar to this
repository, then fetch the new branches. The private snapshot and public fork
have different ancestry, so an ordinary Pull between them is not a migration.
The safest route is to keep the old checkout as a backup and clone this repository
into the extension directory after moving that backup outside GNOME's extensions
directory. GSettings live outside the checkout and remain usable with this UUID.

```sh
git clone https://github.com/IAmEidrien/tasks-in-panel-adaptive.git \
  ~/.local/share/gnome-shell/extensions/tasks-in-panel@fthx
```

Choose `main` for the baseline or `testing` for candidates in Gitpulsar. Compile
settings after installation or schema updates, then log out and back in:

```sh
glib-compile-schemas ~/.local/share/gnome-shell/extensions/tasks-in-panel@fthx/schemas
```

For the historical release ZIP, use GNOME's extension installer instead of
installing it over a Git-managed checkout.

## Maintenance and licensing

Run `python3 .github/scripts/validate.py` for syntax, schemas, promotion-policy
regressions and package checks. These checks are not native GNOME testing.
`legacy-build.json` records the source revision and exact runtime checksums.
The tag release workflow verifies them before packaging the historical build.

The upstream-derived extension remains **GPLv3**. Preserve fthx and GNOME
contributors' attribution; see [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md).
Repository establishment does not make this baseline an extensions.gnome.org
submission or change the license to MIT.

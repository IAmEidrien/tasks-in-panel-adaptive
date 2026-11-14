# Licensing and provenance

Tasks in Panel Adaptive derives from [fthx/tasks-in-panel](https://github.com/fthx/tasks-in-panel).
The upstream repository supplies the GNU GPL version 3 text. No permission to
relicense that code under GPLv2 was found. The derived extension and preferences
retain GPLv3 terms; [LICENSE](LICENSE) contains the complete text. Eidrien's
modifications to derived code follow those terms.

The independently implemented `policy.js`, `settings.js`, `preview.js`, `roundedClip.js`, `overviewOrder.js`,
`displayPolicy.js`, `iconIdentity.js` and `titleLayout.js` are
marked **MIT**. [COPYING](COPYING) contains that grant. It applies to those original
modules, not to upstream code or GNOME Shell. MIT permits their use in the GPLv3
extension; distribution of the combination must satisfy GPLv3's requirements.

[Dash-to-Panel windowPreview.js](https://github.com/home-sweet-gnome/dash-to-panel/blob/c3aed934f927852a9ec28103e788d1954034bf4c/src/windowPreview.js)
(GPL-2.0-or-later) was consulted as a behavioral reference for delayed previews,
pointer transfer and window-frame clipping. Its implementation is not bundled.
The preview module independently uses GNOME Shell/Clutter APIs.

Task creation-order handling and optional middle-click closing adapt upstream
commits [0a0e7d3](https://github.com/fthx/tasks-in-panel/commit/0a0e7d31113ba414567bc1406b027ef67c3f9eb6)
and [4c9edd2](https://github.com/fthx/tasks-in-panel/commit/4c9edd237b8c7c89f9f70c2f855b3f8b804872f7),
respectively, under the same GPLv3 terms.

## Maintenance policy

Original work prefers MIT wherever compatible. GPL-2.0-or-later is the preferred
fallback only when provenance permits it. Never downgrade GPLv3 code, remove
required attribution, or infer licensing permission from public visibility.
Audit copied code, assets and bundled dependencies individually. File-specific
licenses remain authoritative; previously distributed grants are not revoked.

GNOME Shell and other platform components retain their own licenses. Extension
review requires compatible terms and attribution, not removal of permissive
source licenses. Licensing alone does not establish extension-store readiness.

References: [GNOME extension review](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#licensing),
[GPL compatibility](https://www.gnu.org/licenses/gpl-faq.html#WhatDoesCompatMean).

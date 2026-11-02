# Testing candidates

The initial testing branch contains the unchanged Stable Container baseline.
Its historical ZIP is built from the immutable legacy tag, not from this branch.
The first Adaptive feature update will be developed here.

For each candidate, validate task visibility and clicks, workspace/monitor
filtering, dynamic display, AppMenu, disable/re-enable and coexistence with
panel organizers. The upcoming hover-preview implementation requires native
pointer, placement, window-lifetime and keyboard testing before compatibility
claims are expanded.

Run `python3 .github/scripts/validate.py` before pushing. Keep native results
separate from static/schema/package checks. Review the promotion pull request
and apply `do-not-merge` while a desktop issue needs investigation.

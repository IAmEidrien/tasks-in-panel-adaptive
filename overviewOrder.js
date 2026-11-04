// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
// Read Shell's computed layout without opening the overview or changing it.
// V-Shell changes the layout inputs, so its position/MRU/stable modes flow here.
export function readOverviewOrder(overview) {
    // This is an optional private-API boundary. Other Shell versions/extensions
    // may replace the view objects; retain our safe fallback in that case.
    try { return readLayout(overview); } catch { return []; }
}

function readLayout(overview) {
    const views = overview?._overview?.controls?._workspacesDisplay?._workspacesViews;
    if (!Array.isArray(views)) return [];
    const workspaces = views.flatMap(view => view?._workspaces ?? (view?._workspace ? [view._workspace] : []));
    workspaces.sort((a, b) => (a.metaWorkspace?.index() ?? 0) - (b.metaWorkspace?.index() ?? 0) ||
        (a._monitorIndex ?? 0) - (b._monitorIndex ?? 0));
    const result = [];
    for (const workspace of workspaces) {
        const rows = workspace?._container?.layout_manager?._layout?.rows;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
            if (!Array.isArray(row.windows)) continue;
            for (const preview of row.windows) {
                const window = preview?.metaWindow;
                if (window && !result.includes(window)) result.push(window);
            }
        }
    }
    return result;
}

export function orderedWindows(windows, ranks) {
    return [...windows].sort((a, b) => {
        const ar = ranks.get(a), br = ranks.get(b);
        if (ar !== undefined && br !== undefined) return ar - br;
        if (ar !== undefined) return -1;
        if (br !== undefined) return 1;
        return a.get_stable_sequence() - b.get_stable_sequence();
    });
}

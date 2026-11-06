// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
export function visibleWindows(windows, {workspaceOnly, monitorOnly, focusedOnly, group}, workspace, monitor, focused, appKey) {
    const eligible = windows.filter(w => !w.skip_taskbar &&
        (!workspaceOnly || w.located_on_workspace(workspace)) &&
        (!monitorOnly || w.get_monitor() === monitor) &&
        (!focusedOnly || w === focused || focused?.get_transient_for() === w));
    if (!group) return eligible;
    const representatives = new Map();
    // Input is stacking order, bottom to top. Prefer the focused member.
    for (const w of eligible) {
        const key = appKey(w);
        if (representatives.get(key) !== focused) representatives.set(key, w);
    }
    return [...representatives.values()];
}

export function needsTitles(windows, appKey) {
    return new Set(windows.map(appKey)).size < windows.length;
}

export function backgroundStyle(enabled, color, weight) {
    const valid = /^(#[\da-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(color);
    return `${enabled && valid ? `background-color: ${color};` : ''}${weight !== 'theme' ? `font-weight: ${weight};` : ''}`;
}

// SPDX-FileCopyrightText: 2026 Eidrien
// SPDX-License-Identifier: MIT

export function ambiguousIcons(entries) {
    const counts = new Map();
    for (const e of entries) counts.set(e.icon, (counts.get(e.icon) ?? 0) + 1);
    return new Set(entries.filter(e => counts.get(e.icon) > 1).map(e => e.id));
}

// Water-fill extra space evenly, allowing short tasks to stop at their natural
// size. The input always describes the title-eligible candidate, never the
// previous frame's suppressed layout. Icon minima may exceed the viewport.
export function candidateWidths(entries, available) {
    const widths = entries.map(e => e.minimum);
    let extra = Math.max(0, available - widths.reduce((a, b) => a + b, 0));
    let pending = entries.map((_, i) => i).filter(i => entries[i].natural > widths[i]);
    while (extra > 0.01 && pending.length) {
        const share = extra / pending.length;
        for (const i of pending) {
            const added = Math.min(share, entries[i].natural - widths[i]);
            widths[i] += added; extra -= added;
        }
        pending = pending.filter(i => entries[i].natural - widths[i] > 0.01);
    }
    return widths;
}

export function suppressedApplications(entries, widths, previous, readable, margin) {
    const result = new Set();
    entries.forEach((e, i) => {
        const restoring = previous.has(e.app) && widths[i] < (e.fullNatural ?? Infinity);
        if (e.title && !readable(e, widths[i] - (restoring ? margin : 0)))
            result.add(e.app);
    });
    return result;
}

export function revealValue(value, page, start, width, upper) {
    let next = value;
    if (width > page) {
        // Keep the current edge if already inside a task wider than the view.
        if (start > value) next = start;
        else if (start + width < value + page) next = start + width - page;
    } else if (start < value) next = start;
    else if (start + width > value + page) next = start + width - page;
    return Math.max(0, Math.min(Math.max(0, upper - page), next));
}

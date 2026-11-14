import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export async function run({bar, settings: s, check, wait, screenshot, root, scale}) {
    const until = async predicate => {
        for (let n = 0; n < 40 && !predicate(); n++) await wait(50);
    };
    const shown = () => bar.displayed.filter(t => !t.dead && !t.closing);
    const source = Gio.File.new_for_path(`${root}/data/gnome-shell/extensions/tasks-in-panel-adaptive@eidrien.local`).get_uri();
    const {IconIdentity} = await import(`${source}/iconIdentity.js`);
    const {readableTitle} = await import(`${source}/titleLayout.js`);
    const identities = new IconIdentity();
    const themed = name => new Gio.ThemedIcon({name});
    check(identities.get(themed('tip-missing-one'), scale) === identities.get(themed('tip-missing-two'), scale), 'missing icons share the rendered fallback identity');
    const a = shown().filter(t => t.app.get_id().endsWith('TestA.desktop'));
    const b = shown().find(t => t.window.title === 'TIP B1');
    s.set_string('hover-action', 'none');
    s.set_int('button-width', 120);
    s.set_boolean('container-fill-space', true);
    await wait(200);
    check(a.every(t => t.titleLabel.visible) && !b.titleLabel.visible, 'ambiguous application titles coexist with a unique icon-only task');
    const allocatedReadable = t => {
        const metric=bar.metrics.find(m=>m.id===t), text=t.titleLabel.clutter_text;
        return readableTitle({...metric,layout:text.get_layout().copy(),chrome:t.width-text.width},t.width,bar.options.threshold);
    };
    check(a.every(allocatedReadable), 'eligible titles meet the threshold in actual allocated Clutter text areas');

    const spawn = (app, title) => Gio.Subprocess.new(['gjs', '-m', `${root}/client.js`, `org.eidrien.TipTest${app}`, title], Gio.SubprocessFlags.NONE);
    spawn('C', 'I');
    for (let n = 0; n < 50 && shown().length < 4; n++) await wait(100);
    const c = shown().find(t => t.window.title === 'I');
    check(!!c, 'cross-application collision fixture mapped');
    s.set_int('button-width', 60); s.set_int('minimum-title-characters', 12);
    await wait(250);
    check(a.every(t => !t.titleLabel.visible && t.has_style_class_name('tip-task-icon-only')) && c.titleLabel.visible,
        'unreadable titles suppress the entire application while a colliding complete short title survives');
    check(a.every(t => t.accessible_name === t.window.title), 'suppression preserves full accessible names');
    const metric=bar.metrics.find(m=>m.id===c), text=c.titleLabel.clutter_text;
    GLib.file_set_contents(`${root}/label-geometry.json`,JSON.stringify({task:c.width,box:c.box.width,icon:c.icon.width,label:c.titleLabel.width,text:text.width,layout:text.get_layout().get_pixel_size(),preferred:c.get_preferred_width(-1),chrome:metric.chrome,natural:metric.fullNatural,margins:[c.titleLabel.margin_left,c.titleLabel.margin_right],font:text.get_layout().get_font_description()?.to_string()}));
    check(readableTitle({...metric,layout:text.get_layout().copy(),chrome:c.width-text.width},c.width,12), 'short title is readable in its actual allocated Clutter text area');
    await screenshot('readable-short-title');

    const state = shown().map(t => t.titleLabel.visible).join();
    for (let n = 0; n < 8; n++) { bar.queueRefresh(); await wait(25); }
    check(shown().map(t => t.titleLabel.visible).join() === state, 'repeated candidate evaluation does not oscillate');
    s.set_boolean('dynamic-task-display', false); s.set_boolean('show-window-title', true);
    await wait(150);
    check(a.every(t => !t.titleLabel.visible) && c.titleLabel.visible, 'manual display obeys the same application-wide readability safeguard');

    // Exercise the real theme/font/Pango measurement, separately from the real
    // allocation checks below. No synthetic glyph widths or Unicode mocks.
    const task = a[0], saved = [task.candidateText, task.candidateTitle, task.titleEligible];
    const measure = text => {
        task.candidateText = task.candidateTitle = text; task.titleEligible = true;
        return bar.measure.measure(task, {...bar.options, maxWidth: -1});
    };
    const narrow = measure('iiiiiiii'), wide = measure('WWWWWWWW');
    const firstReadable = m => {
        for (let width = 1; width <= m.natural + 5; width++) if (readableTitle(m, width, 3)) return width;
        return Infinity;
    };
    check(firstReadable(wide) > firstReadable(narrow), 'readability uses proportional glyph widths');
    const complex = measure('a\u0301👩‍💻🇬🇧');
    check(complex.clusters.length === 3 && readableTitle(complex, complex.natural + 2, 12), 'combining marks, emoji ZWJ and flags count as three complete graphemes');
    check(!readableTitle(complex, complex.chrome + 1, 3), 'ellipsis is not counted as a meaningful character');
    [task.candidateText, task.candidateTitle, task.titleEligible] = saved;
    bar.measure.invalidate();
    s.set_boolean('dynamic-task-display', true); s.set_int('minimum-title-characters', 3);
    s.set_int('button-width', 120); await wait(150);
    const beforeTheme = bar.metrics;
    St.TextureCache.get_default().emit('icon-theme-changed'); await wait(200);
    check(bar.metrics !== beforeTheme && a.every(t => t.titleEligible), 'icon-theme notification reevaluates eligibility and layout');

    for (let n = 0; n < 9; n++) spawn('A', `Crowded window ${n}`);
    for (let n = 0; n < 60 && shown().length < 13; n++) await wait(100);
    check(shown().length === 13, 'thirteen real windows are represented');
    s.set_int('minimum-title-characters', 12); s.set_int('button-width', 50);
    await wait(350);
    const adj = bar.view.hadjustment;
    const overflow = () => adj.upper > adj.page_size + 1;
    check(overflow() && shown().every(t => t.width >= 44 * scale), 'crowding overflows with usable icon-only targets');
    check(bar.view.clip_to_allocation && bar.view.hscrollbar_policy === St.PolicyType.EXTERNAL && bar.view.vscrollbar_policy === St.PolicyType.NEVER,
        'native viewport clips content without permanent scrollbars');
    check(bar.view.get_theme_node().get_length('-st-hfade-offset') === 12 * scale && !!bar.view.get_effect('fade'), 'native scroll-position fade is installed');
    const peer = new St.Widget({width:96*scale,height:Main.panel.height});
    Main.panel._leftBox.insert_child_at_index(peer,0); await wait(150);
    for (const fill of [false, true]) for (const position of ['left', 'center', 'right']) {
        s.set_boolean('container-fill-space', fill); s.set_string('container-position', position); await wait(150);
        const box = actor => actor.get_allocation_box();
        const left = box(Main.panel._leftBox), center = box(Main.panel._centerBox), right = box(Main.panel._rightBox);
        check(left.x2 <= center.x1 + 1 && center.x2 <= right.x1 + 1 && overflow() && peer.width === 96*scale, `${position} placement clips overflow without overlapping panel peers (fill ${fill})`);
    }
    peer.destroy();
    s.set_string('container-position', 'left'); s.set_boolean('container-fill-space', true); await wait(200);
    const visible = t => t.width > adj.page_size ? t.x <= adj.value + 1 && t.x + t.width >= adj.value + adj.page_size - 1 :
        t.x >= adj.value - 1 && t.x + t.width <= adj.value + adj.page_size + 1;
    for (const t of shown()) {
        Main.activateWindow(t.window); await until(() => global.display.focus_window === t.window && visible(t));
        GLib.file_set_contents(`${root}/focus.json`,JSON.stringify({task:t.window.title,focus:global.display.focus_window?.title,x:t.x,width:t.width,value:adj.value,page:adj.page_size,upper:adj.upper,pending:bar.revealPending,paint:bar.revealPaintSignal,position:t.get_transformed_position(),view:bar.view.get_transformed_position(),box:bar.box.get_allocation_box()}));
        check(visible(t), 'ordinary focus reveals '+t.window.title.slice(0,20));
    }
    for (const t of shown()) Main.activateWindow(t.window);
    const finalTarget=shown().at(-1);
    await until(() => global.display.focus_window===finalTarget.window && visible(finalTarget));
    check(global.display.focus_window===finalTarget.window && visible(finalTarget), 'rapid focus cycling reveals the final target without queued animation');
    const backend = Clutter.get_default_backend?.() ?? global.stage.get_context().get_backend();
    const seat = backend.get_default_seat();
    const pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    const move = actor => { const [x,y] = actor.get_transformed_position(), [w,h] = actor.get_transformed_size(); pointer.notify_absolute_motion(GLib.get_monotonic_time(), x+w/2, y+h/2); };
    const key = (symbol, state) => keyboard.notify_keyval(GLib.get_monotonic_time(), symbol, state);
    const wheel = direction => pointer.notify_discrete_scroll(GLib.get_monotonic_time(), direction, Clutter.ScrollSource.WHEEL);
    const beforeAlt=global.display.focus_window;
    key(Clutter.KEY_Alt_L, Clutter.KeyState.PRESSED); key(Clutter.KEY_Tab, Clutter.KeyState.PRESSED); await wait(50);
    key(Clutter.KEY_Tab, Clutter.KeyState.RELEASED); key(Clutter.KEY_Alt_L, Clutter.KeyState.RELEASED);
    await until(() => global.display.focus_window!==beforeAlt && shown().some(t=>t.window===global.display.focus_window && visible(t)));
    check(global.display.focus_window!==beforeAlt && shown().some(t=>t.window===global.display.focus_window && visible(t)), 'native Alt+Tab keeps its represented task visible');
    Main.overview.show(); await wait(600);
    const overviewTarget = shown()[0].window; Main.activateWindow(overviewTarget);
    await until(() => !Main.overview.visible && global.display.focus_window === overviewTarget && visible(bar.tasks.get(overviewTarget)));
    check(!Main.overview.visible && global.display.focus_window === overviewTarget && visible(bar.tasks.get(overviewTarget)), 'overview activation reveals the selected task');
    s.set_boolean('container-scroll', false); await wait(100); adj.value = 0; move(bar.view); await wait(100);
    const focused = global.display.focus_window;
    wheel(Clutter.ScrollDirection.DOWN); await wait(150);
    check(adj.value > 0 && global.display.focus_window === focused, 'real wheel scrolls overflowing viewport when switching is off');
    await screenshot('overflow-middle');
    const manual = adj.value; bar.queueRefresh(); await wait(100);
    check(Math.abs(adj.value - manual) < 1, 'ordinary refresh preserves manual scroll position');
    bar.overviewOrder = new Map([...bar.overviewOrder].reverse().map(([w],i) => [w,i])); bar.queueRefresh(); await wait(100);
    check(Math.abs(adj.value - manual) < 1, 'reordering alone preserves manual scroll position');
    s.set_boolean('container-scroll', true); await wait(100); adj.value = 0;
    wheel(Clutter.ScrollDirection.RIGHT); await wait(120);
    check(adj.value > 0 && global.display.focus_window === focused, 'horizontal wheel manually scrolls even with window switching enabled');
    adj.value = 0; key(Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED); wheel(Clutter.ScrollDirection.DOWN);
    key(Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED); await wait(100);
    check(adj.value > 0 && global.display.focus_window === focused, 'Shift+wheel manually scrolls without changing focus');
    adj.value = 0;
    pointer.notify_scroll_continuous(GLib.get_monotonic_time(), 10, 0, Clutter.ScrollSource.CONTINUOUS, Clutter.ScrollFinishFlags.NONE); await wait(120);
    check(adj.value > 0 && global.display.focus_window === focused, 'horizontal smooth input scrolls the viewport');
    const windows = shown().map(t => t.window), index = windows.indexOf(focused);
    wheel(Clutter.ScrollDirection.DOWN);
    for (let n=0;n<20 && (global.display.focus_window!==windows[(index+1)%windows.length] || !visible(shown().find(t=>t.window===global.display.focus_window)));n++) await wait(50);
    GLib.file_set_contents(`${root}/wheel-state.json`,JSON.stringify({expected:windows[(index+1)%windows.length]?.title,actual:global.display.focus_window?.title,pointer:global.get_pointer(),pending:bar.revealPending,paint:bar.revealPaintSignal,value:adj.value,order:shown().map(t=>t.window.title.slice(0,25))}));
    check(global.display.focus_window === windows[(index+1)%windows.length] && visible(shown().find(t => t.window === global.display.focus_window)), 'one wheel event switches exactly one represented window and reveals it');

    s.set_boolean('group-windows', true); await wait(180);
    const grouped = shown().find(t => t.app === a[0].app);
    check(shown().length === 3 && visible(shown().find(t => t.app === grouped.app)), 'grouped focus reveals the current application representative');
    bar.preview.open(grouped, bar.previewWindows(grouped)); await wait(180);
    const popupScroll = bar.preview.cards.get_parent();
    const value = adj.value, focus = global.display.focus_window;
    move(popupScroll); await wait(100); wheel(Clutter.ScrollDirection.DOWN); await wait(150);
    check(adj.value === value && global.display.focus_window === focus && bar.preview.visible, 'preview scrolling stays independent from task-container switching');
    bar.preview.close();
    await screenshot('crowded-grouped');
    s.set_boolean('group-windows', false); await wait(120);
    adj.value = Math.max(0, adj.upper - adj.page_size);
    for (const t of shown().filter(t => t.window.title.startsWith('Crowded'))) t.window.delete(global.get_current_time());
    for (let n = 0; n < 40 && shown().length > 4; n++) await wait(100);
    check(shown().length === 4 && adj.value <= Math.max(0, adj.upper-adj.page_size)+1, 'closing windows clamps the preserved adjustment');
    c.window.change_workspace_by_index(1, false); await wait(150);
    s.set_boolean('show-focused-window', true); Main.activateWindow(b.window); await wait(150);
    check(shown().length === 1 && !shown()[0].titleLabel.visible, 'final focused/workspace filters determine icon ambiguity');
    s.set_boolean('show-focused-window', false); s.set_boolean('group-windows', true); await wait(150);
    s.set_boolean('container-scroll', false); await wait(100);
    check(!overflow() && bar.scroll({get_scroll_direction: () => Clutter.ScrollDirection.DOWN}) === Clutter.EVENT_PROPAGATE, 'non-overflowing viewport propagates wheel input when switching is disabled');
    await screenshot('uncrowded');
}

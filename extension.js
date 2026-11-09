/* Tasks in Panel Adaptive — derived from Tasks in Panel by fthx.
 * GPLv3; upstream attribution and license are preserved in LICENSE/LICENSING.md.
 * Adaptive task/container implementation maintained by Eidrien.
 */
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {migrate} from './settings.js';
import {backgroundStyle, needsTitles, visibleWindows} from './policy.js';
import {Preview} from './preview.js';
import {PanelFillConstraint} from './panelFill.js';
import {readOverviewOrder, orderedWindows} from './overviewOrder.js';

const STATUS_ID = 'tasksInPanelTaskbar';
const appFor = w => Shell.WindowTracker.get_default().get_window_app(w);
const appKey = w => appFor(w)?.get_id() ?? w.get_wm_class() ?? w;

const Task = GObject.registerClass(class Task extends St.Button {
    _init(bar, window) {
        super._init({style_class: 'panel-button tip-task', reactive: true,
            can_focus: true, track_hover: true,
            button_mask: (St.ButtonMask.PRIMARY ?? St.ButtonMask.ONE) |
                (St.ButtonMask.MIDDLE ?? St.ButtonMask.TWO) | (St.ButtonMask.SECONDARY ?? St.ButtonMask.THREE)});
        this.bar = bar;
        this.window = window;
        this.box = new St.BoxLayout();
        this.icon = new St.Icon({icon_size: 18, fallback_icon_name: 'application-x-executable-symbolic'});
        this.titleLabel = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this.titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.box.add_child(this.icon);
        this.box.add_child(this.titleLabel);
        this.set_child(this.box);
        // Newer Shell menus use key controllers, which run before legacy
        // key-press signals. Register our primary action before the menu's.
        if (Clutter.KeyController) {
            const keys = new Clutter.KeyController();
            keys.connect('key-press', () => this.handleKey(keys.get_key()[1]));
            this.add_action(keys);
        } else {
            this.connect('key-press-event', (_actor, event) => this.handleKey(event.get_key_symbol()));
        }
        this.menu = new AppMenu(this);
        this.menu.actor.hide();
        Main.uiGroup.add_child(this.menu.actor);
        Main.panel.menuManager.addMenu(this.menu);
        this.connect('clicked', (_button, button) => this.activate(button || Clutter.BUTTON_PRIMARY));
        this.connect('notify::hover', () => this.onHover());
        window.connectObject(
            'notify::title', () => this.bar.queueRefresh(),
            'notify::appears-focused', () => this.bar.queueRefresh(),
            'notify::skip-taskbar', () => this.bar.queueRefresh(),
            'notify::wm-class', () => this.bar.queueRefresh(),
            'notify::gtk-application-id', () => this.bar.queueRefresh(),
            'workspace-changed', () => this.bar.queueRefresh(),
            'position-changed', () => this.bar.queueRefresh(),
            'unmanaging', () => this.bar.removeWindow(window), this);
    }

    render(showTitles) {
        const o = this.bar.options;
        const app = appFor(this.window);
        if (app !== this.app) {
            this.app = app;
            this.menu.setApp(app);
            this.icon.gicon = app?.icon ?? null;
        }
        const icon = o.dynamic || o.icon;
        const title = o.dynamic ? showTitles : o.title;
        const name = !o.dynamic && o.app;
        this.icon.visible = icon;
        this.titleLabel.visible = title || name;
        if (!title && !name) this.add_style_class_name('tip-task-icon-only');
        else this.remove_style_class_name('tip-task-icon-only');
        this.titleLabel.text = [title ? this.window.title || 'Untitled window' : '', name ? app?.get_name() : ''].filter(Boolean).join(' — ');
        this.accessible_name = this.window.title || app?.get_name() || 'Window';
        // St CSS max-width limits content; account for theme padding/borders
        // so the setting describes the entire task target, also at HiDPI.
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const decoration = this.get_theme_node().adjust_preferred_width(0, 0)[1] / scale;
        this.set_style(o.maxWidth >= 0 ? `max-width: ${Math.max(0, o.maxWidth - decoration)}px;` : null);
        this.titleLabel.set_style(o.weight === 'theme' ? null : `font-weight: ${o.weight};`);
        if (this._monochrome !== o.monochrome) {
            this.icon.clear_effects();
            if (o.monochrome) this.icon.add_effect(new Clutter.DesaturateEffect());
            this._monochrome = o.monochrome;
        }
        const focused = this.window === global.display.focus_window ||
            global.display.focus_window?.get_transient_for() === this.window;
        this.box.opacity = focused || this.hover || this.has_key_focus() ? 255 : 160;
        if (focused) this.add_style_pseudo_class('active');
        else this.remove_style_pseudo_class('active');
    }

    handleKey(symbol) {
        if ([Clutter.KEY_space, Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(symbol)) {
            this.activate(Clutter.BUTTON_PRIMARY);
            return Clutter.EVENT_STOP;
        }
        if (symbol !== Clutter.KEY_Escape) return Clutter.EVENT_PROPAGATE;
        this.menu?.close();
        this.cancelHover();
        this.bar.preview.close();
        return Clutter.EVENT_STOP;
    }

    activate(button) {
        if (this.dead || this.closing) return;
        this.cancelHover();
        this.bar.preview.close();
        if (button === Clutter.BUTTON_SECONDARY ||
            (button === Clutter.BUTTON_PRIMARY && this.bar.options.focusedOnly)) {
            this.menu.toggle();
        } else if (button === Clutter.BUTTON_MIDDLE) {
            if (this.bar.options.middleClickClose) {
                if (this.window.can_close()) this.window.delete(global.get_current_time());
            } else if (this.app?.can_open_new_window()) {
                this.app.open_new_window(global.get_current_time());
                Main.overview.hide();
            }
        } else if (button === Clutter.BUTTON_PRIMARY) {
            if (this.window.appears_focused && !Main.overview.visible && this.window.can_minimize()) this.window.minimize();
            else Main.activateWindow(this.window);
        }
    }

    cancelHover() {
        if (this.hoverTimer) GLib.source_remove(this.hoverTimer);
        this.hoverTimer = 0;
        if (this.raised && this.previousTop) {
            try { if (this.previousTop.get_compositor_private()) this.previousTop.raise(); } catch (_) { /* Window closed. */ }
        }
        this.previousTop = null;
        this.raised = false;
    }

    onHover() {
        this.cancelHover();
        if (this.dead || this.closing) return;
        this.box.opacity = this.hover || this.window.appears_focused || this.has_key_focus() ? 255 : 160;
        if (!this.hover) { this.bar.preview.requestClose(); return; }
        if (this.dead || Main.overview.visible || Main.sessionMode.isLocked || this.menu.isOpen) return;
        const action = this.bar.options.hover;
        if (action === 'none') return;
        const delay = this.bar.preview.visible ? Math.min(100, this.bar.options.delay) : this.bar.options.delay;
        this.hoverTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.hoverTimer = 0;
            if (this.dead || !this.hover || !this.visible || Main.overview.visible) return GLib.SOURCE_REMOVE;
            if (action === 'preview') this.bar.preview.open(this, this.bar.previewWindows(this));
            else {
                const windows = this.window.get_workspace()?.list_windows().filter(w => w.get_monitor() === this.window.get_monitor()) ?? [];
                this.previousTop = global.display.sort_windows_by_stacking(windows).at(-1);
                this.window.raise();
                this.raised = true;
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this.dead) return;
        this.dead = true;
        this.cancelHover();
        this.window.disconnectObject(this);
        if (this.bar.preview.source === this) this.bar.preview.close();
        this.menu.close(Number(Config.PACKAGE_VERSION.split('.')[0]) >= 51 ? {animate: false} : 0);
        Main.panel.menuManager.removeMenu(this.menu);
        this.menu.destroy();
        this.menu = null;
        this.remove_all_transitions();
        super.destroy();
    }
});

const TaskBar = GObject.registerClass(class TaskBar extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Tasks in Panel Adaptive', true);
        // This is a container, not a menu source. A registered dummy menu
        // captures child enter events and opens their AppMenus on mere hover.
        this.setMenu(null);
        this._delegate = this;
        this.settings = settings;
        this.tasks = new Map();
        this.closed = new WeakSet();
        this.overviewOrder = new Map();
        this.can_focus = false;
        this.taskRole = this.accessible_role;
        // Retain PanelMenu registration, without its button/theme feedback.
        this.remove_style_class_name('panel-button');
        this.add_style_class_name('tip-container');
        this.track_hover = true;
        this.box = new St.BoxLayout({y_expand: true});
        this.add_child(this.box);
        this.preview = new Preview();
        this.readSettings();
        Main.panel.addToStatusArea(STATUS_ID, this, 99, this.options.position);
        this._placement = this.options.position;
        this.syncFill();
        this.connect('scroll-event', (_actor, event) => this.scroll(event));
        this.connect('notify::allocation', () => {
            const monitor = Main.layoutManager.findMonitorForActor(this)?.index ?? Main.layoutManager.primaryIndex;
            if (this.monitor !== monitor) { this.monitor = monitor; this.queueRefresh(); }
        });
        global.display.connectObject('window-created', () => this.queueRefresh(),
            'notify::focus-window', () => this.queueRefresh(), this);
        global.window_manager.connectObject('map', () => this.queueRefresh(), this);
        global.workspace_manager.connectObject('active-workspace-changed', () => this.queueRefresh(), this);
        Main.layoutManager.connectObject('monitors-changed', () => { this.preview.close(); this.queueRefresh(); }, this);
        Main.overview.connectObject('showing', () => { this.stopHover(); this.captureOverviewOrder(); },
            'shown', () => this.captureOverviewOrder(),
            'hiding', () => this.captureOverviewOrder(), this);
        this.sessionSignal = Main.sessionMode.connect('updated', () => this.stopHover());
        this.settingsSignal = settings.connect('changed', () => {
            this.stopHover(); this.readSettings(); this.queueRefresh();
        });
        this.refresh();
        if (Main.overview.visible) this.captureOverviewOrder();
    }

    syncFill() {
        if (this.fillParent) {
            this.fillParent.remove_constraint(this.fillConstraint);
            this.fillParent.queue_relayout();
        }
        this.fillParent = null;
        this.fillConstraint = null;
        const fill = this.settings.get_boolean('container-fill-space');
        this.container.x_expand = fill;
        this.x_expand = fill;
        this.box.x_expand = fill;
        if (fill) {
            this.fillParent = this.container.get_parent();
            this.fillConstraint = new PanelFillConstraint(Main.panel, this.options.position, Main.layoutManager);
            this.fillParent.add_constraint(this.fillConstraint);
        }
        Main.panel.queue_relayout();
    }

    readSettings() {
        const s = this.settings;
        this.options = {dynamic: s.get_boolean('dynamic-task-display'), icon: s.get_boolean('show-window-icon'),
            title: s.get_boolean('show-window-title'), app: s.get_boolean('show-window-app'),
            workspaceOnly: s.get_boolean('show-active-workspace'), monitorOnly: s.get_boolean('show-panel-monitor-only'),
            focusedOnly: s.get_boolean('show-focused-window'), group: s.get_boolean('group-windows'),
            monochrome: s.get_boolean('desaturate-icon'), maxWidth: s.get_int('button-width'),
            middleClickClose: s.get_boolean('middle-click-close'), animate: s.get_boolean('animate-on-close'), hover: s.get_string('hover-action'), delay: s.get_int('hover-delay'),
            previewHeight: s.get_int('preview-height'),
            scroll: s.get_boolean('container-scroll'), position: s.get_string('container-position'), weight: s.get_string('container-font-weight')};
        this.set_style(backgroundStyle(s.get_boolean('container-custom-background'),
            s.get_string('container-background-color'), this.options.weight));
        if (this._placement && this._placement !== this.options.position) {
            const parent = this.container.get_parent();
            parent?.remove_child(this.container);
            Main.panel[`_${this.options.position}Box`].add_child(this.container);
            this._placement = this.options.position;
        }
        if (this._placement) this.syncFill();
    }

    queueRefresh() {
        if (this.refreshTimer || this.dead) return;
        this.refreshTimer = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.refreshTimer = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    captureOverviewOrder(defer = true) {
        const order = readOverviewOrder(Main.overview);
        // Shell may have already destroyed its workspace views on exit.
        if (order.length) {
            this.overviewOrder = new Map(order.filter(w => !this.closed.has(w)).map((w, i) => [w, i]));
            this.queueRefresh();
        }
        // 'shown' can precede the first workspace allocation on older Shell.
        // Read after one painted frame, without polling or forcing a layout.
        if (defer && Main.overview.visible) {
            if (this.orderPaintSignal) global.stage.disconnect(this.orderPaintSignal);
            this.orderPaintSignal = global.stage.connect('after-paint', () => {
                global.stage.disconnect(this.orderPaintSignal);
                this.orderPaintSignal = 0;
                if (!this.dead) this.captureOverviewOrder(false);
            });
        }
    }

    refresh() {
        const windows = global.display.sort_windows_by_stacking(global.get_window_actors().map(a => a.meta_window)
            .filter(w => w && !this.closed.has(w) && w.window_type !== Meta.WindowType.MODAL_DIALOG));
        // Keep the last computed overview order stable outside the overview.
        // Group representatives still follow focus/stacking, independently.
        const ordered = orderedWindows(windows, this.overviewOrder);
        for (const w of ordered) if (!this.tasks.has(w)) {
            const task = new Task(this, w);
            this.tasks.set(w, task);
            this.box.add_child(task);
        }
        const workspace = global.workspace_manager.get_active_workspace();
        this.eligible = visibleWindows(ordered, {...this.options, group: false}, workspace,
            this.monitor ?? Main.layoutManager.primaryIndex, global.display.focus_window, appKey);
        const shown = visibleWindows(windows, this.options, workspace,
            this.monitor ?? Main.layoutManager.primaryIndex, global.display.focus_window, appKey);
        // A grouped application keeps its first eligible member's slot even
        // when focus selects a different representative window.
        const rank = new Map(ordered.map((w, i) => [w, i]));
        const appRanks = new Map();
        for (const w of this.eligible) if (!appRanks.has(appKey(w))) appRanks.set(appKey(w), rank.get(w));
        shown.sort((a, b) => this.options.group
            ? appRanks.get(appKey(a)) - appRanks.get(appKey(b)) : rank.get(a) - rank.get(b));
        const presentation = [...shown, ...ordered.filter(w => !shown.includes(w))];
        presentation.forEach((w, index) => {
            const task = this.tasks.get(w);
            if (this.box.get_child_at_index(index) !== task) this.box.set_child_at_index(task, index);
        });
        this.syncPresence(shown.length > 0);
        const titles = needsTitles(shown, appKey);
        for (const [w, task] of this.tasks) {
            task.visible = shown.includes(w);
            if (!task.visible) {
                task.cancelHover();
                if (this.preview.source === task) this.preview.close();
            }
            task.render(titles);
        }
    }

    syncPresence(hasTasks) {
        this.hasTasks = hasTasks;
        // Keep visible/mapped and allocated: hiding the actor would collapse fill.
        this.opacity = hasTasks ? 255 : 0;
        this.reactive = hasTasks;
        this.track_hover = hasTasks;
        this.accessible_role = hasTasks ? this.taskRole : Atk.Role.REDUNDANT_OBJECT;
        if (!hasTasks) {
            this.remove_style_pseudo_class('hover');
            this.scrollDelta = 0;
            this.stopHover();
        }
    }

    previewWindows(task) {
        return this.options.group ? this.eligible.filter(w => appKey(w) === appKey(task.window)) : [task.window];
    }

    removeWindow(window) {
        this.closed.add(window);
        this.overviewOrder.delete(window);
        this.preview.close();
        const task = this.tasks.get(window);
        if (!task) return;
        this.tasks.delete(window);
        task.closing = true;
        task.cancelHover();
        if (this.options.animate && this.mapped) task.ease({opacity: 0, duration: 150, onComplete: () => task.destroy()});
        else task.destroy();
        this.queueRefresh();
    }

    stopHover() {
        this.preview.close();
        for (const task of this.tasks.values()) task.cancelHover();
    }

    scroll(event) {
        if (!this.hasTasks || !this.options.scroll) return Clutter.EVENT_PROPAGATE;
        const dir = event.get_scroll_direction();
        let step;
        if (dir === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            this.scrollDelta = (this.scrollDelta ?? 0) + (Math.abs(dy) >= Math.abs(dx) ? dy : dx);
            if (Math.abs(this.scrollDelta) < 1) return Clutter.EVENT_STOP;
            step = Math.sign(this.scrollDelta); this.scrollDelta = 0;
        } else step = [Clutter.ScrollDirection.UP, Clutter.ScrollDirection.LEFT].includes(dir) ? -1 : 1;
        const windows = this.box.get_children().filter(t => t.visible && !t.closing).map(t => t.window);
        if (windows.length < 2) return Clutter.EVENT_PROPAGATE;
        const current = windows.indexOf(global.display.focus_window);
        const next = windows[current < 0 ? (step > 0 ? 0 : windows.length - 1) : (current + step + windows.length) % windows.length];
        if (next === global.display.focus_window) return Clutter.EVENT_PROPAGATE;
        this.stopHover();
        Main.activateWindow(next);
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.dead = true;
        if (this.fillParent) this.fillParent.remove_constraint(this.fillConstraint);
        this.fillParent = null;
        this.fillConstraint = null;
        Main.panel.queue_relayout();
        if (this.orderPaintSignal) global.stage.disconnect(this.orderPaintSignal);
        this.orderPaintSignal = 0;
        if (this.refreshTimer) GLib.source_remove(this.refreshTimer);
        this.refreshTimer = 0;
        this.settings.disconnect(this.settingsSignal);
        Main.sessionMode.disconnect(this.sessionSignal);
        global.display.disconnectObject(this);
        global.window_manager.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        Main.overview.disconnectObject(this);
        this.preview.destroy();
        for (const task of this.box.get_children()) task.destroy();
        this.tasks.clear();
        this.overviewOrder.clear();
        super.destroy();
    }
});

export default class TasksInPanelAdaptive extends Extension {
    enable() {
        if (Main.panel.statusArea[STATUS_ID]) throw Error('Disable the other Tasks in Panel extension before enabling Tasks in Panel Adaptive.');
        this.settings = this.getSettings();
        migrate(this.settings, this);
        this._bar = new TaskBar(this.settings);
    }
    disable() {
        this._bar?.destroy();
        this._bar = null;
        this.settings = null;
    }
}

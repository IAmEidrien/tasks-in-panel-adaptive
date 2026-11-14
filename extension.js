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
import {backgroundStyle, visibleWindows} from './policy.js';
import {Preview} from './preview.js';
import {PanelFillConstraint, fillRegion} from './panelFill.js';
import {ambiguousIcons, candidateWidths, suppressedApplications, revealValue} from './displayPolicy.js';
import {TitleMeasure, readableTitle} from './titleLayout.js';
import {IconIdentity} from './iconIdentity.js';
import {readOverviewOrder, orderedWindows} from './overviewOrder.js';

const STATUS_ID = 'tasksInPanelTaskbar';
const appFor = w => Shell.WindowTracker.get_default().get_window_app(w);
const appKey = w => w ? appFor(w)?.get_id() ?? w.get_wm_class() ?? w : null;

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
        this.connect('key-focus-in', () => { this.bar.keyboardReveal = this; this.bar.revealPending = true; this.bar.queueReveal(); });
        this.connect('notify::allocation', () => { if (this.bar.revealPending) this.bar.queueReveal(); });
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

    render(showTitles, suppressed = false) {
        const o = this.bar.options;
        const app = appFor(this.window);
        if (app !== this.app) {
            this.app?.disconnectObject(this);
            this.app = app;
            app?.connectObject('notify::icon', () => this.bar.queueRefresh(), this);
            this.menu.setApp(app);
        }
        this.icon.gicon = app?.icon ?? null;
        const icon = o.dynamic || o.icon;
        const title = o.dynamic ? showTitles : o.title;
        const name = !o.dynamic && o.app;
        this.icon.visible = icon;
        this.titleEligible = title;
        this.candidateTitle = title ? this.window.title || 'Untitled window' : '';
        this.candidateText = [this.candidateTitle, name ? app?.get_name() : ''].filter(Boolean).join(' — ');
        this.appKey = appKey(this.window);
        this.labelEligible = title || name;
        this.setSuppressed(suppressed);
        this.titleLabel.text = this.candidateText;
        this.accessible_name = this.window.title || app?.get_name() || 'Window';
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

    setSuppressed(suppressed) {
        const visible = !suppressed && this.labelEligible;
        if (this.titleLabel.visible !== visible) this.titleLabel.visible = visible;
        if (this.iconOnly !== !visible) {
            this.iconOnly = !visible;
            if (this.iconOnly) this.add_style_class_name('tip-task-icon-only');
            else this.remove_style_class_name('tip-task-icon-only');
        }
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
        this.app?.disconnectObject(this);
        this.titleMetrics = this.titleMetricsKey = null;
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
        this.view = new St.ScrollView({style_class: 'tip-task-scroll', clip_to_allocation: true,
            hscrollbar_policy: St.PolicyType.EXTERNAL, vscrollbar_policy: St.PolicyType.NEVER,
            x_expand: true, y_expand: true, enable_mouse_scrolling: false});
        this.view.set_child(this.box);
        this.add_child(this.view);
        this.measure = new TitleMeasure(this);
        this.identities = new IconIdentity();
        this.suppressed = new Set();
        this.revealPending = true;
        this.preview = new Preview();
        this.readSettings();
        Main.panel.addToStatusArea(STATUS_ID, this, 99, this.options.position);
        this._placement = this.options.position;
        this.syncFill();
        this.connect('captured-event', (_actor, event) => event.type() === Clutter.EventType.SCROLL ? this.scroll(event) : Clutter.EVENT_PROPAGATE);
        this.view.connect('notify::allocation', () => {
            if (this.lastViewWidth !== this.view.width) {
                this.lastViewWidth = this.view.width; this.revealPending = true; this.queueLayout();
            }
            if (this.revealPending) this.queueReveal();
        });
        this.view.connect('notify::mapped', () => { if (this.view.mapped && this.revealPending) this.queueReveal(); });
        this.box.connect('notify::allocation', () => { if (this.revealPending) this.queueReveal(); });
        this.connect('notify::allocation', () => {
            const monitor = Main.layoutManager.findMonitorForActor(this)?.index ?? Main.layoutManager.primaryIndex;
            if (this.monitor !== monitor) { this.monitor = monitor; this.queueRefresh(); }
        });
        global.display.connectObject('window-created', () => this.queueRefresh(),
            'notify::focus-window', () => { this.revealPending = true; this.keyboardReveal = null; this.queueRefresh(); }, this);
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
        this.themeContext = St.ThemeContext.get_for_stage(global.stage);
        this.themeContext.connectObject('changed', () => { this.identities.clear(); this.measure.invalidate(); this.revealPending = true; this.queueRefresh(); }, this);
        St.TextureCache.get_default().connectObject('icon-theme-changed', () => { this.identities.clear(); this.measure.invalidate(); this.queueRefresh(); }, this);
        for (const actor of [Main.panel, Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox])
            actor.connectObject('notify::allocation', () => {
                if (this.lastCapacity !== this.capacity()) this.queueLayout();
            }, this);
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
            previewHeight: s.get_int('preview-height'), threshold: s.get_int('minimum-title-characters'),
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
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const titles = ambiguousIcons(shown.map(w => ({id: w, icon: this.identities.get(appFor(w)?.icon, scale)})));
        const members = new Set(shown);
        if (!this.members || members.size !== this.members.size || shown.some(w => !this.members.has(w))) this.revealPending = true;
        this.members = members;
        this.displayed = shown.map(w => this.tasks.get(w));
        for (const [w, task] of this.tasks) {
            task.visible = shown.includes(w);
            if (!task.visible) {
                task.cancelHover();
                if (this.preview.source === task) this.preview.close();
            }
            task.render(titles.has(w), this.suppressed.has(appKey(w)));
        }
        this.metrics = this.displayed.map(t => this.measure.measure(t, this.options));
        this.queueLayout();
    }

    capacity() {
        const panel = Main.panel, width = panel.width;
        const natural = box => {
            const children = box.get_children().filter(c => c !== this.container && c.visible);
            const [found, spacing] = box.get_theme_node().lookup_length('spacing', false);
            return children.reduce((n, c) => n + c.get_preferred_width(-1)[1], 0) +
                Math.max(0, children.length - (box === this.container.get_parent() ? 0 : 1)) * (found ? spacing : 0);
        };
        const left = natural(panel._leftBox), center = natural(panel._centerBox), right = natural(panel._rightBox);
        const monitor = Main.layoutManager.findMonitorForActor(panel);
        const work = monitor && Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const offset = work ? 2 * (work.x - monitor.x) + work.width - monitor.width : 0;
        const [a, b] = fillRegion(width, left, center, right, this.options.position,
            panel.get_text_direction() === Clutter.TextDirection.RTL, offset);
        const peers = this.options.position === 'left' ? left : this.options.position === 'right' ? right : center;
        return Math.max(1, b - a - peers);
    }

    queueLayout() {
        if (this.layoutLater || this.dead) return;
        this.layoutLater = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this.layoutLater = 0;
            this.layoutTasks();
            return GLib.SOURCE_REMOVE;
        });
    }

    layoutTasks() {
        if (!this.metrics) return;
        const scale = this.themeContext.scale_factor;
        const capacity = this.capacity();
        this.lastCapacity = capacity;
        const style = `max-width: ${capacity / scale}px;`;
        if (this.view.style !== style) this.view.style = style;
        const available = this.settings.get_boolean('container-fill-space') && this.view.has_allocation()
            ? Math.min(capacity, this.view.width) : capacity;
        const widths = candidateWidths(this.metrics, available).map(Math.floor);
        this.suppressed = suppressedApplications(this.metrics, widths, this.suppressed,
            (m, w) => readableTitle(m, w, this.options.threshold), 2 * scale);
        this.metrics.forEach((m, i) => {
            if (m.id.dead || m.id.closing || !m.id.visible) return;
            const suppressed = this.suppressed.has(m.app);
            m.id.setSuppressed(suppressed);
            const width = suppressed ? m.iconWidth : widths[i];
            if (m.id.assignedWidth !== width) { m.id.assignedWidth = width; m.id.width = width; }
        });
        if (this.revealPending) this.queueReveal();
    }

    queueReveal() {
        if (this.revealPaintSignal || this.dead) return;
        // Geometry and adjustment bounds are only final after allocation. A
        // single painted frame also covers focus changes that need no relayout.
        this.revealPaintSignal = global.stage.connect('after-paint', () => {
            global.stage.disconnect(this.revealPaintSignal);
            this.revealPaintSignal = 0;
            if (!this.revealPending || !this.view.mapped || this.view.width <= 0) return;
            const focused = global.display.focus_window;
            const keyboard = this.keyboardReveal;
            const task = keyboard?.visible && !keyboard.dead && !keyboard.closing ? keyboard : this.displayed?.find(t =>
                !t.dead && !t.closing && t.visible && (t.window === focused || focused?.get_transient_for() === t.window ||
                (this.options.group && appKey(focused) === t.appKey)));
            if (task && task.width > 0) {
                const adj = this.view.hadjustment;
                adj.value = revealValue(adj.value, adj.page_size, task.x, task.width, adj.upper);
            }
            this.revealPending = false;
            this.keyboardReveal = null;
        });
        global.stage.queue_redraw();
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
        if (!this.hasTasks) return Clutter.EVENT_PROPAGATE;
        const dir = event.get_scroll_direction();
        const [dx, dy] = dir === Clutter.ScrollDirection.SMOOTH ? event.get_scroll_delta() : [0, 0];
        const horizontal = [Clutter.ScrollDirection.LEFT, Clutter.ScrollDirection.RIGHT].includes(dir) ||
            (dir === Clutter.ScrollDirection.SMOOTH && Math.abs(dx) > Math.abs(dy));
        const manual = horizontal || Boolean((event.get_state?.() ?? 0) & Clutter.ModifierType.SHIFT_MASK) || !this.options.scroll;
        if (manual) {
            const adj = this.view.hadjustment;
            if (adj.upper <= adj.page_size + 0.5) return Clutter.EVENT_PROPAGATE;
            if (event.is_pointer_emulated?.()) return Clutter.EVENT_STOP;
            const delta = dir === Clutter.ScrollDirection.SMOOTH ? (horizontal ? dx : dy) :
                [Clutter.ScrollDirection.UP, Clutter.ScrollDirection.LEFT].includes(dir) ? -1 : 1;
            adj.adjust_for_scroll_event(delta);
            this.stopHover();
            return Clutter.EVENT_STOP;
        }
        if (event.is_pointer_emulated?.()) return Clutter.EVENT_STOP;
        let step;
        if (dir === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            this.scrollDelta = (this.scrollDelta ?? 0) + (Math.abs(dy) >= Math.abs(dx) ? dy : dx);
            if (Math.abs(this.scrollDelta) < 1) return Clutter.EVENT_STOP;
            step = Math.sign(this.scrollDelta); this.scrollDelta = 0;
        } else step = [Clutter.ScrollDirection.UP, Clutter.ScrollDirection.LEFT].includes(dir) ? -1 : 1;
        const windows = this.box.get_children().filter(t => t.visible && !t.closing).map(t => t.window);
        if (windows.length < 2) return Clutter.EVENT_PROPAGATE;
        const focused = global.display.focus_window;
        const current = windows.findIndex(w => w === focused || focused?.get_transient_for() === w ||
            (this.options.group && appKey(w) === appKey(focused)));
        const next = windows[current < 0 ? (step > 0 ? 0 : windows.length - 1) : (current + step + windows.length) % windows.length];
        if (next === global.display.focus_window) return Clutter.EVENT_PROPAGATE;
        this.stopHover();
        Main.activateWindow(next);
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.dead = true;
        if (this.layoutLater) global.compositor.get_laters().remove(this.layoutLater);
        this.layoutLater = 0;
        if (this.revealPaintSignal) global.stage.disconnect(this.revealPaintSignal);
        this.revealPaintSignal = 0;
        this.themeContext.disconnectObject(this);
        St.TextureCache.get_default().disconnectObject(this);
        for (const actor of [Main.panel, Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox])
            actor.disconnectObject(this);
        this.measure.destroy();
        this.metrics = this.displayed = this.members = this.keyboardReveal = null;
        this.suppressed.clear();
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

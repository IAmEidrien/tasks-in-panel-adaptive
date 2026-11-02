//    Tasks in panel
//    GNOME Shell extension
//    @fthx 2026
//    Light style mode copied from @fmuellner GNOME official extension
//    Power profile indicator copied from @fthx dedicated extension (help of @fmuellner)


import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';


const ICON_SIZE = 18; // px
const UNFOCUSED_TASK_BUTTON_OPACITY = 128; // 0...255
const SHOW_DESKTOP_ICON_NAME = 'focus-windows-symbolic';
const FAVORITES_ICON_NAME = 'starred-symbolic';
const RECENT_APPS_ICON_NAME = 'document-open-recent-symbolic';

const LightStyleMode = GObject.registerClass(
    class LightStyleMode extends GObject.Object {
        _init() {
            super._init();

            this._savedColorScheme = Main.sessionMode.colorScheme;
            this._updateColorScheme('prefer-light');
        }

        _updateColorScheme(scheme) {
            Main.sessionMode.colorScheme = scheme;
            St.Settings.get().notify('color-scheme');
        }

        destroy() {
            this._updateColorScheme(this._savedColorScheme);
        }
    });

const PowerProfileIndicator = GObject.registerClass(
    class PowerProfileIndicator extends SystemIndicator {
        _init() {
            super._init();

            this._indicator = this._addIndicator();

            this._setIcon();
            this.get_parent()?.connectObject('notify::allocation', () => this._setIcon(), this);

            this.connect('scroll-event', (actor, event) => this._onScroll(event));
        }

        _setIcon() {
            if (this._toggle)
                return;

            Main.panel.statusArea.quickSettings.addExternalIndicator(this);
            this.get_parent()?.set_child_above_sibling(this, null);

            this._toggle = Main.panel.statusArea.quickSettings._powerProfiles?.quickSettingsItems[0];
            this._toggle?.bind_property('icon-name', this._indicator, 'icon-name', GObject.BindingFlags.SYNC_CREATE);
        }

        _setProfile(profile) {
            if (this._toggle?._proxy)
                this._toggle._proxy.ActiveProfile = profile;
        }

        _onScroll(event) {
            const activeProfile = this._toggle?._proxy?.ActiveProfile;
            const availableProfiles = this._toggle?._proxy?.Profiles?.map(p => p.Profile.unpack()).reverse();
            const activeProfileIndex = availableProfiles?.indexOf(activeProfile);

            let newProfile = activeProfile;

            switch (event?.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                    newProfile = availableProfiles[Math.max(activeProfileIndex - 1, 0)];
                    this._setProfile(newProfile);
                    break;
                case Clutter.ScrollDirection.DOWN:
                    newProfile = availableProfiles[Math.min(activeProfileIndex + 1, availableProfiles.length - 1)];
                    this._setProfile(newProfile);
                    break;
            }

            return Clutter.EVENT_STOP;
        }

        destroy() {
            this.get_parent()?.disconnectObject(this);

            this._indicator?.destroy();
            this._indicator = null;

            super.destroy();
        }
    });

const ShowDesktopButton = GObject.registerClass(
    class ShowDesktopButton extends PanelMenu.Button {
        _init() {
            super._init();

            this._makeButtonBox();

            this.connect('button-press-event', () => this._toggleAllWindows());

            if (!Main.panel.statusArea['showDesktopButton'])
                Main.panel.addToStatusArea('showDesktopButton', this, -1);
        }

        _makeButtonBox() {
            this._box = new St.BoxLayout();

            this._icon = new St.Icon({ icon_name: SHOW_DESKTOP_ICON_NAME, style_class: 'system-status-icon' });
            this._box.add_child(this._icon);

            this.add_child(this._box);
        }

        _toggleAllWindows() {
            const activeWorkspace = global.workspace_manager.get_active_workspace();
            const allWindows = activeWorkspace?.list_windows();
            const notAllWindowsMinimized = allWindows?.some(window => !window?.minimized);

            if (notAllWindowsMinimized) {
                for (const window of allWindows) {
                    if (!window?.minimized && window?.can_minimize())
                        window?.minimize();
                }
            } else {
                for (const window of allWindows) {
                    window?.unminimize();
                }
            }
        }
    });

const UserIdButton = GObject.registerClass(
    class UserIdButton extends SystemIndicator {
        _init() {
            super._init()

            this._indicator = this._addIndicator();

            const userId = new St.Label({ text: `${GLib.get_real_name()}  `, y_align: Clutter.ActorAlign.CENTER });
            this.add_child(userId);

            Main.panel.statusArea.quickSettings.addExternalIndicator(this);
        }

        destroy() {
            this._indicator?.destroy();
            this._indicator = null;

            super.destroy();
        }
    });

const FavoritesMenuButton = GObject.registerClass(
    class FavoritesMenuButton extends PanelMenu.Button {
        _init() {
            super._init(0.5);

            this._makeButtonBox();

            AppFavorites.getAppFavorites().connectObject('changed', () => this._updateFavorites(), this);
        }

        _makeButtonBox() {
            this._box = new St.BoxLayout();

            this._icon = new St.Icon({ icon_name: FAVORITES_ICON_NAME, style_class: 'system-status-icon' });
            this._box.add_child(this._icon);

            this.add_child(this._box);

            this._updateFavorites();
        }

        _updateFavorites() {
            this.menu?.removeAll();

            const favorites = AppFavorites.getAppFavorites().getFavorites() ?? [];

            for (const favorite of favorites) {
                const item = new PopupMenu.PopupImageMenuItem(favorite?.get_name(), favorite?.icon);
                this.menu?.addMenuItem(item);

                item.connect('activate', () => favorite?.activate());
            }
        }

        destroy() {
            this.menu?.removeAll();
            AppFavorites.getAppFavorites()?.disconnectObject(this);

            super.destroy();
        }
    });

const RecentAppsMenuButton = GObject.registerClass(
    class RecentAppsMenuButton extends PanelMenu.Button {
        _init(globalRecentApps) {
            super._init(0.5);

            this._globalRecentApps = globalRecentApps;

            this._makeButtonBox();
        }

        _makeButtonBox() {
            this._box = new St.BoxLayout();

            this._icon = new St.Icon({ icon_name: RECENT_APPS_ICON_NAME, style_class: 'system-status-icon' });
            this._box.add_child(this._icon);

            this.add_child(this._box);
        }

        _updateRecentApps() {
            this.menu?.removeAll();

            const recentApps = this._globalRecentApps.recentApps ?? [];

            for (const app of recentApps) {
                const item = new PopupMenu.PopupImageMenuItem(app?.get_name(), app?.icon);
                this.menu?.addMenuItem(item);

                item.connect('activate', () => app?.activate());
            }
        }

        destroy() {
            this.menu?.removeAll();

            super.destroy();
        }
    });

const WorkspacesBar = GObject.registerClass(
    class WorkspacesBar extends PanelMenu.Button {
        _init(settings) {
            super._init();
            this.reactive = false;

            this._settings = settings;

            const mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
            const isDynamicWorkspaces = mutterSettings?.get_boolean('dynamic-workspaces');

            this._box = new St.BoxLayout();

            if (!isDynamicWorkspaces && this._settings?.get_boolean('show-plus-minus'))
                this._makeControlsBox();

            this.add_child(this._box);

            if (!Main.panel.statusArea['workspacesBarButton'])
                Main.panel.addToStatusArea('workspacesBarButton', this, 0, 'left');
        }

        _makeControlsBox() {
            this._controlsBox = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
            this._controlsBox.add_style_class_name('plus-minus');

            this._plusLabel = new St.Label({ reactive: true, text: '+', });
            this._minusLabel = new St.Label({ reactive: true, text: '−', });

            this._controlsBox.add_child(this._plusLabel);
            this._controlsBox.add_child(this._minusLabel);

            this._plusLabel.connect('button-press-event', () => this._addWorkspace());
            this._minusLabel.connect('button-press-event', () => this._removeWorkspace());

            this._box.add_child(this._controlsBox);
        }

        _addWorkspace() {
            global.workspace_manager.append_new_workspace(false, global.get_current_time());
        }

        _removeWorkspace() {
            if (global.workspace_manager.n_workspaces > 1) {
                const activeWorkspace = global.workspace_manager.get_active_workspace();
                global.workspace_manager.remove_workspace(activeWorkspace, global.get_current_time());
            }
        }

        destroy() {
            this._box.destroy_all_children();

            super.destroy();
        }
    });

const WorkspaceButton = GObject.registerClass(
    class WorkspaceButton extends St.Bin {
        _init(workspace) {
            super._init({ reactive: true });

            this._workspace = workspace;

            const mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
            this._isDynamicWorkspaces = mutterSettings?.get_boolean('dynamic-workspaces');

            this._makeButtonBox();

            this._updateIndex();
            this._updateFocus();
            this._updateOpacity();

            this._connectSignals();
        }

        _connectSignals() {
            global.workspace_manager.connectObject(
                'active-workspace-changed', () => this._updateFocus(),
                'workspace-removed', () => this._onWorkspaceRemoved(),
                'notify::n-workspaces', () => this._onWorkspaceRemoved(),
                this);
            this._workspace?.connectObject(
                'notify::workspace-index', () => this._updateIndex(),
                'notify::n-windows', () => this._updateOpacity(),
                this);
            this.connect('button-press-event', (widget, event) => this._onClick(event));
        }

        _disconnectSignals() {
            global.workspace_manager.disconnectObject(this);
            this._workspace?.disconnectObject(this);
        }

        _makeButtonBox() {
            this._workspaceIndex = new St.Label({ reactive: true, track_hover: true, y_align: Clutter.ActorAlign.CENTER });
            this._workspaceIndex.add_style_class_name('workspace-button');

            this.add_child(this._workspaceIndex);
        }

        _onClick(event) {
            if (global.workspace_manager.get_active_workspace() === this._workspace)
                Main.overview.toggle();
            else if (this._workspace && this._isWorkspaceMapped())
                this._workspace.activate(global.get_current_time());

            return Clutter.EVENT_STOP;
        }

        _updateFocus() {
            if (this._workspace?.active) {
                this._workspaceIndex?.remove_style_class_name('workspace-button-inactive');
                this._workspaceIndex?.add_style_class_name('workspace-button-active');
            } else {
                this._workspaceIndex?.remove_style_class_name('workspace-button-active');
                this._workspaceIndex?.add_style_class_name('workspace-button-inactive');
            }

            this._updateOpacity();
        }

        _updateOpacity() {
            if (this._workspace?.n_windows === 0 && !this._workspace?.active && !this._isDynamicWorkspaces)
                this._workspaceIndex?.add_style_class_name('workspace-button-no-windows');
            else
                this._workspaceIndex?.remove_style_class_name('workspace-button-no-windows');
        }

        _updateIndex() {
            if (this._workspace && this._isWorkspaceMapped())
                this._workspaceIndex.text = String(this._workspace.index() + 1);
        }

        _isWorkspaceMapped() {
            const n_workspaces = global.workspace_manager.n_workspaces;

            for (let index = 0; index < n_workspaces; index++) {
                if (global.workspace_manager.get_workspace_by_index(index) === this._workspace)
                    return true;
            }

            return false;
        }

        _onWorkspaceRemoved() {
            if (!this._workspace || !this._isWorkspaceMapped())
                this.destroy();
        }

        destroy() {
            this._disconnectSignals();
            this.get_parent()?.remove_child(this);

            super.destroy();
        }
    });


const TaskBarButton = GObject.registerClass(
    class TaskBarButton extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, 'Tasks in Panel', true);

            this._settings = settings;
            this._dynamicTaskDisplay = this._settings?.get_boolean('dynamic-task-display');

            // This is the single top-level panel object exposed to GNOME and
            // panel-organizer extensions. Individual tasks live below it.
            // Keep the wrapper reactive so Clutter continues picking its
            // reactive descendants normally; the wrapper itself has no menu.
            this.reactive = true;
            this.can_focus = false;
            this.track_hover = false;
            this.add_style_class_name('tasks-container');

            this._box = new St.BoxLayout({
                x_expand: false,
                y_expand: true,
            });
            this.add_child(this._box);

            const side = this._settings?.get_boolean('center-tasks') ? 'center' : 'left';
            if (!Main.panel.statusArea['tasksInPanelTaskbar'])
                Main.panel.addToStatusArea('tasksInPanelTaskbar', this, 99, side);
        }

        addTask(task) {
            if (task && !task.get_parent()) {
                this._box.add_child(task);
                this.queueDynamicDisplayUpdate();
            }
        }

        queueDynamicDisplayUpdate() {
            if (!this._dynamicTaskDisplay || this._destroying || this._dynamicDisplayUpdateId)
                return;

            // Window/workspace changes can update several task actors in one
            // Shell iteration. Coalesce them so the taskbar only recomputes its
            // global display mode after all visibility changes have settled.
            this._dynamicDisplayUpdateId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._dynamicDisplayUpdateId = null;
                this._updateDynamicDisplay();
                return GLib.SOURCE_REMOVE;
            });
        }

        _updateDynamicDisplay() {
            if (!this._dynamicTaskDisplay || !this._box)
                return;

            const visibleTasks = this._box.get_children().filter(task => task.visible);
            const seenApps = new Set();
            let showTitles = false;

            for (const task of visibleTasks) {
                const appKey = task.getDynamicAppKey?.();

                if (seenApps.has(appKey)) {
                    showTitles = true;
                    break;
                }

                seenApps.add(appKey);
            }

            // Dynamic display is intentionally global. Once any visible app
            // needs window-level disambiguation, every visible task exposes its
            // title so the panel remains visually regular.
            for (const task of this._box.get_children())
                task.setDynamicTitleVisible?.(showTitles);
        }

        destroy() {
            this._destroying = true;

            if (this._dynamicDisplayUpdateId) {
                GLib.Source.remove(this._dynamicDisplayUpdateId);
                this._dynamicDisplayUpdateId = null;
            }

            this._box?.destroy_all_children();
            this._box = null;
            this._settings = null;

            super.destroy();
        }
    });

const TaskButton = GObject.registerClass(
    class TaskButton extends St.Button {
        _init(settings, globalRecentApps, taskBar, window) {
            super._init({
                reactive: true,
                can_focus: true,
                track_hover: true,
                style_class: 'panel-button task-source-button',
            });

            this._settings = settings;
            this._globalRecentApps = globalRecentApps;
            this._taskBar = taskBar;
            this._window = window;

            this._importSettings();

            this._makeButtonBox();

            this._taskBar?.addTask(this);

            // Populate the visible task first. Menu registration must never be
            // able to abort construction and leave a blank actor in the strip.
            this._updateApp();
            this._updateTitle();
            this._updateVisibility();

            this._registerMenu();
            this._connectSignals();
        }

        _importSettings() {
            this._showFocusedWindow = this._settings?.get_boolean('show-focused-window');
            this._hoverRaiseWindow = this._settings?.get_boolean('hover-raise-window');
            this._hoverDelay = this._settings?.get_int('hover-delay');
            this._undecoratedTaskButtons = this._settings?.get_boolean('undecorated-task-buttons');
            this._showActiveWorkspace = this._settings?.get_boolean('show-active-workspace');
            this._showPanelMonitorOnly = this._settings?.get_boolean('show-panel-monitor-only');
            this._dynamicTaskDisplay = this._settings?.get_boolean('dynamic-task-display');
            this._showWindowTitle = this._settings?.get_boolean('show-window-title');
            this._showWindowApp = this._settings?.get_boolean('show-window-app');
            this._showWindowIcon = this._settings?.get_boolean('show-window-icon');
            this._desaturateIcon = this._settings?.get_boolean('desaturate-icon');
            this._buttonWidth = this._settings?.get_int('button-width');
            this._groupWindows = this._settings?.get_boolean('group-windows');
            this._showRecentAppsMenu = this._settings?.get_boolean('show-recent-apps-menu');
            this._recentAppsListLength = this._settings?.get_int('recent-apps-list-length');
            this._animateOnClose = this._settings?.get_boolean('animate-on-close');
        }

        _connectSignals() {
            global.workspace_manager.connectObject('active-workspace-changed', () => this._updateVisibility(), this);
            global.display.connectObject('notify::focus-window', () => this._updateVisibility(), GObject.ConnectFlags.AFTER, this);
            Main.layoutManager.connectObject('monitors-changed', () => this._updateVisibility(), this);

            this._window?.connectObject(
                'notify::demands-attention', () => this._updateDemandsAttention(), GObject.ConnectFlags.AFTER,
                'notify::gtk-application-id', () => this._updateApp(), GObject.ConnectFlags.AFTER,
                'notify::skip-taskbar', () => this._updateVisibility(), GObject.ConnectFlags.AFTER,
                'notify::title', () => this._updateTitle(), GObject.ConnectFlags.AFTER,
                'notify::urgent', () => this._updateDemandsAttention(), GObject.ConnectFlags.AFTER,
                'notify::wm-class', () => this._updateApp(), GObject.ConnectFlags.AFTER,
                'position-changed', () => this._updateVisibility(), GObject.ConnectFlags.AFTER,
                'unmanaging', () => this._animatedDestroy(), GObject.ConnectFlags.AFTER,
                'workspace-changed', () => this._updateVisibility(), GObject.ConnectFlags.AFTER,
                this);

            this.connect('notify::hover', () => this._onHover());
            this.connect('button-release-event', (actor, event) => this._onClick(event));
        }

        _disconnectSignals() {
            global.workspace_manager.disconnectObject(this);
            global.display.disconnectObject(this);
            Main.layoutManager.disconnectObject(this);

            this._window?.disconnectObject(this);
            this._app?.disconnectObject(this);
        }

        _makeButtonBox() {
            this._box = new St.BoxLayout({ reactive: true, track_hover: true });
            if (!this._showFocusedWindow && !this._undecoratedTaskButtons)
                this._box.add_style_class_name('task-box');

            this._icon = new St.Icon({ fallback_gicon: null });
            this._box.add_child(this._icon);
            if (this._desaturateIcon) {
                const desaturate = new Clutter.DesaturateEffect();
                this._icon.add_effect(desaturate);
            }

            this._title = new St.Label({ style_class: 'task-label', y_align: Clutter.ActorAlign.CENTER });
            this._box.add_child(this._title);

            this._separator = new St.Label({ text: '—', style_class: 'task-label', y_align: Clutter.ActorAlign.CENTER });
            this._box.add_child(this._separator);

            this._appName = new St.Label({ style_class: 'task-label', y_align: Clutter.ActorAlign.CENTER });
            this._box.add_child(this._appName);

            this._applyTaskDisplay(false);
            this.set_child(this._box);

            // A task is deliberately an ordinary St.Button in the stable
            // container. AppMenu only requires a Clutter.Actor as its source;
            // it does not require the source actor itself to be a PanelMenu.Button.
            this.menu = new AppMenu(this);
        }

        getDynamicAppKey() {
            // Shell.App IDs are stable across windows of the same application.
            // Fall back to WM class, then the individual window object so an
            // unidentified window can never create a false duplicate-app match.
            return this._app?.get_id?.()
                ?? this._window?.wm_class
                ?? this._window;
        }

        setDynamicTitleVisible(showTitles) {
            if (!this._dynamicTaskDisplay)
                return;

            this._applyTaskDisplay(showTitles);
        }

        _applyTaskDisplay(showDynamicTitles) {
            const showTitles = this._dynamicTaskDisplay
                ? showDynamicTitles
                : this._showWindowTitle;

            // Dynamic mode owns the three presentation choices: icons are
            // always available as the compact representation, app-name labels
            // stay hidden, and window titles appear only when duplicate visible
            // app instances make them useful. Fixed mode preserves upstream
            // behavior and its existing appearance toggles.
            this._icon.visible = this._dynamicTaskDisplay ? true : this._showWindowIcon;
            this._title.visible = showTitles;
            this._separator.visible = this._dynamicTaskDisplay
                ? false
                : this._showWindowApp && this._showWindowTitle;
            this._appName.visible = this._dynamicTaskDisplay ? false : this._showWindowApp;

            if (showTitles && this._buttonWidth > -1)
                this._box.set_style(`-st-natural-width: 9999px; max-width: ${this._buttonWidth}px;`);
            else
                this._box.set_style(null);
        }

        _registerMenu() {
            try {
                Main.panel.menuManager?.addMenu(this.menu);
                this._menuRegistered = true;
            } catch (error) {
                // A context menu failure should not make the task itself vanish.
                this._menuRegistered = false;
                console.warn(`Tasks in Panel: could not register task menu: ${error}`);
            }
        }

        _toggleWindow() {
            this._windowOnTop = null;

            if (this._windowIsOnActiveWorkspace && this._windowHasFocus) {
                if (this._window?.can_minimize() && !Main.overview.visible)
                    this._window?.minimize();
            } else {
                this._window?.activate(global.get_current_time());
                this._window?.focus(global.get_current_time());
            }
            Main.overview.hide();
        }

        _onClick(event) {
            const button = event?.get_button();

            switch (button) {
                case Clutter.BUTTON_PRIMARY:
                    if (this._showFocusedWindow)
                        this.menu?.toggle();
                    else
                        this._toggleWindow();
                    return Clutter.EVENT_STOP;
                    break;
                case Clutter.BUTTON_SECONDARY:
                    this.menu?.toggle();
                    return Clutter.EVENT_STOP;
                    break;
                case Clutter.BUTTON_MIDDLE:
                    if (this._app?.can_open_new_window())
                        this._app?.open_new_window(-1);
                    Main.overview.hide();
                    return Clutter.EVENT_STOP;
                    break;
                default:
                    return Clutter.EVENT_PROPAGATE;
                    break;
            }
        }

        _onHover() {
            if (!this._hoverRaiseWindow || Main.overview.visible || !Main.wm._canScroll)
                return;

            if (this.hover) {
                const monitorIndex = this._window?.get_monitor();
                const monitorWindows = this._window?.get_workspace()?.list_windows().filter(w => w.get_monitor() === monitorIndex);
                this._windowOnTop = global.display.sort_windows_by_stacking(monitorWindows)?.at(-1);

                if (this._raiseWindowTimeout)
                    GLib.Source.remove(this._raiseWindowTimeout);

                this._raiseWindowTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._hoverDelay, () => {
                    if (this.hover)
                        this._window?.raise();

                    this._raiseWindowTimeout = null;
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                if (this._raiseWindowTimeout) {
                    GLib.Source.remove(this._raiseWindowTimeout);
                    this._raiseWindowTimeout = null;
                }

                this._windowOnTop?.raise();
            }
        }

        _updateApp() {
            if (this._window)
                this._app = Shell.WindowTracker.get_default().get_window_app(this._window);
            if (!this._app) {
                this._taskBar?.queueDynamicDisplayUpdate();
                return;
            }

            const wmClass = this._window?.wm_class;
            const icon = wmClass?.startsWith('chrome') ? Gio.Icon.new_for_string(wmClass) : this._app.icon;
            this._icon.set_gicon(icon);
            this._icon.set_icon_size(ICON_SIZE);

            this._appName.text = this._app.get_name() ?? '';

            this.menu.setApp(this._app);

            if (this._showRecentAppsMenu && this._app.app_info) {
                let recentApps = this._globalRecentApps.recentApps;
                recentApps = recentApps.filter(a => a !== this._app);
                recentApps.unshift(this._app);
                recentApps.length = Math.min(recentApps.length, this._recentAppsListLength ?? 8);
                this._globalRecentApps.recentApps = recentApps;
            }

            if (this._groupWindows)
                this._app.connectObject('windows-changed', () => this._updateVisibility(), this);

            this._taskBar?.queueDynamicDisplayUpdate();
        }

        _updateDemandsAttention() {
            if (this._showFocusedWindow || this._undecoratedTaskButtons)
                return;

            if (this._window?.demands_attention) {
                this._box.add_style_class_name('task-box-demands-attention');
                this.visible = true;
            } else {
                this._box.remove_style_class_name('task-box-demands-attention');
                this._updateVisibility();
            }
        }

        _updateFocus() {
            const focusWindow = global.display.focus_window;
            this._windowHasFocus = this._window?.appears_focused || focusWindow?.get_transient_for() === this._window;

            if (this._showFocusedWindow)
                return;

            const isFocused = this._windowIsOnActiveWorkspace && this._windowHasFocus;
            if (this._undecoratedTaskButtons)
                this._box.opacity = isFocused ? 255 : UNFOCUSED_TASK_BUTTON_OPACITY;
            else
                isFocused
                    ? this._box.add_style_class_name('task-box-focus')
                    : this._box.remove_style_class_name('task-box-focus');
        }

        _updateTitle() {
            this._title.text = this._window?.title ?? '';
        }

        _updateVisibility() {
            const activeWorkspace = global.workspace_manager.get_active_workspace();
            this._windowIsOnActiveWorkspace = this._window?.located_on_workspace(activeWorkspace);
            const onPanelMonitor = !this._showPanelMonitorOnly ||
                this._window?.get_monitor() === Main.layoutManager.primaryIndex;

            if (this._groupWindows) {
                const appWindows = (this._app?.get_windows() ?? []).filter(w =>
                    w.window_type !== Meta.WindowType.MODAL_DIALOG &&
                    (!this._showPanelMonitorOnly || w.get_monitor() === Main.layoutManager.primaryIndex));
                const appWindowsOnActiveWorkspace = appWindows?.filter(w => w.located_on_workspace(activeWorkspace));
                const candidateWindows = appWindowsOnActiveWorkspace?.length > 0 ? appWindowsOnActiveWorkspace : appWindows;
                const focusWindow = global.display.focus_window;
                const appWindowOnTop = focusWindow && candidateWindows?.includes(focusWindow)
                    ? focusWindow
                    : global.display.sort_windows_by_stacking(candidateWindows).at(-1);
                this._isAppWindowOnTop = this._window === appWindowOnTop || this._window?.get_transient_for() === appWindowOnTop;
            }

            this._updateFocus();

            this.visible = !this._window?.skip_taskbar
                && (!this._showActiveWorkspace || this._windowIsOnActiveWorkspace)
                && onPanelMonitor
                && (!this._showFocusedWindow || this._windowHasFocus)
                && (!this._groupWindows || this._isAppWindowOnTop);

            this._taskBar?.queueDynamicDisplayUpdate();
        }

        _animatedDestroy() {
            this._disconnectSignals();
            if (this._menuRegistered)
                Main.panel.menuManager?.removeMenu?.(this.menu);

            if (this._raiseWindowTimeout) {
                GLib.Source.remove(this._raiseWindowTimeout);
                this._raiseWindowTimeout = null;
            }

            if (this._animateOnClose) {
                this.opacity = 0;
                this._box.ease({
                    width: 0,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onStopped: () => {
                        this.menu?.destroy();
                        this.menu = null;
                        const taskBar = this._taskBar;
                        super.destroy();
                        taskBar?.queueDynamicDisplayUpdate();
                    },
                });
            } else {
                this.menu?.destroy();
                this.menu = null;
                const taskBar = this._taskBar;
                super.destroy();
                taskBar?.queueDynamicDisplayUpdate();
            }
        }

        destroy() {
            this._disconnectSignals();
            if (this._menuRegistered)
                Main.panel.menuManager?.removeMenu?.(this.menu);

            if (this._raiseWindowTimeout) {
                GLib.Source.remove(this._raiseWindowTimeout);
                this._raiseWindowTimeout = null;
            }

            this.menu?.destroy();
            this.menu = null;

            const taskBar = this._taskBar;
            super.destroy();
            taskBar?.queueDynamicDisplayUpdate();
        }
    });

const TasksInPanel = GObject.registerClass(
    class TasksInPanel extends GObject.Object {
        _init(settings) {
            super._init();

            this._settings = settings;

            this._showRecentAppsMenu = this._settings?.get_boolean('show-recent-apps-menu');

            this._initSettings();
            this._initTaskBar();
        }

        _connectSignals() {
            global.display.connectObject('window-created', (display, window) => this._makeTaskButton(window), this);

            if (this._settings?.get_boolean('scroll-panel'))
                Main.panel.connectObject('scroll-event', (actor, event) => Main.wm.handleWorkspaceScroll(event), this);
        }

        _disconnectSignals() {
            global.display.disconnectObject(this);
            global.workspace_manager.disconnectObject(this);

            Main.panel.disconnectObject(this);
        }

        _initSettings() {
            if (this._settings?.get_boolean('light-style'))
                this._lightStyleMode = new LightStyleMode();

            if (this._settings?.get_boolean('yaru-panel'))
                Main.panel.add_style_class_name('panel-yaru-like');

            if (this._settings?.get_boolean('accent-panel'))
                Main.panel.add_style_class_name('panel-accent');

            if (this._settings?.get_boolean('use-background-color')) {
                const style = `background-color: ${this._settings?.get_string('background-color')};`

                Main.panel.set_style(style);
                Main.panel.connectObject('style-changed', () => Main.panel.set_style(style), this);
            }

            if (this._settings?.get_boolean('show-user-id'))
                this._userIdButton = new UserIdButton();

            if (this._settings?.get_boolean('show-power-profile'))
                this._powerProfileIndicator = new PowerProfileIndicator();

            this._moveDate(this._settings?.get_boolean('move-date'));
            Main.panel._updatePanel();

            if (!this._settings?.get_boolean('show-activities'))
                Main.panel.statusArea.activities?.hide();

            if (this._settings?.get_boolean('show-favorites-menu'))
                this._initFavoritesMenu();

            if (this._settings?.get_boolean('show-recent-apps-menu'))
                this._initRecentAppsMenu();

            if (this._settings?.get_boolean('show-workspaces-bar'))
                this._initWorkspacesBar();

            if (this._settings?.get_boolean('show-show-desktop'))
                this._showDesktopButton = new ShowDesktopButton();
        }

        _initFavoritesMenu() {
            this._favoritesMenuButton = new FavoritesMenuButton();

            if (!Main.panel.statusArea['favoritesMenuButton'])
                Main.panel.addToStatusArea('favoritesMenuButton', this._favoritesMenuButton, 99, 'left');
        }

        _initRecentAppsMenu() {
            this._globalRecentApps = { recentApps: [] };

            this._recentAppsMenuButton = new RecentAppsMenuButton(this._globalRecentApps);

            if (!Main.panel.statusArea['recentAppsMenuButton'])
                Main.panel.addToStatusArea('recentAppsMenuButton', this._recentAppsMenuButton, 99, 'left');
        }

        _initTaskBar() {
            this._makeTaskBarTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._makeTaskbar();

                this._makeTaskBarTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _initWorkspacesBar() {
            this._makeWorkspacesBarTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._workspacesBar = new WorkspacesBar(this._settings);

                const workspacesNumber = global.workspace_manager.n_workspaces;

                for (let workspaceIndex = 0; workspaceIndex < workspacesNumber; workspaceIndex++) {
                    const workspace = global.workspace_manager.get_workspace_by_index(workspaceIndex);

                    this._makeWorkspaceButton(workspaceIndex);
                }

                global.workspace_manager.connectObject('workspace-added', (wm, index) => this._makeWorkspaceButton(index), this);

                this._makeWorkspacesBarTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _makeTaskbar() {
            if (!this._taskBarButton)
                this._taskBarButton = new TaskBarButton(this._settings);

            const workspacesNumber = global.workspace_manager.n_workspaces;

            for (let workspaceIndex = 0; workspaceIndex < workspacesNumber; workspaceIndex++) {
                const workspace = global.workspace_manager.get_workspace_by_index(workspaceIndex);
                const windowsList = workspace?.list_windows() ?? [];
                const windowsListSorted = global.display.sort_windows_by_stacking(windowsList);

                for (const window of windowsListSorted)
                    this._makeTaskButton(window);
            }

            this._connectSignals();
        }

        _makeWorkspaceButton(index) {
            const workspace = global.workspace_manager.get_workspace_by_index(index);
            if (!workspace || !this._workspacesBar || !this._workspacesBar._box)
                return;

            for (const bin of this._workspacesBar._box.get_children()) {
                if (workspace === bin?._workspace)
                    return;
            }

            this._workspacesBar._box.add_child(new WorkspaceButton(workspace));
        }

        _makeTaskButton(window) {
            if (!window || window.skip_taskbar || window.window_type === Meta.WindowType.MODAL_DIALOG)
                return;

            new TaskButton(this._settings, this._globalRecentApps, this._taskBarButton, window);

            if (this._showRecentAppsMenu) {
                if (this._recentAppsTimeout)
                    GLib.Source.remove(this._recentAppsTimeout);

                this._recentAppsTimeout = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this._recentAppsMenuButton._updateRecentApps();

                    this._recentAppsTimeout = null;
                    return GLib.SOURCE_REMOVE;
                });
            }
        }

        _moveDate(active) {
            const panel = Main.sessionMode.panel;

            if (active) {
                panel.center = panel.center.filter(item => item !== 'dateMenu');
                if (!panel.right.includes('dateMenu'))
                    panel.right.unshift('dateMenu');
            } else {
                panel.right = panel.right.filter(item => item !== 'dateMenu');
                panel.center.unshift('dateMenu');
            }
        }

        _destroyTaskbar() {
            if (this._makeTaskBarTimeout) {
                GLib.Source.remove(this._makeTaskBarTimeout);
                this._makeTaskBarTimeout = null;
            }

            this._taskBarButton?.destroy();
            this._taskBarButton = null;
        }

        _destroyWorkspacesBar() {
            if (this._makeWorkspacesBarTimeout) {
                GLib.Source.remove(this._makeWorkspacesBarTimeout);
                this._makeWorkspacesBarTimeout = null;
            }

            this._workspacesBar?.destroy();
            this._workspacesBar = null;
        }

        _destroyItems() {
            this._userIdButton?.destroy();
            this._userIdButton = null;

            this._powerProfileIndicator?.destroy();
            this._powerProfileIndicator = null;

            this._showDesktopButton?.destroy();
            this._showDesktopButton = null;

            this._favoritesMenuButton?.destroy();
            this._favoritesMenuButton = null;

            this._recentAppsMenuButton?.destroy();
            this._recentAppsMenuButton = null;

            this._destroyWorkspacesBar();
            this._destroyTaskbar();
        }

        destroy() {
            this._disconnectSignals();

            this._lightStyleMode?.destroy();
            this._lightStyleMode = null;

            Main.panel.remove_style_class_name('panel-yaru-like');
            Main.panel.remove_style_class_name('panel-accent');
            if (this._settings?.get_boolean('use-background-color'))
                Main.panel.set_style('background-color: black;');

            Main.panel.statusArea.activities?.show();
            this._moveDate(false);

            this._destroyItems();

            Main.panel._updatePanel();

            if (this._recentAppsTimeout) {
                GLib.Source.remove(this._recentAppsTimeout);
                this._recentAppsTimeout = null;
            }

            if (this._globalRecentApps) {
                this._globalRecentApps.recentApps = null;
                this._globalRecentApps = null;
            }
        }
    });

export default class TasksInPanelExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    _restart() {
        this.disable();
        this.enable();
    }

    enable() {
        this._settings = this.getSettings();
        this._settings?.connectObject('changed', () => this._restart(), this);

        this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
        this._mutterSettings?.connectObject('changed::dynamic-workspaces', () => this._restart(), this);

        this._tasksInPanel = new TasksInPanel(this._settings);
    }

    disable() {
        this._settings?.disconnectObject(this);
        this._settings = null;

        this._mutterSettings?.disconnectObject(this);
        this._mutterSettings = null;

        this._tasksInPanel?.destroy();
        this._tasksInPanel = null;
    }
}

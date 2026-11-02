import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class TasksInPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        /* Global */

        const pageGlobal = new Adw.PreferencesPage({
            title: 'Global',
            icon_name: 'view-list-symbolic',
        });
        window.add(pageGlobal);

        const groupGlobal = new Adw.PreferencesGroup();
        pageGlobal.add(groupGlobal);

        const lightStyle = new Adw.SwitchRow({
            title: 'Light style mode',
            subtitle: 'GNOME Shell items follow dark/light style toggle.',
        });
        groupGlobal.add(lightStyle);
        window._settings.bind('light-style', lightStyle, 'active', Gio.SettingsBindFlags.DEFAULT);

        const yaruPanel = new Adw.SwitchRow({
            title: 'Normal-weighted fonts',
        });
        groupGlobal.add(yaruPanel);
        window._settings.bind('yaru-panel', yaruPanel, 'active', Gio.SettingsBindFlags.DEFAULT);

        const accentPanel = new Adw.SwitchRow({
            title: 'Use accent color',
            subtitle: 'Background color is based on GNOME accent color.',
        });
        groupGlobal.add(accentPanel);
        window._settings.bind('accent-panel', accentPanel, 'active', Gio.SettingsBindFlags.DEFAULT);

        const useBackgroundColor = new Adw.SwitchRow({
            title: 'Use custom background color',
        });
        groupGlobal.add(useBackgroundColor);
        window._settings.bind('use-background-color', useBackgroundColor, 'active', Gio.SettingsBindFlags.DEFAULT);

        const backgroundColor = new Adw.ActionRow({
            title: 'Custom background color',
        });
        groupGlobal.add(backgroundColor);

        const colorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true,
        });

        const colorString = window._settings.get_string('background-color');
        const rgba = new Gdk.RGBA();
        rgba.parse(colorString);
        colorButton.set_rgba(rgba);

        colorButton.connect('color-set', () => {
            const newColor = colorButton.get_rgba();
            const colorString = newColor.to_string();
            window._settings.set_string('background-color', colorString);
        });

        backgroundColor.add_suffix(colorButton);
        backgroundColor.activatable_widget = colorButton;

        const scrollPanel = new Adw.SwitchRow({
            title: 'Scroll on panel to switch workspace',
        });
        groupGlobal.add(scrollPanel);
        window._settings.bind('scroll-panel', scrollPanel, 'active', Gio.SettingsBindFlags.DEFAULT);


        /* Indicators */

        const pageIndicators = new Adw.PreferencesPage({
            title: 'Indicators',
            icon_name: 'view-list-symbolic',
        });
        window.add(pageIndicators);

        const groupIndicators = new Adw.PreferencesGroup();
        pageIndicators.add(groupIndicators);

        const showPowerProfile = new Adw.SwitchRow({
            title: 'Show power profile indicator',
            subtitle: 'Scroll to change power profile.',
        });
        groupIndicators.add(showPowerProfile);
        window._settings.bind('show-power-profile', showPowerProfile, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showUserId = new Adw.SwitchRow({
            title: 'Show user name',
        });
        groupIndicators.add(showUserId);
        window._settings.bind('show-user-id', showUserId, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showShowDesktop = new Adw.SwitchRow({
            title: 'Show show desktop button',
            subtitle: 'Minimize all windows if at least one window is not minimized.\nUnminimize all windows if all windows are minimized.',
        });
        groupIndicators.add(showShowDesktop);
        window._settings.bind('show-show-desktop', showShowDesktop, 'active', Gio.SettingsBindFlags.DEFAULT);

        const moveDate = new Adw.SwitchRow({
            title: 'Move date menu button to the right',
        });
        groupIndicators.add(moveDate);
        window._settings.bind('move-date', moveDate, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showActivities = new Adw.SwitchRow({
            title: 'Show activities indicator',
        });
        groupIndicators.add(showActivities);
        window._settings.bind('show-activities', showActivities, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showWorkspacesBar = new Adw.SwitchRow({
            title: 'Show workspaces bar',
        });
        groupIndicators.add(showWorkspacesBar);
        window._settings.bind('show-workspaces-bar', showWorkspacesBar, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showPlusMinus = new Adw.SwitchRow({
            title: 'Show +/- to add/remove workspace',
            subtitle: 'Not displayed if dynamic workspaces GNOME setting is active.\nMinus removes the active workspace.',
        });
        groupIndicators.add(showPlusMinus);
        window._settings.bind('show-plus-minus', showPlusMinus, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showFavoritesMenu = new Adw.SwitchRow({
            title: 'Show favorites menu button',
        });
        groupIndicators.add(showFavoritesMenu);
        window._settings.bind('show-favorites-menu', showFavoritesMenu, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showRecentAppsMenu = new Adw.SwitchRow({
            title: 'Show recent applications menu button',
        });
        groupIndicators.add(showRecentAppsMenu);
        window._settings.bind('show-recent-apps-menu', showRecentAppsMenu, 'active', Gio.SettingsBindFlags.DEFAULT);

        const adjustmentRecentAppsListMaxLength = new Gtk.Adjustment({
            lower: 1,
            upper: 20,
            step_increment: 1,
        });

        const recentAppsListMaxLength = new Adw.SpinRow({
            title: 'Recent applications list maximum length',
            adjustment: adjustmentRecentAppsListMaxLength,
        });
        groupIndicators.add(recentAppsListMaxLength);
        window._settings.bind('recent-apps-list-length', recentAppsListMaxLength, 'value', Gio.SettingsBindFlags.DEFAULT);

        const centerTasks = new Adw.SwitchRow({
            title: 'Move tasks to the center',
            subtitle: 'Tasks are by default located at the left.',
        });
        groupIndicators.add(centerTasks);
        window._settings.bind('center-tasks', centerTasks, 'active', Gio.SettingsBindFlags.DEFAULT);


        /* Tasks */

        const pageTasks = new Adw.PreferencesPage({
            title: 'Tasks',
            icon_name: 'view-list-symbolic',
        });
        window.add(pageTasks);

        const groupTasks = new Adw.PreferencesGroup();
        pageTasks.add(groupTasks);

        const dynamicTaskDisplay = new Adw.SwitchRow({
            title: 'Dynamic task display',
            subtitle: 'Show icons only while visible tasks are separate apps.\nAdd all window titles when one app has multiple visible tasks.',
        });
        groupTasks.add(dynamicTaskDisplay);
        window._settings.bind('dynamic-task-display', dynamicTaskDisplay, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showWindowIcon = new Adw.SwitchRow({
            title: 'Show window icon',
        });
        groupTasks.add(showWindowIcon);
        window._settings.bind('show-window-icon', showWindowIcon, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showWindowTitle = new Adw.SwitchRow({
            title: 'Show window title',
        });
        groupTasks.add(showWindowTitle);
        window._settings.bind('show-window-title', showWindowTitle, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showAppName = new Adw.SwitchRow({
            title: 'Show application name',
        });
        groupTasks.add(showAppName);
        window._settings.bind('show-window-app', showAppName, 'active', Gio.SettingsBindFlags.DEFAULT);

        const updateFixedDisplaySensitivity = () => {
            const sensitive = !dynamicTaskDisplay.active;
            showWindowIcon.sensitive = sensitive;
            showWindowTitle.sensitive = sensitive;
            showAppName.sensitive = sensitive;
        };
        dynamicTaskDisplay.connect('notify::active', updateFixedDisplaySensitivity);
        updateFixedDisplaySensitivity();

        const showOnlyActiveWorkspace = new Adw.SwitchRow({
            title: 'Show on active workspace only',
        });
        groupTasks.add(showOnlyActiveWorkspace);
        window._settings.bind('show-active-workspace', showOnlyActiveWorkspace, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showPanelMonitorOnly = new Adw.SwitchRow({
            title: 'Show on panel monitor only',
            subtitle: 'Hide tasks for windows on other monitors. Works together with the active workspace filter.',
        });
        groupTasks.add(showPanelMonitorOnly);
        window._settings.bind('show-panel-monitor-only', showPanelMonitorOnly, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showFocusedWindow = new Adw.SwitchRow({
            title: 'Show focused window only',
            subtitle: 'Left-click does not toggle window, it opens app menu.',
        });
        groupTasks.add(showFocusedWindow);
        window._settings.bind('show-focused-window', showFocusedWindow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const groupWindows = new Adw.SwitchRow({
            title: 'Group by app',
            subtitle: 'Top app window is shown.\nOther windows can be accessed from the app menu.',
        });
        groupTasks.add(groupWindows);
        window._settings.bind('group-windows', groupWindows, 'active', Gio.SettingsBindFlags.DEFAULT);

        const hoverRaiseWindow = new Adw.SwitchRow({
            title: 'Raise window on hover',
        });
        groupTasks.add(hoverRaiseWindow);
        window._settings.bind('hover-raise-window', hoverRaiseWindow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const adjustmentRaiseWindowDelay = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 50,
        });

        const raiseWindowDelay = new Adw.SpinRow({
            title: 'Raise window on hover delay (ms)',
            adjustment: adjustmentRaiseWindowDelay,
        });
        groupTasks.add(raiseWindowDelay);
        window._settings.bind('hover-delay', raiseWindowDelay, 'value', Gio.SettingsBindFlags.DEFAULT);

        const undecoratedButton = new Adw.SwitchRow({
            title: 'Undecorated button',
            subtitle: 'Dim opacity if unfocused.',
        });
        groupTasks.add(undecoratedButton);
        window._settings.bind('undecorated-task-buttons', undecoratedButton, 'active', Gio.SettingsBindFlags.DEFAULT);

        const desaturateIcon = new Adw.SwitchRow({
            title: 'Monochrome icon',
            subtitle: 'Some apps do not have a symbolic icon, so simply monochrome here.',
        });
        groupTasks.add(desaturateIcon);
        window._settings.bind('desaturate-icon', desaturateIcon, 'active', Gio.SettingsBindFlags.DEFAULT);

        const adjustmentButtonWidth = new Gtk.Adjustment({
            lower: -1,
            upper: 999,
            step_increment: 10,
        });

        const buttonWidth = new Adw.SpinRow({
            title: 'Task button natural width (px)',
            subtitle: 'Will be reduced if the available width is insufficient.\nSet -1 for fitted width.',
            adjustment: adjustmentButtonWidth,
        });
        groupTasks.add(buttonWidth);
        window._settings.bind('button-width', buttonWidth, 'value', Gio.SettingsBindFlags.DEFAULT);

        const animateOnClose = new Adw.SwitchRow({
            title: 'Animate on close',
        });
        groupTasks.add(animateOnClose);
        window._settings.bind('animate-on-close', animateOnClose, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
}

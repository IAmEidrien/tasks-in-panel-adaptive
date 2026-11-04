/* Tasks in Panel Adaptive. GPLv3; see LICENSE. Maintained by Eidrien. */
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {migrate} from './settings.js';

export default class Preferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const s = this.getSettings();
        migrate(s, this);
        const signals = [];
        window.set_default_size(680, 740);
        const page = (title, icon) => {
            const p = new Adw.PreferencesPage({title, icon_name: icon}); window.add(p); return p;
        };
        const group = (p, title, description = '') => {
            const g = new Adw.PreferencesGroup({title, description}); p.add(g); return g;
        };
        const toggle = (g, key, title, subtitle = '') => {
            const row = new Adw.SwitchRow({title, subtitle}); g.add(row);
            s.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT); return row;
        };
        const combo = (g, key, title, values, labels) => {
            const row = new Adw.ComboRow({title, model: Gtk.StringList.new(labels),
                selected: Math.max(0, values.indexOf(s.get_string(key)))});
            row.connect('notify::selected', () => s.set_string(key, values[row.selected]));
            signals.push(s.connect(`changed::${key}`, () => {row.selected = Math.max(0, values.indexOf(s.get_string(key)));}));
            g.add(row); return row;
        };
        const spin = (g, key, title, subtitle, lower, upper, step) => {
            const row = new Adw.SpinRow({title, subtitle, digits: 0, numeric: true,
                adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 10})});
            s.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT); g.add(row); return row;
        };
        const container = page('Container', 'view-list-symbolic');
        const appearance = group(container, 'Appearance', 'Customize only the task container. The rest of the panel follows its own theme.');
        combo(appearance, 'container-position', 'Position', ['left', 'center', 'right'], ['Left', 'Center', 'Right']);
        combo(appearance, 'container-font-weight', 'Font weight', ['theme', 'normal', 'bold'], ['Follow theme', 'Normal', 'Bold']);
        const custom = toggle(appearance, 'container-custom-background', 'Custom background');
        const colorRow = new Adw.ActionRow({title: 'Background color'});
        const color = new Gtk.ColorButton({use_alpha: true, valign: Gtk.Align.CENTER});
        const syncColor = () => {
            const rgba = new Gdk.RGBA();
            if (rgba.parse(s.get_string('container-background-color'))) color.set_rgba(rgba);
        };
        syncColor();
        color.connect('color-set', () => s.set_string('container-background-color', color.get_rgba().to_string()));
        signals.push(s.connect('changed::container-background-color', syncColor));
        colorRow.add_suffix(color); colorRow.activatable_widget = color; appearance.add(colorRow);
        const interactions = group(container, 'Interaction');
        toggle(interactions, 'container-scroll', 'Scroll to switch windows', 'Cycle through the tasks represented in this container.');

        const tasks = page('Tasks', 'focus-windows-symbolic');
        const display = group(tasks, 'Display');
        const dynamic = toggle(display, 'dynamic-task-display', 'Dynamic task display',
            'Use icons for distinct applications; show every title when an application has multiple visible tasks.');
        const fixed = [toggle(display, 'show-window-icon', 'Show window icon'),
            toggle(display, 'show-window-title', 'Show window title'), toggle(display, 'show-window-app', 'Show application name')];
        toggle(display, 'desaturate-icon', 'Monochrome icons');
        spin(display, 'button-width', 'Maximum task width', 'Logical pixels. −1 means no configured maximum; short titles keep their natural width.', -1, 4096, 1);
        toggle(display, 'animate-on-close', 'Animate closing tasks');
        const visibility = group(tasks, 'Visibility');
        toggle(visibility, 'show-active-workspace', 'Show on active workspace only');
        toggle(visibility, 'show-panel-monitor-only', 'Show on panel monitor only');
        toggle(visibility, 'group-windows', 'Group by application', 'Show one representative task. Previews include the matching filtered windows.');
        toggle(visibility, 'show-focused-window', 'Show focused window only', 'Primary click opens its application menu.');
        const taskInteraction = group(tasks, 'Interaction');
        toggle(taskInteraction, 'middle-click-close', 'Close window on middle-click',
            'Close the represented window instead of opening another application window.');
        const hover = group(tasks, 'Hover');
        combo(hover, 'hover-action', 'Hover action', ['none', 'raise', 'preview'], ['None', 'Raise', 'Preview']);
        const delay = spin(hover, 'hover-delay', 'Hover delay', 'Milliseconds before raising a window or showing previews.', 0, 2000, 10);
        const previewHeight = spin(hover, 'preview-height', 'Preview height',
            'Maximum thumbnail height in logical pixels. Limited to fit the screen.', 80, 320, 10);
        const sync = () => {
            for (const row of fixed) row.visible = !dynamic.active;
            colorRow.visible = custom.active;
            delay.visible = s.get_string('hover-action') !== 'none';
            previewHeight.visible = s.get_string('hover-action') === 'preview';
        };
        dynamic.connect('notify::active', sync); custom.connect('notify::active', sync);
        signals.push(s.connect('changed::hover-action', sync));
        sync();
        window.connect('close-request', () => {for (const id of signals) s.disconnect(id); return false;});
    }
}

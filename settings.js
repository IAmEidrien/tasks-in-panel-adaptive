// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
import Gio from 'gi://Gio';

export function migrate(settings, extension) {
    if (settings.get_boolean('migration-complete')) return;
    const source = Gio.SettingsSchemaSource.new_from_directory(`${extension.path}/schemas`,
        Gio.SettingsSchemaSource.get_default(), false);
    const schema = source.lookup('org.gnome.shell.extensions.tasks-in-panel', false);
    if (schema) {
        const old = new Gio.Settings({settings_schema: schema});
        for (const key of schema.list_keys()) {
            const value = old.get_user_value(key);
            if (!value) continue;
            if (key === 'center-tasks') {
                if (settings.get_user_value('container-position') === null)
                    settings.set_string('container-position', value.get_boolean() ? 'center' : 'left');
            } else if (key === 'hover-raise-window') {
                if (settings.get_user_value('hover-action') === null)
                    settings.set_string('hover-action', value.get_boolean() ? 'raise' : 'none');
            } else if (settings.settings_schema.has_key(key) && settings.get_user_value(key) === null) {
                // Values outside new bounds should not block first enable.
                if (settings.settings_schema.get_key(key).range_check(value)) settings.set_value(key, value);
            }
        }
    }
    settings.set_boolean('migration-complete', true);
}

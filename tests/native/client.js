import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
const app = new Gtk.Application({application_id: ARGV[0], flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', () => {
    const window = new Gtk.ApplicationWindow({application: app, title: ARGV[1], default_width: 420, default_height: 260});
    window.set_child(new Gtk.Label({label: ARGV[1]}));
    window.present();
});
app.run([]);

// Native GTK4 tests run against an extracted installation ZIP.
import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';
const root=ARGV[0], output=ARGV[1];
const {bindPageIcons}=await import(Gio.File.new_for_path(`${root}/preferenceIcons.js`).get_uri());
const wait=ms=>new Promise(resolve=>GLib.timeout_add(0,ms,()=>{resolve();return false;}));
const check=(ok,label)=>{if(!ok)throw Error(label);print(`PASS ${label}`);};
let failed=false;
const app=new Adw.Application({application_id:'local.eidrien.TipIconTest'});
app.connect('activate',()=>{app.hold();(async()=>{
 const theme=Gtk.IconTheme.get_for_display(Gdk.Display.get_default()), settings=Gtk.Settings.get_default();
 const paths=theme.get_search_path(), original=settings.gtk_icon_theme_name;
 const create=()=>{
  const w=new Adw.PreferencesWindow({application:app,default_width:450,default_height:300});
  const container=new Adw.PreferencesPage({title:'Container'}), tasks=new Adw.PreferencesPage({title:'Tasks'});
  w.add(container);w.add(tasks);
  bindPageIcons(w,Gio.File.new_for_path(root),[[container,'focus-top-bar-symbolic','tip-a-container-symbolic'],[tasks,'view-dual-symbolic','tip-a-tasks-symbolic']]);
  w.present();return {w,container,tasks};
 };
 let view=create();await wait(200);
 const verify=()=>{
  for(const [page,preferred,fallback] of [[view.container,'focus-top-bar-symbolic','tip-a-container-symbolic'],[view.tasks,'view-dual-symbolic','tip-a-tasks-symbolic']]) {
   check(page.icon_name===(theme.has_icon(preferred)?preferred:fallback),`theme preference: ${page.title}`);
   const icon=theme.lookup_icon(page.icon_name,null,16,Number(GLib.getenv('GDK_SCALE')||1),Gtk.TextDirection.LTR,Gtk.IconLookupFlags.FORCE_SYMBOLIC);
   check(icon instanceof Gtk.SymbolicPaintable &&icon.get_icon_name()!=='image-missing',`symbolic icon resolved: ${page.title}`);
  }
 };
 for(const name of ['Adwaita','Papirus']) {
  const available=paths.some(p=>Gio.File.new_for_path(`${p}/${name}/index.theme`).query_exists(null));
  if(!available){print(`UNAVAILABLE theme ${name}`);continue;}
  settings.gtk_icon_theme_name=name;await wait(200);verify();
 }
 // Two controlled native themes guarantee both lookup paths independently of
 // which optional icon names a distribution happens to ship.
 const fixture=`${output}/themes`, scalable=`${fixture}/TipSystem/scalable/actions`;
 GLib.mkdir_with_parents(scalable,0o755);
 GLib.file_set_contents(`${fixture}/TipSystem/index.theme`,'[Icon Theme]\nName=Test system icons\nDirectories=scalable/actions\n[scalable/actions]\nSize=16\nType=Scalable\nMinSize=8\nMaxSize=512\nContext=Actions\n');
 for(const [source,target] of [['container','focus-top-bar'],['tasks','view-dual']])
  Gio.File.new_for_path(`${root}/icons/hicolor/scalable/actions/tip-a-${source}-symbolic.svg`).copy(Gio.File.new_for_path(`${scalable}/${target}-symbolic.svg`),Gio.FileCopyFlags.OVERWRITE,null,null);
 theme.set_search_path([fixture,`${root}/icons`]);settings.gtk_icon_theme_name='TipSystem';await wait(200);verify();
 check(view.container.icon_name==='focus-top-bar-symbolic'&&view.tasks.icon_name==='view-dual-symbolic','preferred system path');
 settings.gtk_icon_theme_name='TipAbsent';await wait(200);verify();
 check(view.container.icon_name==='tip-a-container-symbolic'&&view.tasks.icon_name==='tip-a-tasks-symbolic','bundled fallback path after live theme change');
 for(const scheme of [Adw.ColorScheme.FORCE_LIGHT,Adw.ColorScheme.FORCE_DARK]) {
  Adw.StyleManager.get_default().set_color_scheme(scheme);await wait(200);
  const box=new Gtk.Box({spacing:16,margin_start:16,margin_end:16,margin_top:16,margin_bottom:16});
  for(const name of [view.container.icon_name,view.tasks.icon_name])box.append(new Gtk.Image({icon_name:name,pixel_size:32}));
  const renderWindow=new Gtk.Window({application:app,child:box});renderWindow.present();await wait(200);
  const scale=Number(GLib.getenv('GDK_SCALE')||1);
  check(renderWindow.get_scale_factor()===scale,'native GTK scale factor');
  const snapshot=new Gtk.Snapshot();snapshot.scale(scale,scale);Gtk.WidgetPaintable.new(box).snapshot(snapshot,box.get_width(),box.get_height());
  const texture=renderWindow.get_native().get_renderer().render_texture(snapshot.to_node(),null);
  texture.save_to_png(`${output}/${scheme===Adw.ColorScheme.FORCE_LIGHT?'light':'dark'}-${GLib.getenv('GDK_SCALE')||1}.png`);
  check(texture.get_width()>0,'native symbolic rendering');renderWindow.close();
 }
 view.w.close();await wait(100);settings.gtk_icon_theme_name='TipSystem';await wait(100);
 check(view.container.icon_name==='tip-a-container-symbolic','closed window disconnects theme listener');
 view=create();await wait(100);verify();
 check(theme.get_search_path().filter(p=>p===`${root}/icons`).length===1,'reopening does not duplicate registration');view.w.close();
 theme.set_search_path(paths);settings.gtk_icon_theme_name=original;
 app.release();app.quit();
 })().catch(e=>{logError(e);failed=true;app.release();app.quit();});});
await app.runAsync([]);
if(failed)System.exit(1);

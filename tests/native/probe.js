import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
const root = GLib.getenv('REVIEW_ROOT'), uuid='tasks-in-panel-adaptive@eidrien.local';
const wait = ms => new Promise(resolve => GLib.timeout_add(0, ms, () => {resolve(); return false;}));
export default class Probe extends Extension {
    enable() {GLib.timeout_add(0, 2000, () => {this.run().catch(e => GLib.file_set_contents(`${root}/result.json`, JSON.stringify({error: String(e), stack: e.stack}))); return false;});}
    disable() {}
    async run() {
        const checks=[];
        const check=(ok,label)=>{if(!ok)throw Error(label); checks.push(label); GLib.file_set_contents(`${root}/progress.json`,JSON.stringify(checks));};
        const screenshot=async name=>{const stream=Gio.File.new_for_path(`${root}/${name}.png`).replace(null,false,Gio.FileCreateFlags.NONE,null);await new Shell.Screenshot().screenshot(false,stream);stream.close(null);};
        for(let n=0;n<300&&Main.layoutManager._startingUp;n++)await wait(100);
        Main.overview.hide();
        await wait(1500);
        const uiScale=Number(GLib.getenv('TEST_UI_SCALE')||'1');
        St.ThemeContext.get_for_stage(global.stage).scale_factor=uiScale;
        const cs=Clutter.Settings.get_default?.()??global.stage.get_context().get_settings();
        cs.font_dpi=96*1024*uiScale;
        const themeVariant=GLib.getenv('TEST_THEME');
        if(themeVariant) {
            const bytes=Gio.resources_lookup_data(`/org/gnome/shell/theme/gnome-shell-${themeVariant}.css`,0);
            GLib.file_set_contents(`${root}/test-theme.css`,bytes.toArray());
            Main.setThemeStylesheet(`${root}/test-theme.css`);Main.loadTheme();
        }
        if(GLib.getenv('TEST_TEXT_SCALE'))new Gio.Settings({schema_id:'org.gnome.desktop.interface'}).set_double('text-scaling-factor',Number(GLib.getenv('TEST_TEXT_SCALE')));
        await wait(300);
        const panelStyle=Main.panel.style, panelClasses=Main.panel.style_class;
        const dateParent=Main.panel.statusArea.dateMenu.container.get_parent();
        const statusKeys=Object.keys(Main.panel.statusArea);
        Main.extensionManager.enableExtension(uuid);
        for(let n=0;n<100&&Main.extensionManager.lookup(uuid)?.state!==1;n++)await wait(100);
        const info=Main.extensionManager.lookup(uuid);
        check(info.state===1,`enabled: ${info.error}`);
        const ext=info.stateObj, bar=ext._bar, s=ext.settings;
        check(s.get_boolean('container-fill-space'),'fill is enabled by default');
        s.set_boolean('container-fill-space',true);await wait(200);
        check(!bar.reactive&&!bar.track_hover&&bar.opacity===0&&bar.visible,'empty container is transparent and non-interactive without hiding actor');
        check(bar.scroll({get_scroll_direction(){throw Error('empty scroll read');}})===Clutter.EVENT_PROPAGATE,'empty scrolling returns before inspecting input');
        check(bar.tasks.size===0&&bar.get_width()>40,'empty task list retains filled region');
        s.set_boolean('container-fill-space',false);await wait(150);
        if(GLib.getenv('TEST_POPUP_STRESS')) {
            GLib.file_set_contents(`${root}/popup-stress.css`,'.popup-menu-boxpointer .popup-menu-content StButton { background-color: transparent; border: 0 solid transparent; border-radius: 0; padding: 0; } .popup-menu-content { border-radius: 24px; }');
            St.ThemeContext.get_for_stage(global.stage).get_theme().load_stylesheet(Gio.File.new_for_path(`${root}/popup-stress.css`));
        }
        const scale=St.ThemeContext.get_for_stage(global.stage).scale_factor;
        for(const [app,title] of [['A','TIP A1'],['A','TIP A2 — '+ 'a long window title for testing maximum width and ellipsization '.repeat(12)],['B','TIP B1']]) {
            Gio.Subprocess.new(['gjs','-m',`${root}/client.js`,`org.eidrien.TipTest${app}`,title],Gio.SubprocessFlags.NONE);
            await wait(550);
        }
        for(let n=0;n<25&&bar.tasks.size<3;n++)await wait(200);
        check(bar.tasks.size===3,'tracked three real windows');
        Main.overview.hide();
        for(let n=0;n<40&&(Main.overview.visible||[...bar.tasks.keys()].some(w=>w.get_frame_rect().width<=0));n++)await wait(100);
        await wait(600);
        const shown=()=>bar.box.get_children().filter(t=>t.visible&&!t.closing);
        check(shown().length===3,'three tasks visible');
        check(bar.opacity===255&&bar.reactive&&bar.track_hover,'tasks restore visible interactive container');
        if (GLib.getenv('TEST_SUITE') === 'crowding') {
            const {run} = await import('./crowding.js');
            await run({bar, settings:s, check, wait, screenshot, root, scale});
            Main.extensionManager.disableExtension(uuid); await wait(150);
            check(!bar.layoutLater && !bar.revealPaintSignal && !bar.refreshTimer && !bar.metrics && !bar.displayed && bar.suppressed.size===0, 'disable clears layout callbacks and candidate/window references');
            Main.extensionManager.enableExtension(uuid); await wait(250);
            const rebuilt=Main.extensionManager.lookup(uuid).stateObj._bar;
            check(rebuilt!==bar&&rebuilt.hasTasks&&rebuilt.view.hadjustment.value===0,'re-enable creates a clean functional viewport');
            Main.extensionManager.disableExtension(uuid); await wait(100);
            GLib.file_set_contents(`${root}/result.json`,JSON.stringify({pass:true,shell:Config.PACKAGE_VERSION,scale,suite:'crowding',checks}));
            return;
        }
        s.set_int('button-width',120);
        s.set_boolean('container-fill-space',true);await wait(300);
        const region=actor=>actor.get_allocation_box();
        check(region(Main.panel._leftBox).x2<=region(Main.panel._centerBox).x1+1,'fill preserves centered widgets');
        await screenshot('filled-to-clock');
        const date=Main.panel.statusArea.dateMenu.container, dateIndex=Main.panel._centerBox.get_children().indexOf(date);
        Main.panel._centerBox.remove_child(date);Main.panel._rightBox.insert_child_at_index(date,0);await wait(300);
        check(Math.abs(region(Main.panel._leftBox).x2-region(Main.panel._rightBox).x1)<=1,'empty center lets left container reach system widgets');
        const filledWidth=bar.get_width();
        s.set_boolean('show-focused-window',true);await wait(250);
        check(Math.abs(bar.get_width()-filledWidth)<=1,'task presentation changes preserve filled container width');
        s.set_boolean('show-focused-window',false);
        for(const position of ['right','center','left']) {s.set_string('container-position',position);await wait(200);check(bar.get_width()>0,'fill supports '+position+' placement');}
        // Restore the clock to center before checking the right-side boundary.
        Main.panel._rightBox.remove_child(date);Main.panel._centerBox.insert_child_at_index(date,dateIndex);
        s.set_string('container-position','right');await wait(250);
        const centerEnd=region(Main.panel._centerBox).x2;
        check(region(Main.panel._rightBox).x1>=centerEnd-1,'right fill does not overlap centered clock');
        const rightWidth=bar.get_width();
        s.set_boolean('show-focused-window',true);await wait(200);
        check(Math.abs(bar.get_width()-rightWidth)<=1,'right fill stays stable across task presentation changes');
        s.set_boolean('show-focused-window',false);
        s.set_boolean('show-active-workspace',true);
        const originalWorkspace=global.workspace_manager.get_active_workspace();
        global.workspace_manager.get_workspace_by_index(1).activate(global.get_current_time());await wait(350);
        check(!bar.hasTasks&&bar.opacity===0&&!bar.reactive&&Math.abs(bar.get_width()-rightWidth)<=1,'empty workspace hides right container without losing allocation');
        originalWorkspace.activate(global.get_current_time());await wait(350);
        check(bar.hasTasks&&bar.reactive&&bar.opacity===255,'returning workspace restores right container');
        s.set_string('container-position','left');await wait(200);

        s.set_boolean('container-fill-space',false);await wait(200);
        check(bar.fillParent===null&&!bar.container.x_expand,'turning fill off releases allocation constraint');
        s.set_int('button-width',-1);await wait(200);

        const inCreationOrder=()=>{const seq=bar.box.get_children().filter(t=>!t.closing).map(t=>t.window.get_stable_sequence());return seq.every((v,i)=>i===0||seq[i-1]<v);};
        check(bar.overviewOrder.size>0||inCreationOrder(),'creation-order fallback before an overview layout is available');
        check(s.get_boolean('middle-click-close'),'middle click defaults to closing windows');
        s.set_boolean('middle-click-close',false);
        check(!bar.has_style_class_name('panel-button'),'outer container has no panel-button styling');
        check(Object.keys(Main.panel.statusArea).filter(k=>!statusKeys.includes(k)).length===1,'one status-area container only');
        check(shown().filter(t=>t.window.title.startsWith('TIP A')).every(t=>t.titleLabel.visible)&&!shown().find(t=>t.window.title==='TIP B1').titleLabel.visible,'adaptive titles distinguish ambiguous icons only');
        const a1=shown().find(t=>t.window.title==='TIP A1'), a2=shown().find(t=>t.window.title.startsWith('TIP A2')), b=shown().find(t=>t.window.title==='TIP B1');
        s.set_int('button-width',120);await wait(250);
        GLib.file_set_contents(`${root}/max-widths.json`,JSON.stringify(shown().map(t=>({title:t.window.title,size:t.get_transformed_size(),preferred:t.get_preferred_width(-1),box:t.box.get_preferred_width(-1),style:t.style}))));
        check(shown().every(t=>t.get_transformed_size()[0]<=120*scale+2),'maximum width enforced');
        s.set_int('button-width',-1);await wait(150);
        GLib.file_set_contents(`${root}/widths.json`,JSON.stringify(shown().map(t=>({title:t.window.title,text:t.titleLabel.text,size:t.get_transformed_size(),preferred:t.get_preferred_width(-1),style:t.style}))));
        check(bar.metrics.find(m=>m.id===a1).natural<bar.metrics.find(m=>m.id===a2).natural,'unlimited candidates preserve distinct natural title widths before crowding');
        check(bar.tasks.get(a1.window)===a1,'settings retain task actors');
        check(bar.overviewOrder.size>0||inCreationOrder(),'settings preserve creation-order fallback when no overview exists');
        const backend=Clutter.get_default_backend?.()??global.stage.get_context().get_backend();
        const pointer=backend.get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        const move=(x,y)=>pointer.notify_absolute_motion(GLib.get_monotonic_time(),x,y);
        const hover=async actor=>{const [x,y]=actor.get_transformed_position(),[w,h]=actor.get_transformed_size();move(x+w/2,y+h/2);await wait(600);};
        const click=async()=>{pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_PRIMARY,Clutter.ButtonState.PRESSED);await wait(50);pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_PRIMARY,Clutter.ButtonState.RELEASED);await wait(200);};
        Main.activateWindow(b.window);await wait(300);
        const focusBeforeHover=global.display.focus_window;
        move(800,500);await wait(250);Main.overview.hide();await wait(500);await hover(a1);
        GLib.file_set_contents(`${root}/hover-state.json`,JSON.stringify({hover:a1.hover,preview:bar.preview.visible,menu:a1.menu.isOpen,pointer:global.get_pointer(),taskPos:a1.get_transformed_position(),taskSize:a1.get_transformed_size(),options:bar.options,overview:Main.overview.visible,starting:Main.layoutManager._startingUp,focus:global.display.focus_window?.title,shown:Main.overview._shown,animating:Main.overview._animationInProgress}));
        await screenshot('hover-state');
        check(a1.hover&&bar.preview.visible,'real pointer opens preview after delay');
        const beforePreviewOrder=shown().map(t=>t.window);
        const hoverColor=a1.get_theme_node().get_background_color();
        check(!a1.get_theme_node().get_box_shadow(),'task hover has no native inset fill');
        check(hoverColor.red===127&&hoverColor.green===127&&hoverColor.alpha<=32,'task hover uses restrained neutral tint over panel theme');
        const previewWindow=a1.window;
        check(global.display.focus_window===focusBeforeHover,'preview does not focus source window');
        await screenshot('preview');
        await hover(bar.preview.pointer);
        check(bar.preview.visible,'pointer can enter preview without closing');
        const [px,py]=bar.preview.pointer.get_transformed_position(),[pw,ph]=bar.preview.pointer.get_transformed_size();
        const monitor=Main.layoutManager.findMonitorForActor(a1);
        check(px>=monitor.x-1&&px+pw<=monitor.x+monitor.width+1&&py>=monitor.y-1&&py+ph<=monitor.y+monitor.height+1,'preview stays on monitor');
        const body=bar.preview.cards.get_first_child().get_last_child();await hover(body);await click();
        GLib.file_set_contents(`${root}/click-state.json`,JSON.stringify({focus:global.display.focus_window?.title,expected:previewWindow.title,preview:bar.preview.visible,pointer:global.get_pointer(),overview:Main.overview.visible}));
        check(global.display.focus_window===previewWindow&&!bar.preview.visible,'preview click activates real window');
        check(shown().every((t,i)=>t.window===beforePreviewOrder[i]),'focus changes retain the current overview snapshot');
        s.set_string('hover-action','none');await wait(150);move(800,500);await wait(200);await hover(b);
        check(!bar.preview.visible,'None disables hover');
        const beforeRaise=global.display.focus_window;
        s.set_string('hover-action','raise');await wait(100);move(700,450);await wait(200);await hover(b);
        check(global.display.sort_windows_by_stacking([...bar.tasks.keys()]).at(-1)===b.window&&global.display.focus_window===beforeRaise,'Raise changes stacking without focus');
        move(700,450);await wait(250);check(global.display.sort_windows_by_stacking([...bar.tasks.keys()]).at(-1)===beforeRaise,'Raise restores previous stacking');
        s.set_string('hover-action','none');await wait(100);await hover(b);
        pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_SECONDARY,Clutter.ButtonState.PRESSED);await wait(50);pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_SECONDARY,Clutter.ButtonState.RELEASED);await wait(200);
        check(b.menu.isOpen,'real secondary click opens native application menu');b.menu.close();await wait(250);
        const keyboard=backend.get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        Main.activateWindow(a1.window);await wait(150);
        const keyGrab=Main.pushModal(b,{actionMode:Shell.ActionMode.POPUP});
        b.grab_key_focus();await wait(100);keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_space,Clutter.KeyState.PRESSED);await wait(60);keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_space,Clutter.KeyState.RELEASED);await wait(250);
        Main.popModal(keyGrab);await wait(150);
        check(global.display.focus_window===b.window&&!b.menu.isOpen,'keyboard activates task rather than menu');
        s.set_string('hover-action','preview');await wait(100);move(700,450);await wait(100);await hover(a1);
        const beforeEscape=global.display.focus_window;
        const escapeGrab=Main.pushModal(a1,{actionMode:Shell.ActionMode.POPUP});a1.grab_key_focus();
        keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_Escape,Clutter.KeyState.PRESSED);await wait(50);keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_Escape,Clutter.KeyState.RELEASED);await wait(100);
        Main.popModal(escapeGrab);await wait(150);
        check(!bar.preview.visible&&global.display.focus_window===beforeEscape,'Escape from panel navigation dismisses preview');
        s.set_boolean('group-windows',true);s.set_string('hover-action','preview');await wait(200);
        check(shown().length===2&&shown().every(t=>!t.titleLabel.visible),'grouping uses compact representatives');
        const grouped=shown().find(t=>t.app.get_id().includes('TestA'));move(800,500);await wait(200);await hover(grouped);
        check(bar.preview.cards.get_n_children()===2,'group preview includes both matching windows');
        check(grouped.get_transformed_size()[0]>=44*scale,'icon-only tasks have a comfortable target');
        await screenshot('grouped-geometry');
        GLib.file_set_contents(`${root}/geometry.json`,JSON.stringify(bar.preview.cards.get_children().map(c=>({card:c.get_transformed_size(),header:c.get_first_child().get_transformed_size(),title:c.get_first_child().get_first_child().get_transformed_size(),close:c.get_first_child().get_last_child().get_transformed_size()}))));
        for(const card of bar.preview.cards.get_children()) {
            const header=card.get_first_child(),title=header.get_first_child(),close=header.get_last_child();
            check(title.get_child().get_theme_node().get_font().get_weight()===grouped.titleLabel.get_theme_node().get_font().get_weight(),'preview title follows resolved task font weight');
            const thumbnail=card.get_last_child().get_child();
            const mask=thumbnail.get_effect('tip-rounded-clip');
            check(!!mask&&mask.radius===12*scale,'live thumbnail has a prominent 12px rounded mask');
            const imageButton=card.get_last_child(),node=imageButton.get_theme_node();
            check(node.get_horizontal_padding()>=16*scale&&node.get_vertical_padding()>=10*scale,'thumbnail retains side/bottom insets with a tighter top gap');
            const closeNode=close.get_theme_node();
            check(closeNode.get_background_color().alpha>=40&&closeNode.get_border_width(St.Side.TOP)>=scale,'close button keeps a visible background and outline');
            const [cw,ch]=close.get_transformed_size();
            check(cw>=24*scale&&ch>=20*scale,'preview close button retains a usable target');
            check(cw/ch>=1.25&&cw/ch<=1.65,'preview close button keeps 3:2 shape');
            check(title.get_transformed_size()[0]<=200*scale&&card.get_transformed_size()[0]<=256*scale,'preview titles stay within compact cards');
        }
        await screenshot('grouped-preview');
        for(const weight of ['normal','bold']) {
            s.set_string('container-font-weight',weight);await wait(150);bar.preview.open(grouped,bar.previewWindows(grouped));await wait(150);
            const label=bar.preview.cards.get_first_child().get_first_child().get_first_child().get_child();
            check(label.get_theme_node().get_font().get_weight()===(weight==='bold'?700:400),'preview title respects '+weight+' override');
        }
        s.set_string('container-font-weight','theme');await wait(150);
        for(const height of [80,320]) {
            s.set_int('preview-height',height);await wait(150);bar.preview.open(grouped,bar.previewWindows(grouped));await wait(200);
            const card=bar.preview.cards.get_first_child();
            const expectedWidth=Math.min(height,monitor.height/scale*0.4)*1.5;
            check(Math.abs(card.get_transformed_size()[0]-Math.min(expectedWidth,monitor.width/scale*0.65)*scale)<3,'preview size follows height '+height);
            const [x,y]=bar.preview.pointer.get_transformed_position(),[w,h]=bar.preview.pointer.get_transformed_size();
            check(x>=monitor.x-1&&x+w<=monitor.x+monitor.width+1&&y>=monitor.y-1&&y+h<=monitor.y+monitor.height+1,'resized grouped previews fit screen');
            await screenshot('preview-height-'+height);
        }
        s.set_int('preview-height',160);await wait(150);
        bar.preview.close();s.set_boolean('group-windows',false);await wait(200);
        const vshell=Main.extensionManager.lookup('vertical-workspaces@G-dH.github.com');
        const modes=GLib.getenv('TEST_VSHELL') ? [2,1,0] : [null];
        for(const mode of modes) {
            if(mode!==null) {check(vshell?.state===1,'V-Shell enabled');vshell.stateObj.getSettings().set_int('overview-sort-windows',mode);await wait(500);}
            Main.activateWindow(a1.window);await wait(150);Main.overview.show();await wait(1000);
            const layouts=Main.overview._overview.controls._workspacesDisplay._workspacesViews.flatMap(v=>v._workspaces??[v._workspace]);
            const slots=layouts.flatMap(w=>w?._container?.layout_manager?._windowSlots??[]);
            const expected=[...new Set(slots.map(slot=>slot[4]?.metaWindow).filter(w=>shown().some(t=>t.window===w)))];
            GLib.file_set_contents(`${root}/order-debug-${mode}.json`,JSON.stringify({overview:{visible:Main.overview.visible,shown:Main.overview._shown,animating:Main.overview._animationInProgress},expected:expected.map(w=>w.title.slice(0,15)),shown:shown().map(t=>t.window.title.slice(0,15)),cached:[...bar.overviewOrder].map(([w,r])=>[w.title.slice(0,15),r]),rows:layouts.flatMap(w=>w?._container?.layout_manager?._layout?.rows??[]).map(r=>r.windows.map(p=>p.metaWindow?.title.slice(0,15)))}));
            check(expected.length===3,'actual overview layout contains all tasks');
            check(shown().every((t,i)=>t.window===expected[i]),'tasks follow actual overview layout '+mode);
            Main.overview.hide();await wait(500);
            const before=shown().map(t=>t.window);Main.activateWindow(b.window);await wait(250);
            check(shown().every((t,i)=>t.window===before[i]),'overview snapshot stays stable after focus '+mode);
            s.set_boolean('group-windows',true);await wait(150);
            const apps=shown().map(t=>t.app.get_id());Main.activateWindow(a2.window);await wait(200);
            check(shown().every((t,i)=>t.app.get_id()===apps[i]),'grouped application slots stay stable '+mode);
            s.set_boolean('group-windows',false);await wait(150);
        }

        a2.window.change_workspace_by_index(1,false);await wait(300);
        check(shown().length===2&&shown().every(t=>!t.titleLabel.visible),'workspace filtering controls dynamic display');
        s.set_boolean('show-active-workspace',false);await wait(250);check(shown().length===3,'workspace filter optional');
        s.set_boolean('show-active-workspace',true);a2.window.change_workspace_by_index(0,false);await wait(300);
        if(Main.layoutManager.monitors.length>1) {
            b.window.move_to_monitor(1);await wait(300);check(!b.visible,'other monitor filtered');
            s.set_boolean('show-panel-monitor-only',false);await wait(200);check(b.visible,'monitor filter optional');
            b.window.move_to_monitor(0);s.set_boolean('show-panel-monitor-only',true);await wait(250);
        }
        s.set_string('hover-action','preview');await wait(150);Main.activateWindow(a1.window);await wait(200);await hover(a1);
        pointer.notify_discrete_scroll(GLib.get_monotonic_time(),Clutter.ScrollDirection.DOWN,Clutter.ScrollSource.WHEEL);await wait(250);
        check(global.display.focus_window!==a1.window&&!bar.preview.visible,'real container scroll closes preview and switches windows');
        s.set_string('container-font-weight','bold');s.set_boolean('container-custom-background',true);s.set_string('container-background-color','rgba(12,34,56,0.5)');await wait(250);
        check(bar.style.includes('12,34,56')&&a1.titleLabel.get_theme_node().get_font().get_weight()>=700,'container background and font scoped');
        check(Main.panel.style===panelStyle&&Main.panel.style_class===panelClasses&&Main.panel.statusArea.dateMenu.container.get_parent()===dateParent,'panel styles and date placement untouched');
        s.set_string('container-position','center');await wait(250);check(bar.container.get_parent()===Main.panel._centerBox,'container placement updates in place');
        s.set_string('container-position','left');s.set_string('hover-action','preview');await wait(200);
        move(800,500);await wait(200);await hover(b);check(bar.preview.visible,'preview reopened');
        const closeButton=bar.preview.cards.get_first_child().get_first_child().get_last_child();
        await hover(closeButton);await click();await wait(400);
        check(bar.preview.source!==b&&!bar.tasks.has(b.window),'preview close button removes source clone and task');
        a2.window.minimize();await wait(250);bar.preview.open(a2,[a2.window]);await wait(150);
        check(bar.preview.visible&&a2.window.minimized,'minimized preview never unminimizes window');
        s.set_boolean('container-fill-space',true);await wait(200);
        const fillParent=bar.fillParent, fillConstraint=bar.fillConstraint;
        Main.extensionManager.disableExtension(uuid);await wait(300);
        check(!fillParent.get_constraints().includes(fillConstraint),'disable removes active fill constraint');
        check(!Main.panel.statusArea.tasksInPanelTaskbar,'container removed with preview open');
        check(!bar.preview.closeTimer&&!bar.refreshTimer&&!bar.orderPaintSignal&&bar.tasks.size===0&&bar.overviewOrder.size===0,'disable cancels resources');
        Main.overview.show();await wait(1000);
        Main.extensionManager.enableExtension(uuid);await wait(400);check(Main.extensionManager.lookup(uuid).state===1,'re-enable');
        const rebuilt=Main.extensionManager.lookup(uuid).stateObj._bar;
        check(rebuilt.overviewOrder.size===2,'enabling during overview captures existing layout');
        const rebuiltTasks=rebuilt.box.get_children().filter(t=>t.visible);
        check(rebuiltTasks.every((t,i)=>rebuilt.overviewOrder.get(t.window)===i),'re-enabled tasks follow the visible overview');
        Main.overview.hide();await wait(300);
        s.set_boolean('middle-click-close',true);s.set_string('hover-action','none');await wait(150);await hover(rebuilt.tasks.get(a2.window));
        pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_MIDDLE,Clutter.ButtonState.PRESSED);await wait(50);pointer.notify_button(GLib.get_monotonic_time(),Clutter.BUTTON_MIDDLE,Clutter.ButtonState.RELEASED);await wait(350);
        check(!rebuilt.tasks.has(a2.window)&&rebuilt.tasks.has(a1.window),'real middle click closes only represented window');
        Main.extensionManager.disableExtension(uuid);await wait(200);
        GLib.file_set_contents(`${root}/result.json`,JSON.stringify({pass:true,shell:Config.PACKAGE_VERSION,scale,monitors:Main.layoutManager.monitors.length,checks}));
    }
}

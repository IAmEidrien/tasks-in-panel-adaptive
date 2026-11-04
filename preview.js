// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
// Reference: Dash-to-Panel windowPreview.js (GPL-2.0-or-later).
// Independently implemented: delayed close, native window clones and pointer anchoring.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

export class Preview {
    constructor() {
        this.pointer = new BoxPointer.BoxPointer(St.Side.TOP, {reactive: true, can_focus: true, track_hover: true});
        this.pointer.add_style_class_name('popup-menu-boxpointer');
        this.pointer.reactive = true;
        this.pointer.track_hover = true;
        this.content = new St.BoxLayout({style_class: 'popup-menu-content tip-previews'});
        this.pointer.bin.set_child(this.content);
        Main.layoutManager.addChrome(this.pointer);
        this.pointer.hide();
        this.pointer.connect('notify::hover', () => {
            if (this.pointer.hover) this.cancelClose();
            else this.requestClose();
        });
        this.pointer.connect('key-press-event', (_actor, event) => {
            if (event.get_key_symbol() !== Clutter.KEY_Escape) return Clutter.EVENT_PROPAGATE;
            this.source?.grab_key_focus();
            this.close();
            return Clutter.EVENT_STOP;
        });
        this.scaleContext = St.ThemeContext.get_for_stage(global.stage);
        this.scaleSignal = this.scaleContext.connect('notify::scale-factor', () => this.close());
    }

    get visible() { return this.pointer.visible; }

    cancelClose() {
        if (this.closeTimer) GLib.source_remove(this.closeTimer);
        this.closeTimer = 0;
    }

    requestClose() {
        this.cancelClose();
        this.closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 180, () => {
            this.closeTimer = 0;
            if (!this.pointer.hover && !this.source?.hover) this.close();
            return GLib.SOURCE_REMOVE;
        });
    }

    open(source, windows) {
        if (source.dead || !source.mapped || !windows.length) return;
        this.close();
        this.source = source;
        // Resolve the panel theme and any container override on the source task.
        this.headerWeight = source.titleLabel.get_theme_node().get_font().get_weight();
        const scale = this.scaleContext.scale_factor;
        const monitor = Main.layoutManager.findMonitorForActor(source) ?? Main.layoutManager.primaryMonitor;
        const width = Math.min(240, monitor.width / scale * 0.65);
        const height = Math.min(160, monitor.height / scale * 0.4);
        const overflow = windows.length * (width + 20) > monitor.width / scale - 72;
        const scroll = new St.ScrollView({hscrollbar_policy: overflow ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.NEVER});
        scroll.set_style(`max-width: ${Math.max(100, monitor.width / scale - 48)}px;`);
        this.cards = new St.BoxLayout({style_class: 'tip-preview-cards'});
        scroll.set_child(this.cards);
        this.content.add_child(scroll);
        for (const window of windows) this.addCard(window, width, height, scale);
        this.pointer.setPosition(source, 0.5);
        this.pointer.open(BoxPointer.PopupAnimation.NONE);
    }

    addCard(window, width, height, scale) {
        // vertical was superseded by orientation in newer Shell's St.BoxLayout.
        const card = new St.BoxLayout({style_class: 'tip-preview-card', width: width * scale,
            ...(Number(Config.PACKAGE_VERSION.split('.')[0]) < 48 ? {vertical: true} : {orientation: Clutter.Orientation.VERTICAL})});
        const header = new St.BoxLayout({style_class: 'tip-preview-header'});
        const title = new St.Label({text: window.title || 'Untitled window', y_align: Clutter.ActorAlign.CENTER});
        title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        title.set_style(`font-weight: ${this.headerWeight};`);
        const activate = () => { this.close(); Main.activateWindow(window); };
        const titleButton = new St.Button({child: title, can_focus: true, x_expand: true, style_class: 'tip-preview-title'});
        titleButton.set_style(`max-width: ${Math.max(24, width - 56)}px;`);
        titleButton.accessible_name = window.title || 'Untitled window';
        titleButton.connect('clicked', activate);
        const close = new St.Button({child: new St.Icon({icon_name: 'window-close-symbolic', icon_size: 16}),
            can_focus: true, x_expand: false, y_expand: false,
            x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER,
            style_class: 'tip-preview-close', accessible_name: `Close ${window.title || 'window'}`});
        close.visible = window.can_close();
        close.connect('clicked', () => { this.close(); window.delete(global.get_current_time()); });
        header.add_child(titleButton);
        header.add_child(close);
        card.add_child(header);
        const image = new St.Widget({layout_manager: new Clutter.FixedLayout(),
            width: width * scale, height: height * scale, clip_to_allocation: true});
        const actor = window.get_compositor_private();
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        if (actor && !window.minimized && frame.width > 0 && frame.height > 0) {
            const ratio = Math.min(width * scale / frame.width, height * scale / frame.height, 1);
            image.set_size(frame.width * ratio, frame.height * ratio);
            const clone = new Clutter.Clone({source: actor});
            clone.set_size(buffer.width * ratio, buffer.height * ratio);
            clone.set_position((buffer.x - frame.x) * ratio, (buffer.y - frame.y) * ratio);
            image.add_child(clone);
        } else {
            // Never unminimize a window just to obtain a thumbnail.
            image.destroy();
        }
        const body = new St.Button({child: actor && !window.minimized && frame.width > 0 && frame.height > 0
            ? image : new St.Label({text: window.minimized ? 'Minimized window' : 'Preview unavailable'}),
            can_focus: true, style_class: 'tip-preview-image', accessible_name: `Activate ${window.title || 'window'}`});
        body.connect('clicked', activate);
        card.add_child(body);
        this.cards.add_child(card);
        window.connectObject('unmanaging', () => this.close(),
            'size-changed', () => this.close(), 'workspace-changed', () => this.close(), card);
    }

    close() {
        this.cancelClose();
        this.pointer.close(BoxPointer.PopupAnimation.NONE);
        this.content.destroy_all_children();
        this.cards = null;
        this.source = null;
    }

    destroy() {
        this.close();
        this.scaleContext.disconnect(this.scaleSignal);
        Main.layoutManager.removeChrome(this.pointer);
        this.pointer.destroy();
    }
}

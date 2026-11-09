#!/usr/bin/env python3
"""Run the real tip probe in a disposable, isolated GNOME test runtime."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--version', choices=['46', '47', '48', '49', '50', '51'], default='46')
p.add_argument('--output', type=Path, required=True)
p.add_argument('--vshell', type=Path)
p.add_argument('--xorg', action='store_true')
p.add_argument('--multi-monitor', action='store_true')
args = p.parse_args()
source = Path(__file__).resolve().parent
root = args.output.resolve()
root.mkdir(parents=True, exist_ok=False)
for part in ['data', 'config', 'cache', 'runtime']:
    (root / part).mkdir(mode=0o700)
extensions = root / 'data/gnome-shell/extensions'
extensions.mkdir(parents=True)
target = extensions / 'tasks-in-panel-adaptive@eidrien.local'
shutil.copytree(source.parents[1], target,
                ignore=shutil.ignore_patterns('.git', 'tests', '*.zip', '__pycache__'))
subprocess.run(['glib-compile-schemas', '--strict', str(target / 'schemas')], check=True)
enabled = ['tip-test@eidrien.local']
if args.vshell:
    vshell = extensions / 'vertical-workspaces@G-dH.github.com'
    shutil.copytree(args.vshell, vshell, ignore=shutil.ignore_patterns('.git'))
    subprocess.run(['glib-compile-schemas', '--strict', str(vshell/'schemas')], check=True)
    enabled.insert(0, vshell.name)
probe = extensions / 'tip-test@eidrien.local'
probe.mkdir()
(probe / 'metadata.json').write_text(json.dumps({
    'uuid': probe.name, 'name': 'TIP-A native test', 'description': 'Isolated test',
    'shell-version': [args.version],
}))
shutil.copy(source / 'probe.js', probe / 'extension.js')
shutil.copy(source / 'client.js', root / 'client.js')
apps = root / 'data/applications'
apps.mkdir()
for app in ['org.eidrien.TipTestA', 'org.eidrien.TipTestB']:
    (apps / (app+'.desktop')).write_text(f'[Desktop Entry]\nType=Application\nName={app}\nExec=true\nIcon=utilities-terminal\nStartupWMClass={app}\n')
env = dict(os.environ, REVIEW_ROOT=str(root), XDG_DATA_HOME=str(root / 'data'),
           XDG_CONFIG_HOME=str(root / 'config'), XDG_CACHE_HOME=str(root / 'cache'),
           XDG_RUNTIME_DIR=str(root / 'runtime'), XDG_SESSION_TYPE='wayland',
           XDG_CURRENT_DESKTOP='GNOME', GSETTINGS_BACKEND='dconf', GTK_A11Y='none',
           TEST_VSHELL='1' if args.vshell else '', LIBGL_ALWAYS_SOFTWARE='1', GALLIUM_DRIVER='llvmpipe', LP_NUM_THREADS='2',
           DBUS_SYSTEM_BUS_ADDRESS=f'unix:path={root}/runtime/system-bus')
flags = '--nested --wayland --no-x11 --sm-disable' if int(args.version) < 50 else \
        '--headless --virtual-monitor=1280x800 --no-x11'
if args.xorg:
    flags = '--x11 --replace --sm-disable'
    env['XDG_SESSION_TYPE'] = 'x11'
if args.multi_monitor and int(args.version) >= 50:
    flags += ' --virtual-monitor=1280x800'
(root / 'session.sh').write_text('''set -eu
gsettings set org.gnome.desktop.interface enable-animations false
gsettings set org.gnome.desktop.interface enable-hot-corners false
gsettings set org.gnome.shell enabled-extensions 'ENABLED_EXTENSIONS'
gsettings set org.gnome.shell disabled-extensions '[]'
gsettings set org.gnome.shell disable-extension-version-validation true
gsettings set org.gnome.shell welcome-dialog-last-shown-version 999
gsettings set org.gnome.desktop.notifications show-banners false
gsettings set org.gnome.mutter dynamic-workspaces false
gsettings set org.gnome.desktop.wm.preferences num-workspaces 3
exec gnome-shell '''.replace('ENABLED_EXTENSIONS', json.dumps(enabled)) + flags + '\n')
script = '''set -eu
dbus-daemon --session --address="$DBUS_SYSTEM_BUS_ADDRESS" --nofork > "$REVIEW_ROOT/system-bus.log" 2>&1 &
trap 'kill $! 2>/dev/null || true' EXIT
dbus-run-session -- xvfb-run -a -s '-screen 0 1280x800x24 +extension GLX' bash "$REVIEW_ROOT/session.sh"
'''
with (root / 'shell.log').open('w') as log:
    process = subprocess.Popen(['bash', '-c', script], env=env, stdout=log,
                               stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(120):
            if (root / 'result.json').exists():
                result = json.loads((root / 'result.json').read_text())
                print(json.dumps(result))
                if not result.get('pass'):
                    raise RuntimeError(f'Probe failed: {root}')
                break
            if process.poll() is not None:
                raise RuntimeError(f'Shell exited: {root}')
            time.sleep(1)
        else:
            raise TimeoutError(str(root))
    finally:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()

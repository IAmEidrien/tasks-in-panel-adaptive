"""Build only the immutable Stable Container historical artifact."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]

def package(output):
    manifest = json.loads((ROOT/'legacy-build.json').read_text())
    for name, digest in manifest['files'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
            raise ValueError(f'Historical runtime changed: {name}')
    output.mkdir(parents=True, exist_ok=True)
    archive = output/f"{manifest['uuid']}.legacy-stable-container-r3.shell-extension.zip"
    with tempfile.TemporaryDirectory() as temporary:
        schemas = Path(temporary)
        (schemas/'org.gnome.shell.extensions.tasks-in-panel.gschema.xml').write_bytes(
            (ROOT/'schemas/org.gnome.shell.extensions.tasks-in-panel.gschema.xml').read_bytes())
        subprocess.run(['glib-compile-schemas', '--strict', str(schemas)], check=True)
        with ZipFile(archive, 'w', ZIP_DEFLATED) as zipped:
            for name in [*manifest['files'], 'LICENSE', 'LICENSING.md', 'README-STABLE-CONTAINER.md', 'legacy-build.json']:
                zipped.write(ROOT/name, name)
            zipped.write(schemas/'gschemas.compiled', 'schemas/gschemas.compiled')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output/'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
    return archive

if __name__ == '__main__':
    print(package(ROOT/'dist'))

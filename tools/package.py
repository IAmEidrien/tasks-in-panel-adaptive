"""Package the current extension without altering the checkout's schemas."""
from pathlib import Path
import json
import subprocess
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]

def package(output):
    metadata = json.loads((ROOT/'metadata.json').read_text())
    output.mkdir(parents=True, exist_ok=True)
    archive = output/f"{metadata['uuid']}.shell-extension.zip"
    with tempfile.TemporaryDirectory() as directory:
        schema_dir = Path(directory)
        for schema in (ROOT/'schemas').glob('*.gschema.xml'):
            (schema_dir/schema.name).write_bytes(schema.read_bytes())
        subprocess.run(['glib-compile-schemas', '--strict', str(schema_dir)], check=True)
        with ZipFile(archive, 'w', ZIP_DEFLATED) as zipped:
            for file in [*ROOT.glob('*.js'), *ROOT.glob('*.css'), *ROOT.glob('schemas/*.gschema.xml'),
                         *[ROOT/name for name in ['metadata.json','LICENSE','COPYING','LICENSING.md','README.md']]]:
                zipped.write(file, file.relative_to(ROOT))
            zipped.write(schema_dir/'gschemas.compiled', 'schemas/gschemas.compiled')
    return archive

if __name__ == '__main__':
    print(package(ROOT/'dist'))

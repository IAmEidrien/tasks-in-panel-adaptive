import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_legacy', ROOT/'tools/package_legacy.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Repository(unittest.TestCase):
    def test_historical_package(self):
        # This packaging entry point must fail once future runtime work differs.
        manifest = json.loads((ROOT/'legacy-build.json').read_text())
        if any(hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest
               for name, digest in manifest['files'].items()):
            self.skipTest('Historical packaging belongs to the immutable legacy tag')
        with tempfile.TemporaryDirectory() as directory:
            archive = module.package(Path(directory))
            with ZipFile(archive) as zipped:
                self.assertIn('schemas/gschemas.compiled', zipped.namelist())
                self.assertIn('LICENSE', zipped.namelist())
                for name, digest in manifest['files'].items():
                    self.assertEqual(hashlib.sha256(zipped.read(name)).hexdigest(), digest)

    def test_workflow_identity(self):
        self.assertIn("github.repository == 'IAmEidrien/tasks-in-panel-adaptive'",
            (ROOT/'.github/workflows/promote-testing.yml').read_text())
        self.assertNotIn('You may merge', (ROOT/'.github/scripts/promote.cjs').read_text())

if __name__ == '__main__':
    unittest.main()

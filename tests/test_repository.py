import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile
import importlib.util
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_current', ROOT/'tools/package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Repository(unittest.TestCase):
    def test_installable_package(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = module.package(Path(directory))
            with ZipFile(archive) as zipped:
                self.assertIsNone(zipped.testzip())
                for file in ['schemas/gschemas.compiled','LICENSE','COPYING','preview.js','settings.js','policy.js']:
                    self.assertIn(file,zipped.namelist())
                self.assertEqual(json.loads(zipped.read('metadata.json'))['uuid'],'tasks-in-panel-adaptive@eidrien.local')
                self.assertFalse(any(file.startswith(('.git/','tests/')) for file in zipped.namelist()))
    def test_workflow_identity(self):
        self.assertIn("github.repository == 'IAmEidrien/tasks-in-panel-adaptive'",(ROOT/'.github/workflows/promote-testing.yml').read_text())
        self.assertNotIn('You may merge',(ROOT/'.github/scripts/promote.cjs').read_text())
if __name__ == '__main__': unittest.main()

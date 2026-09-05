"""Compatibility entrypoint: repairs are now checked-in source, not generated patches."""
from pathlib import Path

required = [
    'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/autonomousTaskPolicy.ts',
    'scripts/forge-document-reader.py',
    'scripts/forge-document-reader.mjs',
]
for filename in required:
    if not Path(filename).is_file():
        raise RuntimeError(f'Missing maintained runtime source: {filename}. Restore it from git.')
print('Forge runtime source is already checked in; no patch application required.')

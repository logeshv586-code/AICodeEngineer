from pathlib import Path

path = Path('src/vs/workbench/contrib/void/browser/toolsService.ts')
text = path.read_text(encoding='utf-8')
before = "}).join('\n\n')"
after = "}).join('\\n\\n')"
count = text.count(before)
if count != 1:
    raise RuntimeError(f'expected exactly one broken multiline join, found {count}')
path.write_text(text.replace(before, after, 1), encoding='utf-8')
print('Fixed Forge batch read join escaping.')

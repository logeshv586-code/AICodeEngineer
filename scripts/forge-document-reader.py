import argparse
import csv
import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET

MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_EXPANDED_BYTES = 64 * 1024 * 1024

def checked_zip(path):
    zf = zipfile.ZipFile(path)
    if len(zf.infolist()) > 10000 or sum(item.file_size for item in zf.infolist()) > MAX_EXPANDED_BYTES:
        zf.close()
        raise ValueError("Office archive exceeds extraction limits")
    return zf

def numbered_parts(names, pattern):
    return sorted((name for name in names if re.fullmatch(pattern, name)), key=lambda name: int(re.search(r"(\d+)\.xml$", name).group(1)))
from pathlib import Path


def clean_text(value: str) -> str:
    value = value.replace('\x00', '')
    value = re.sub(r'[ \t]+\n', '\n', value)
    value = re.sub(r'\n{3,}', '\n\n', value)
    return value.strip()


def xml_text(data: bytes) -> str:
    root = ET.fromstring(data)
    parts = []
    for node in root.iter():
        if node.text and node.tag.rsplit('}', 1)[-1] in {'t', 'v'}:
            parts.append(node.text)
        if node.tag.rsplit('}', 1)[-1] in {'p', 'tr'}:
            parts.append('\n')
    return clean_text(' '.join(parts).replace(' \n ', '\n'))


def read_docx(path: str) -> str:
    with checked_zip(path) as zf:
        return xml_text(zf.read('word/document.xml'))


def read_pptx(path: str) -> str:
    with checked_zip(path) as zf:
        slides = numbered_parts(zf.namelist(), r'ppt/slides/slide\d+\.xml')
        return '\n\n'.join(f'[Slide {index}]\n{xml_text(zf.read(name))}' for index, name in enumerate(slides, 1))


def read_xlsx(path: str) -> str:
    with checked_zip(path) as zf:
        shared = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
            for item in root:
                shared.append(''.join(node.text or '' for node in item.iter() if node.tag.rsplit('}', 1)[-1] == 't'))
        sheets = numbered_parts(zf.namelist(), r'xl/worksheets/sheet\d+\.xml')
        output = []
        for index, name in enumerate(sheets, 1):
            root = ET.fromstring(zf.read(name))
            rows = []
            for row in root.iter():
                if row.tag.rsplit('}', 1)[-1] != 'row':
                    continue
                cells = []
                for cell in row:
                    if cell.tag.rsplit('}', 1)[-1] != 'c':
                        continue
                    ref = cell.attrib.get('r', '')
                    cell_type = cell.attrib.get('t', '')
                    value = ''
                    for child in cell.iter():
                        local = child.tag.rsplit('}', 1)[-1]
                        if local == 'v' and child.text is not None:
                            value = child.text
                        elif local == 't' and child.text is not None and cell_type == 'inlineStr':
                            value += child.text
                    if cell_type == 's' and value.isdigit() and int(value) < len(shared):
                        value = shared[int(value)]
                    cells.append(f'{ref}={value}' if ref else value)
                if cells:
                    rows.append(' | '.join(cells))
            output.append(f'[Sheet {index}]\n' + '\n'.join(rows))
        return clean_text('\n\n'.join(output))


def read_pdf(path: str) -> str:
    errors = []
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        return clean_text('\n\n'.join(f'[Page {i}]\n{page.extract_text() or ""}' for i, page in enumerate(reader.pages, 1)))
    except Exception as exc:
        errors.append(f'pypdf: {exc}')
    try:
        import fitz
        doc = fitz.open(path)
        return clean_text('\n\n'.join(f'[Page {i + 1}]\n{page.get_text("text")}' for i, page in enumerate(doc)))
    except Exception as exc:
        errors.append(f'PyMuPDF: {exc}')
    pdftotext = shutil.which('pdftotext')
    if pdftotext:
        result = subprocess.run([pdftotext, '-layout', path, '-'], capture_output=True, text=True, errors='replace', timeout=45)
        if result.returncode == 0:
            pages = result.stdout.split('\f')
            return clean_text('\n\n'.join(f'[Page {i}]\n{page}' for i, page in enumerate(pages, 1) if page.strip()))
        errors.append(result.stderr.strip())
    raise RuntimeError('PDF extraction unavailable. Install pypdf/PyMuPDF or pdftotext. ' + '; '.join(errors[-2:]))


def read_rtf(path: str) -> str:
    data = Path(path).read_text(encoding='utf-8', errors='replace')
    data = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', data)
    data = data.replace('{', '').replace('}', '').replace("\\'", '')
    return clean_text(data)


def read_text(path: str) -> str:
    return clean_text(Path(path).read_text(encoding='utf-8', errors='replace'))


def extract(path: str) -> dict:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    if os.path.getsize(path) > MAX_FILE_BYTES:
        raise ValueError('Document exceeds 32 MiB extraction limit')
    ext = Path(path).suffix.lower()
    if ext == '.pdf':
        content = read_pdf(path)
    elif ext == '.docx':
        content = read_docx(path)
    elif ext == '.xlsx':
        content = read_xlsx(path)
    elif ext == '.pptx':
        content = read_pptx(path)
    elif ext == '.rtf':
        content = read_rtf(path)
    elif ext in {'.txt', '.md', '.csv', '.json', '.jsonl', '.xml', '.yaml', '.yml', '.toml', '.sql', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.mjs', '.cjs', '.rs', '.go', '.java', '.kt', '.kts', '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.rb', '.sh', '.ps1', '.scss'}:
        content = read_text(path)
    elif ext in {'.doc', '.xls', '.ppt'}:
        raise RuntimeError(f'Legacy {ext} binary format is not parsed directly. Convert it to DOCX/XLSX/PPTX or use a connected document plugin.')
    else:
        raise RuntimeError(f'Unsupported document type: {ext or "no extension"}')
    warnings = []
    if not re.sub(r'\[Page \d+\]', '', content).strip():
        warnings.append('No extractable text found. A scanned PDF/image requires OCR; no visual content was read.')
    if ext == '.rtf':
        warnings.append('Basic RTF text extraction; embedded objects and complex formatting are not interpreted.')
    return {'path': os.path.abspath(path), 'extension': ext, 'content': content, 'warnings': warnings}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', required=True)
    parser.add_argument('--max-chars', type=int, default=60000)
    args = parser.parse_args()
    try:
        result = extract(args.path)
        content = result['content']
        limit = max(1000, min(args.max_chars, 250000))
        result['truncated'] = len(content) > limit
        result['content'] = content[:limit]
        result['characters'] = len(content)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({'error': str(exc), 'path': os.path.abspath(args.path)}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

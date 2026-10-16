"""Validate rendered synthetic app PDFs; run with the bundled PDF Python runtime."""
import json
import re
from pathlib import Path
import pdfplumber

root = Path('tmp/product-direction/report-pdfs')
manifest = json.loads((root / 'manifest.json').read_text())
results = []
for fixture in manifest:
    path = Path(fixture['path'])
    with pdfplumber.open(path) as pdf:
        expected_size = (612, 792) if fixture['format'] == 'Letter' else (595.28, 841.89)
        words_per_page = []
        text = ''
        for index, page in enumerate(pdf.pages):
            assert abs(page.width - expected_size[0]) < 1 and abs(page.height - expected_size[1]) < 1, (path, page.width, page.height)
            words = page.extract_words()
            assert len(words) >= 12, f'Blank or near-blank page: {path} page{index + 1}'
            for word in words:
                assert word['x0'] >= 3 and word['x1'] <= page.width - 3, (path, index + 1, 'horizontal clipping', word)
                assert word['top'] >= 3 and word['bottom'] <= page.height - 3, (path, index + 1, 'vertical clipping', word)
            words_per_page.append(len(words))
            text += '\n' + (page.extract_text() or '')
        compact = re.sub(r'\s+', ' ', text)
        assert 'Own Path' in text and 'Assigned work' in text and 'Original evidence' in text, path
        if fixture['case'].startswith('long'):
            assert len(pdf.pages) > 1, path
            assert 'Final reflection line stays visible.' in compact, path
            assert 'window.__reportInjected' in text, path
            assert 'long-reference-' in text, path
        if fixture['case'] == 'long-amendment':
            assert 'Version 2' in compact and 'Review another example' in compact and 'Parent print-parent' in compact, path
        if fixture['case'] == 'zero':
            inline = re.search(r'8\s+assigned\s+0\s+completed\s+8\s+incomplete', compact)
            aligned = re.search(r'8\s+0\s+8\s+assigned\s+completed\s+incomplete', compact)
            assert inline or aligned, path
        if fixture['case'] == 'legacy-review':
            assert 'Completion counts require review' in compact and 'Duration not recorded' in compact, path
        assert re.search(r'Page 1 of \d+', compact), f'Page numbers missing: {path}'
        results.append({'case': fixture['case'], 'format': fixture['format'], 'pages': len(pdf.pages), 'words_per_page': words_per_page, 'geometry': 'inside page bounds'})
(root / 'validation.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))

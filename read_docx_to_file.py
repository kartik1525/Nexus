import zipfile
import xml.etree.ElementTree as ET
try:
    with zipfile.ZipFile(r'f:\Nexus\NexusAgent_PRD_v1.0.docx') as docx:
        x = docx.read('word/document.xml')
        t = ET.fromstring(x)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        lines = []
        for p in t.findall('.//w:p', ns):
            text = ''.join(n.text for n in p.findall('.//w:t', ns) if n.text)
            if text:
                lines.append(text)
        with open(r'f:\Nexus\PRD_content.md', 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    print("Done")
except Exception as e:
    print('Error:', e)

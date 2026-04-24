import zipfile
import xml.etree.ElementTree as ET
try:
    with zipfile.ZipFile(r'f:\Nexus\NexusAgent_PRD_v1.0.docx') as docx:
        x = docx.read('word/document.xml')
        t = ET.fromstring(x)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        for p in t.findall('.//w:p', ns):
            text = ''.join(n.text for n in p.findall('.//w:t', ns) if n.text)
            if text:
                print(text)
except Exception as e:
    print('Error:', e)

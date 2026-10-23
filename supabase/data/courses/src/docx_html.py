# docx → plain HTML (paragraphs + tables) for html_tables.tables(): python3 docx_html.py <in.docx> <out.html>
import html, re, sys, zipfile

def text(xml):
    return html.escape(html.unescape("".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", re.sub(r"<w:tab/>|<w:br/>", "<w:t> </w:t>", xml)))))

def convert(path):
    body = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    out = []
    # split on tables first: a table can sit inside a paragraph (text box), which a single scan would break up
    for part in re.split(r"(?s)(<w:tbl>.*?</w:tbl>)", body):
      for x in ([part] if part.startswith("<w:tbl>") else re.findall(r"(?s)<w:p[ >].*?</w:p>", part)):
        if x.startswith("<w:tbl>"):
            rows = ["<tr>" + "".join(f"<td>{' '.join(text(p) for p in re.findall(r'(?s)<w:p[ >].*?</w:p>', c))}</td>"
                                     for c in re.findall(r"(?s)<w:tc>.*?</w:tc>", r)) + "</tr>"
                    for r in re.findall(r"(?s)<w:tr[ >].*?</w:tr>", x)]
            out.append("<table>" + "".join(rows) + "</table>")
        else:
            out.append(f"<p>{text(x)}</p>")
    return "<html><body>" + "\n".join(out) + "</body></html>"

if __name__ == "__main__":
    open(sys.argv[2], "w").write(convert(sys.argv[1]))

for line in open('backend/.env', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    v = v.strip()
    shown = ('<set len=' + str(len(v)) + '>') if v else '<EMPTY>'
    print(k.strip(), '=', shown)

import re, sys, collections
errs = collections.defaultdict(list)
for ln in open(sys.argv[1]):
    m = re.match(r'^(.+?)\((\d+),(\d+)\): error TS2554: Expected 1 arguments, but got 2', ln)
    if m: errs[m.group(1)].append((int(m.group(2)), int(m.group(3))))
for f, locs in errs.items():
    src = open(f, encoding='utf-8').read()
    lines = src.split('\n')
    offs = []
    for (l, c) in locs:
        offs.append(sum(len(x) + 1 for x in lines[:l-1]) + c - 1)
    for start in sorted(offs, reverse=True):
        i = start; depth = 0; stack = []
        while True:
            ch = src[i]
            top = stack[-1] if stack else None
            if top in ("'", '"'):
                if ch == '\\': i += 2; continue
                if ch == top: stack.pop()
            elif top == '`':
                if ch == '\\': i += 2; continue
                if ch == '`': stack.pop()
                elif src.startswith('${', i): stack.append('{'); i += 2; continue
            else:
                if ch in "'\"`": stack.append(ch)
                elif ch in '([{': stack.append(ch)
                elif ch in ')]}':
                    if not stack: break
                    stack.pop()
                elif ch == ',' and not stack: break
            i += 1
        end = i
        j = start - 1
        while src[j].isspace(): j -= 1
        assert src[j] == ',', (f, src[j-20:start+10])
        print(f, repr(src[j:end]))
        src = src[:j] + src[end:]
    open(f, 'w', encoding='utf-8').write(src)

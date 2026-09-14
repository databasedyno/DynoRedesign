#!/usr/bin/env python3
"""Make pages/QA.tsx consume the shared @/data/qaCatalog instead of its inline
duplicate (single source of truth). Removes the local Test* interfaces and the
inline TEST_SECTIONS array; adds the catalog + QaGuidePanel imports."""
import io, sys

p = "pages/QA.tsx"
s = io.open(p, "r", encoding="utf-8").read()
orig = s

# 1) Remove the local TestStep/TestCase/TestSection interfaces (StepStatus stays).
start = s.index("interface TestStep {")
end = s.index("/* ==================== STYLED COMPONENTS")
s = s[:start] + s[end:]

# 2) Remove the inline TEST_SECTIONS array declaration.
astart = s.index("const TEST_SECTIONS: TestSection[] = [")
aend = s.index("/* ==================== PRIORITY COLORS")
s = s[:astart] + s[aend:]

# 3) Add imports right after the toFixedStr import.
anchor = 'import { toFixedStr } from "@/utils/money";'
add = (
    anchor
    + '\nimport { TEST_SECTIONS } from "@/data/qaCatalog";'
    + '\nimport QaGuidePanel from "@/Components/Page/Quality/QaGuidePanel";'
)
assert s.count(anchor) == 1, "anchor import not unique"
s = s.replace(anchor, add, 1)

assert "const TEST_SECTIONS: TestSection[] = [" not in s, "array not removed"
assert "interface TestSection {" not in s, "interfaces not removed"
assert s != orig
io.open(p, "w", encoding="utf-8").write(s)
print("QA.tsx refactored:", len(orig), "->", len(s), "chars")

code = open("_fm_content.tsx", encoding="utf-8").read()
with open(r"artifacts/oh-my-guard/src/pages/FileMonitor.tsx", "w", encoding="utf-8") as f:
    f.write(code)
import os
print("Written", os.path.getsize(r"artifacts/oh-my-guard/src/pages/FileMonitor.tsx"), "bytes")

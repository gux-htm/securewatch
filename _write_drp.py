import os, shutil
src = "_drp_content.tsx"
dst = r"artifacts/oh-my-guard/src/pages/DeviceRegistrationPage.tsx"
shutil.copy2(src, dst)
print("Copied", os.path.getsize(dst), "bytes to", dst)

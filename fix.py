import io
import os

path = r'src/components/Dashboard.jsx'
if os.path.exists(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Line 2051 is index 2050
    if '</p>' in lines[2050]:
        lines[2049] = '                           <div className="flex flex-col gap-0.5">\n'
        lines[2050] = '                             <p className={`text-[11px] font-bold font-readex ${actionColor}`}>\n                               {actionTitle}\n                             </p>\n'
        
        with io.open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Fixed successfully")
    else:
        print("Target line doesn't match")
else:
    print("File not found")

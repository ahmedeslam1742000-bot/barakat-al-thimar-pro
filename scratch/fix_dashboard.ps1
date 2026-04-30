$content = Get-Content 'e:\الموقع\src\components\Dashboard.jsx' -Encoding UTF8
$content[2049] = '                           <div className="flex flex-col gap-0.5">'
$content[2050] = '                             <p className={`text-[11px] font-bold font-readex ${actionColor}`}>{actionTitle}</p>'
$content | Set-Content 'e:\الموقع\src\components\Dashboard.jsx' -Encoding UTF8

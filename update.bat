@echo off
echo --- Starting Update for Baraka Al-Thimar ---

:: 1. إضافة كل التعديلات الجديدة
git add .

:: 2. كتابة رسالة الحفظ (ستظهر بتاريخ اليوم ووقت التحديث)
set commit_msg="Update: %date% %time%"
git commit -m %commit_msg%

:: 3. رفع الكود إلى GitHub (تأكد أن الفرع اسمه main أو master)
git push origin main

echo --- Done! Project is now updated on GitHub ---
pause
# Git History Cleanup Script
# This will remove hardcoded Firebase keys from ALL commits in history

$ErrorActionPreference = "Stop"
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

# Navigate to project directory
Set-Location "E:\الموقع"

Write-Host "=== Git History Cleanup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify current directory is a git repo
Write-Host "[1/4] Verifying Git repository..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    Write-Host "✗ Error: Not a Git repository!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Git repository verified" -ForegroundColor Green

# Step 2: Run filter-branch to remove secrets from firebase.js
Write-Host ""
Write-Host "[2/4] Rewriting Git history to remove Firebase keys..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

git filter-branch -f --tree-filter '
if [ -f "src/lib/firebase.js" ]; then
    sed -i "s/AIzaSyDSCbj6RuTG3mLy-fT6oUt5mSXnZiYgBAE/***REMOVED***/g" src/lib/firebase.js
    sed -i "s/barakat-al-thimar-pro\.firebaseapp\.com/***REMOVED***/g" src/lib/firebase.js
    sed -i "s/barakat-al-thimar-pro\.firebasestorage\.app/***REMOVED***/g" src/lib/firebase.js
    sed -i "s/440721005984/***REMOVED***/g" src/lib/firebase.js
    sed -i "s/1:440721005984:web:082d02db46915b683a18c5/***REMOVED***/g" src/lib/firebase.js
fi
' -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Git history rewritten successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Error rewriting Git history!" -ForegroundColor Red
    exit 1
}

# Step 3: Clean up old refs
Write-Host ""
Write-Host "[3/4] Cleaning up old Git objects..." -ForegroundColor Yellow
git reflog expire --expire=now --all
git gc --prune=now --aggressive
Write-Host "✓ Git cleanup complete" -ForegroundColor Green

# Step 4: Verify cleanup
Write-Host ""
Write-Host "[4/4] Verifying cleanup..." -ForegroundColor Yellow
$result = git log --all -S "AIzaSyDSCbj6RuTG3mLy-fT6oUt5mSXnZiYgBAE" --oneline 2>$null
if ($result.Count -eq 0 -or [string]::IsNullOrWhiteSpace($result)) {
    Write-Host "✓ SUCCESS! Firebase API key no longer found in Git history" -ForegroundColor Green
} else {
    Write-Host "! Warning: Key may still be in history. Check manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Cleanup Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Red
Write-Host "1. Restore your changes: git stash pop" -ForegroundColor White
Write-Host "2. Verify the app still works: npm run dev" -ForegroundColor White
Write-Host "3. Force push to remote: git push --force --all" -ForegroundColor White
Write-Host "4. Force push tags: git push --force --tags" -ForegroundColor White
Write-Host "5. ROTATE YOUR FIREBASE KEYS in Firebase Console!" -ForegroundColor White
Write-Host "6. Tell team members to re-clone the repository" -ForegroundColor White
Write-Host ""
Write-Host "Your backup is in branch: backup-before-cleanup" -ForegroundColor Yellow

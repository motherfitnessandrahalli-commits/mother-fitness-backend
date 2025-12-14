@echo off
echo ========================================================
echo   Deployment Fixer
echo ========================================================
echo.
echo I detected you were previously logged in as 'dacchuvinay'.
echo That account does not have permission.
echo.
echo I have cleared those credentials.
echo.
echo When the browser or login window pops up...
echo PLEASE LOGIN WITH THE NEW ACCOUNT: motherfitnessandrahalli-commits
echo.
echo Press any key to start the push...
pause
git push -u origin main
echo.
echo ========================================================
echo   Push Complete!
echo   If successful, Render deployment will start.
echo ========================================================
pause

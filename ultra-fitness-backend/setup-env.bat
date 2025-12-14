@echo off
echo Creating .env file from .env.example...
copy .env.example .env
echo.
echo .env file created successfully!
echo.
echo IMPORTANT: Please update the following values in .env file:
echo - MONGODB_URI (if using MongoDB Atlas)
echo - JWT_SECRET (use a strong random string)
echo - EMAIL_USER and EMAIL_PASSWORD (for email notifications)
echo.
pause

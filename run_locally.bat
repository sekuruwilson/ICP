@echo off
echo Starting Internal Chart Project...

start cmd /k "cd backend && venv\Scripts\python.exe manage.py runserver"
start cmd /k "cd client && npm run dev"

echo Project services are starting in separate windows.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:5173
pause

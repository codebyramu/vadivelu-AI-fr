#!/usr/bin/env bash
set -e

# Vadivelu AI Launch Script
echo "========================================="
echo "   Starting Vadivelu AI Voice Chat       "
echo "========================================="

# 1. Check Python virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r backend/requirements.txt
fi

# 2. Check frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# 3. Create .env if not present
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "NOTE: Please add your GEMINI_API_KEY_1 to .env"
fi

# 4. Start backend in background
echo "Starting FastAPI backend server on http://localhost:8000 ..."
PYTHONPATH=backend .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 5. Start frontend
echo "Starting Vite frontend server on http://localhost:5173 ..."
cd frontend && npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; echo 'Servers stopped.'" EXIT INT TERM

echo "Vadivelu AI is running!"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

wait

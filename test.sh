#!/usr/bin/env bash
set -e

echo "========================================="
echo "   Running Vadivelu AI Test Suite        "
echo "========================================="

echo "[1/2] Running Backend Pytest Tests..."
.venv/bin/pytest backend/tests/ -v

echo "[2/2] Running Frontend TypeScript and Vite Build Verification..."
cd frontend
npm run build
cd ..

echo "========================================="
echo "   All Backend and Frontend Tests PASSED! "
echo "========================================="

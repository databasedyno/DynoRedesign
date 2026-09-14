#!/bin/bash
# ============================================
# DynoPay Backend Startup Script
# ============================================
# Ensures all dependencies are installed before starting backend

set -e  # Exit on error

echo "================================================"
echo "DynoPay Backend - Pre-Start Dependency Check"
echo "================================================"

cd /app/backend

# Check and install Node.js dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.yarn-integrity" ]; then
    echo "📦 Installing Node.js dependencies..."
    yarn install --frozen-lockfile --non-interactive
    echo "✅ Node.js dependencies installed"
else
    echo "✅ Node.js dependencies already installed"
fi

# Check and install Python dependencies
echo "🐍 Checking Python dependencies..."
/root/.venv/bin/pip list | grep -q "uvicorn" || {
    echo "📦 Installing Python dependencies..."
    /root/.venv/bin/pip install -r requirements.txt --no-cache-dir
    echo "✅ Python dependencies installed"
}

echo "================================================"
echo "🚀 Starting Backend Services..."
echo "================================================"

# Start the backend using uvicorn
exec /root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload

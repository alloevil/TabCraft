#!/bin/bash
# TabCraft — One-click setup script
set -e

echo "✦ TabCraft Setup"
echo "================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    echo "   https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js $NODE_VERSION detected. Requires 18+."
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build
echo ""
echo "🔨 Building extension..."
npm run dev &
DEV_PID=$!

# Wait for build to complete
echo "   Waiting for initial build..."
sleep 10

# Check if build directory exists
if [ -d "build/chrome-mv3-dev" ]; then
    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Open Chrome → chrome://extensions/"
    echo "   2. Enable 'Developer mode' (top right)"
    echo "   3. Click 'Load unpacked'"
    echo "   4. Select: $(pwd)/build/chrome-mv3-dev/"
    echo ""
    echo "💡 The dev server is running (hot reload enabled)."
    echo "   Press Ctrl+C to stop."
    echo ""
    # Keep dev server running
    wait $DEV_PID
else
    echo ""
    echo "⚠️  Build directory not found. Check the output above for errors."
    kill $DEV_PID 2>/dev/null
    exit 1
fi

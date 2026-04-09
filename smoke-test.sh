#!/bin/bash
set -e

echo "🔍 Checking dependencies..."

if ! command -v gemini &> /dev/null; then
    echo "❌ gemini CLI not found. Please install it first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found."
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ cargo not found. Please install Rust."
    exit 1
fi

echo "✅ Dependencies found."

echo "📦 Installing npm dependencies..."
npm install --silent

echo "⚙️  Building Tauri backend..."
npm run tauri build -- --no-bundle

echo "🎉 Smoke test passed! You can now run the app with 'npm run tauri dev'."

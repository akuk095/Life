#!/bin/bash

# Personal Notebook PWA - Quick Setup Script
# This script helps you verify everything is ready for deployment

echo "🚀 Personal Notebook PWA - Setup Verification"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check files
echo "📁 Checking required files..."
echo ""

files=("index.html" "manifest.json" "service-worker.js" "offline.html")
missing_files=()

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file found"
    else
        echo -e "${RED}✗${NC} $file missing"
        missing_files+=("$file")
    fi
done

echo ""
echo "📱 Checking icon files..."
echo ""

icon_files=("icon-192.png" "icon-512.png")
missing_icons=()

for icon in "${icon_files[@]}"; do
    if [ -f "$icon" ]; then
        echo -e "${GREEN}✓${NC} $icon found"
    else
        echo -e "${YELLOW}⚠${NC} $icon missing (needs to be created)"
        missing_icons+=("$icon")
    fi
done

echo ""
echo "=============================================="
echo ""

# Summary
if [ ${#missing_files[@]} -eq 0 ]; then
    if [ ${#missing_icons[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All files ready!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Deploy to HTTPS hosting (GitHub Pages, Netlify, Vercel, etc.)"
        echo "2. Test on mobile device"
        echo "3. Look for install prompt"
        echo ""
        echo "Popular hosting options:"
        echo "• GitHub Pages: git push → Settings → Pages"
        echo "• Netlify: drag & drop folder"
        echo "• Vercel: vercel deploy"
        echo "• Firebase: firebase deploy"
    else
        echo -e "${YELLOW}⚠ Almost ready!${NC}"
        echo ""
        echo "You still need to create these icons:"
        for icon in "${missing_icons[@]}"; do
            echo "• $icon"
        done
        echo ""
        echo "See ICON-INSTRUCTIONS.md for how to create them"
    fi
else
    echo -e "${RED}❌ Missing required files:${NC}"
    for file in "${missing_files[@]}"; do
        echo "• $file"
    done
    echo ""
    echo "Please ensure all files are in the same directory"
fi

echo ""
echo "For detailed instructions, see PWA-SETUP-GUIDE.md"
echo ""

# Offer to create a simple test server
read -p "Would you like to start a local test server? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v python3 &> /dev/null; then
        echo "Starting Python server on http://localhost:8000"
        echo "Press Ctrl+C to stop"
        python3 -m http.server 8000
    elif command -v python &> /dev/null; then
        echo "Starting Python server on http://localhost:8000"
        echo "Press Ctrl+C to stop"
        python -m SimpleHTTPServer 8000
    else
        echo "Python not found. Please install Python or use another web server."
    fi
fi

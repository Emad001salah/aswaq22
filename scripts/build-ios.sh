#!/bin/bash
# scripts/build-ios.sh
#
# iOS Cloud & Local Build Script for Aswaq 22

echo "================================================================"
echo "🍏 Starting Aswaq 22 Native iOS Build & Archive Process..."
echo "================================================================"

# 1. Build Production Web Bundle
npm run build

# 2. Sync Capacitor iOS Project
npx cap sync ios

# 3. Compile Xcode Archive
cd ios/App
xcodebuild -workspace App.xcworkspace \
           -scheme App \
           -configuration Release \
           -sdk iphoneos \
           -archivePath build/App.xcarchive \
           CODE_SIGN_IDENTITY="" \
           CODE_SIGNING_REQUIRED=NO \
           CODE_SIGNING_ALLOWED=NO \
           archive

echo "✅ iOS App.xcarchive built successfully at ios/App/build/App.xcarchive"

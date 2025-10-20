#!/bin/bash

# Code signing script for macOS
# Signs the Pomodoro CLI binary with Apple Developer certificate

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Code Signing Pomodoro CLI for macOS...${NC}\n"

# Get the directory where this script is located (project root)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BINARY_PATH="$PROJECT_ROOT/dist/skills/pomodoro/pomodoro"

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo -e "${RED}Error: Binary not found at $BINARY_PATH${NC}"
    echo "Please run ./build.sh first to build the binary"
    exit 1
fi

# Check for required environment variables
if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
    echo -e "${RED}Error: APPLE_SIGNING_IDENTITY environment variable not set${NC}\n"
    echo "To find your signing identity, run:"
    echo -e "${BLUE}  security find-identity -v -p codesigning${NC}\n"
    echo "Then set the environment variable:"
    echo -e "${BLUE}  export APPLE_SIGNING_IDENTITY=\"Developer ID Application: Your Name (TEAM_ID)\"${NC}\n"
    exit 1
fi

# Display signing info
echo -e "${BLUE}Signing Identity:${NC} $APPLE_SIGNING_IDENTITY"
echo ""

# Code Sign
echo -e "${YELLOW}Code Signing...${NC}"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$BINARY_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Binary signed successfully${NC}\n"
else
    echo -e "${RED}✗ Code signing failed${NC}"
    exit 1
fi

# Verify Signature
echo -e "${YELLOW}Verifying Signature...${NC}"
codesign --verify --verbose=2 "$BINARY_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Signature verified${NC}\n"
else
    echo -e "${RED}✗ Signature verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Code Signing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your binary is now signed:"
echo "  $BINARY_PATH"
echo ""
echo "You can verify the signature with:"
echo -e "${BLUE}  codesign --verify --verbose=2 $BINARY_PATH${NC}"

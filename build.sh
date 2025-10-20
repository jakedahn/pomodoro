#!/bin/bash

# Build script for Pomodoro CLI binary
# This script compiles the Deno TypeScript application into a standalone binary

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building Pomodoro CLI...${NC}"

# Get the directory where this script is located (project root)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Output directory for the binary
OUTPUT_DIR="$PROJECT_ROOT/dist/skills/pomodoro"
OUTPUT_FILE="$OUTPUT_DIR/pomodoro"

# Create dist directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo -e "${RED}Error: Deno is not installed.${NC}"
    echo "Please install Deno from https://deno.land/manual/getting_started/installation"
    exit 1
fi

# Show Deno version
echo "Using Deno version: $(deno --version | head -n 1)"

# Compile the TypeScript application
echo -e "${YELLOW}Compiling TypeScript to binary...${NC}"
echo -e "${YELLOW}Permissions: read/write filesystem, HOME env var (network access denied)${NC}"

deno compile \
  --allow-env=HOME \
  --allow-read \
  --allow-write \
  --output "$OUTPUT_FILE" \
  "$PROJECT_ROOT/src/cli/pomodoro.ts"

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully compiled to: $OUTPUT_FILE${NC}"

    # Make the binary executable (should already be, but just to be sure)
    chmod +x "$OUTPUT_FILE"

    # Copy SKILL.md to dist directory
    echo -e "\n${YELLOW}Copying SKILL.md...${NC}"
    cp "$PROJECT_ROOT/src/SKILL.md" "$OUTPUT_DIR/SKILL.md"
    echo -e "${GREEN}✓ SKILL.md copied to: $OUTPUT_DIR/SKILL.md${NC}"

    # Show file info
    echo -e "\nBinary details:"
    ls -lh "$OUTPUT_FILE"

    echo -e "\n${GREEN}Build complete!${NC}"
    echo "You can now run the Pomodoro timer with: $OUTPUT_FILE"

    # Test the binary
    echo -e "\n${YELLOW}Testing binary...${NC}"
    "$OUTPUT_FILE" --version

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Binary test successful${NC}"
    else
        echo -e "${RED}✗ Binary test failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Compilation failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}Build process completed successfully!${NC}"
echo "The Pomodoro skill has been built to: $OUTPUT_DIR"
echo ""
echo "To install, copy the dist directory to ~/.claude/skills/:"
echo "  cp -r $PROJECT_ROOT/dist/* ~/.claude/skills/"
echo ""
echo "Or test the binary directly:"
echo "  $OUTPUT_FILE"
#!/bin/bash

# Install script for Pomodoro CLI skill
# This script copies the built skill to the Claude skills directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installing Pomodoro CLI skill...${NC}"

# Get the directory where this script is located (project root)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source and destination paths
SOURCE_DIR="$PROJECT_ROOT/dist/skills/pomodoro"
DEST_DIR="$HOME/.claude/skills/pomodoro"
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"

# Check if the source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Distribution directory not found at $SOURCE_DIR${NC}"
    echo "Please run ./build.sh first to build the skill"
    exit 1
fi

# Create the Claude skills directory if it doesn't exist
if [ ! -d "$CLAUDE_SKILLS_DIR" ]; then
    echo -e "${YELLOW}Creating Claude skills directory: $CLAUDE_SKILLS_DIR${NC}"
    mkdir -p "$CLAUDE_SKILLS_DIR"
fi

# Check if the destination already exists
if [ -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}Warning: Pomodoro skill is already installed at $DEST_DIR${NC}"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
    echo -e "${YELLOW}Removing existing installation...${NC}"
    rm -rf "$DEST_DIR"
fi

# Copy the skill to the Claude skills directory
echo -e "${YELLOW}Copying skill files...${NC}"
cp -r "$SOURCE_DIR" "$DEST_DIR"

# Verify installation
if [ -d "$DEST_DIR" ] && [ -f "$DEST_DIR/pomodoro" ] && [ -f "$DEST_DIR/SKILL.md" ]; then
    echo -e "${GREEN}✓ Pomodoro CLI skill installed successfully!${NC}"
    echo ""
    echo "Installation location: $DEST_DIR"
    echo ""
    echo "The skill is now available in Claude Code."
    echo "You can invoke it using the skill command in Claude Code."
else
    echo -e "${RED}✗ Installation failed: Files not found at destination${NC}"
    exit 1
fi

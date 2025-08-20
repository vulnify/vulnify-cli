#!/bin/bash

# Vulnify CLI Release Script
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 1.0.1

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if version is provided
if [ -z "$1" ]; then
    log_error "Version number is required!"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.1"
    exit 1
fi

VERSION=$1

# Validate version format (basic semver check)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_error "Invalid version format! Use semantic versioning (e.g., 1.0.1)"
    exit 1
fi

log_info "Starting release process for version $VERSION"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warning "You're not on the main branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Release cancelled"
        exit 0
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_error "You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Pull latest changes
log_info "Pulling latest changes..."
git pull origin main

# Run tests and build
log_info "Running build and tests..."
npm ci
npm run clean
npm run build

# Test CLI functionality
log_info "Testing CLI functionality..."
node dist/cli.js --version
node dist/cli.js help > /dev/null
log_success "CLI tests passed"

# Update package.json version
log_info "Updating package.json version to $VERSION..."
npm version $VERSION --no-git-tag-version

# Build again with new version
npm run build

# Show what will be published
log_info "Package contents that will be published:"
npm pack --dry-run

# Commit version change
log_info "Committing version change..."
git add package.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
log_info "Creating and pushing tag v$VERSION..."
git tag -a "v$VERSION" -m "Release version $VERSION"
git push origin main
git push origin "v$VERSION"

log_success "Release process completed!"
log_info "GitHub Actions will now:"
log_info "  1. Run tests on multiple Node.js versions"
log_info "  2. Build the project"
log_info "  3. Publish to NPM"
log_info "  4. Create a GitHub release"
log_info ""
log_info "Monitor the progress at: https://github.com/vulnify/vulnify-cli/actions"
log_info ""
log_success "Once published, users can install with: npm install -g vulnify"


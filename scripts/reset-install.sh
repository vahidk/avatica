#!/bin/bash
# Reset Avatica to first-install state.
#
# Useful for testing first-launch flow — including TestFlight builds, where
# the MAS sandbox container is a separate hierarchy from dev-build data.
#
# Projects in ~/Movies/Avatica are preserved. Delete that folder manually if
# you want a truly clean slate.

set -u

echo "Resetting Avatica local state..."

# Close any running instance (both dev and TestFlight)
killall Avatica 2>/dev/null || true
sleep 1

# Non-sandboxed dev install data
rm -rf "$HOME/Library/Application Support/avatica"
rm -rf "$HOME/Library/Caches/com.avatica.app"
rm -rf "$HOME/Library/Caches/com.avatica.app.ShipIt"
rm -f  "$HOME/Library/Preferences/com.avatica.app.plist"
rm -rf "$HOME/Library/WebKit/com.avatica.app"
rm -rf "$HOME/Library/Saved Application State/com.avatica.app.savedState"

# MAS sandbox container (TestFlight + App Store builds keep everything here)
rm -rf "$HOME/Library/Containers/com.avatica.app"
rm -rf "$HOME/Library/Group Containers/com.avatica.app"

# Reset TCC permissions — app re-prompts for Movies/Files/Microphone/etc. on next launch
tccutil reset All com.avatica.app 2>/dev/null || true

echo "Done. ~/Movies/Avatica is preserved — delete manually for a fully empty workspace."

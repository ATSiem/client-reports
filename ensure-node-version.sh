#!/usr/bin/env bash

# Get the required Node.js version from package.json
REQUIRED_NODE_VERSION=$(node -e "console.log(require('./package.json').engines.node.replace(/[^0-9.]/g, ''))")

# Get the current Node.js version
CURRENT_NODE_VERSION=$(node -v | sed 's/v//')

# Function to compare versions
version_comparison() {
  if [[ $1 == $2 ]]; then
    return 0
  fi
  local IFS=.
  local i ver1=($1) ver2=($2)
  for ((i=0; i<${#ver1[@]} || i<${#ver2[@]}; i++)); do
    local v1=${ver1[i]:-0}
    local v2=${ver2[i]:-0}
    if ((10#$v1 > 10#$v2)); then
      return 1
    elif ((10#$v1 < 10#$v2)); then
      return 2
    fi
  done
  return 0
}

# Compare versions
version_comparison "$CURRENT_NODE_VERSION" "$REQUIRED_NODE_VERSION"
RESULT=$?

if [[ $RESULT == 2 ]]; then
  echo "Error: Node.js version $CURRENT_NODE_VERSION is lower than the required version $REQUIRED_NODE_VERSION"
  echo "Please update your Node.js version to $REQUIRED_NODE_VERSION or higher"
  exit 1
else
  echo "Node.js version check passed. Using version $CURRENT_NODE_VERSION"
fi 
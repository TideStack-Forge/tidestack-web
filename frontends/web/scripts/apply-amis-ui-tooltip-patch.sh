#!/bin/bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$(cd "$script_dir/.." && pwd)"
patch_file="$frontend_dir/patches/amis-ui.patch"
package_dir="${1:-$frontend_dir/main-app/node_modules/amis-ui}"
tooltip_target_file="$package_dir/lib/components/TooltipWrapper.js"

if [ ! -f "$patch_file" ]; then
  echo "amis-ui tooltip patch not found: $patch_file" >&2
  exit 1
fi

if [ ! -f "$tooltip_target_file" ]; then
  echo "amis-ui TooltipWrapper not found: $tooltip_target_file" >&2
  exit 1
fi

if grep -q 'handleTargetClick' "$tooltip_target_file"; then
  echo "amis-ui tooltip patch already applied"
  exit 0
fi

(cd "$package_dir" && patch -N -p1 < "$patch_file") || true

if ! grep -q 'handleTargetClick' "$tooltip_target_file"; then
  echo "amis-ui tooltip patch verification failed" >&2
  exit 1
fi

echo "amis-ui tooltip patch applied"

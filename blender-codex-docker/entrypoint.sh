#!/bin/bash
set -euo pipefail

host_project_dir="${BLENDER_PROJECT_DIR:-}"
case "$host_project_dir" in
    /*|[A-Za-z]:/*|[A-Za-z]:\\*) ;;
    *)
        printf '%s\n' 'Set BLENDER_PROJECT_DIR to an absolute host path in .env.' >&2
        exit 1
        ;;
esac
if [[ "$host_project_dir" == *REPLACE/WITH* ]]; then
    printf '%s\n' 'Replace BLENDER_PROJECT_DIR in .env with your work folder host path.' >&2
    exit 1
fi

codex_state_dir=/home/node/.codex
active_config="$codex_state_dir/config.toml"
default_config=/opt/blender-docker/config.default.toml

if ! mkdir -p -- "$codex_state_dir" /workspace/.mcp-tmp; then
    printf '%s\n' 'Cannot prepare Codex state or the workspace. Check volume ownership and LOCAL_UID/LOCAL_GID.' >&2
    exit 1
fi

# Seed only a missing or empty config. Existing settings, trust, and auth stay
# in the named volume. Codex can atomically replace this regular file later.
if [[ ! -s "$active_config" ]]; then
    config_seed_path="$(mktemp "$codex_state_dir/config.toml.init.XXXXXX")"
    trap 'rm -f -- "$config_seed_path"' EXIT
    cat -- "$default_config" > "$config_seed_path"
    chmod 600 "$config_seed_path"
    mv -f -- "$config_seed_path" "$active_config"
    trap - EXIT
fi

if (( $# == 0 )); then
    set -- /bin/bash
fi
exec "$@"

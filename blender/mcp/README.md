# Blender MCP bridge for DeepSeek Harness

DeepSeek Harness is the agent host. This small container provides only the pinned Blender MCP 1.9.1 Python server and host/container screenshot-path adapter. It contains no agent CLI, model configuration, login setup, or authentication volume. Blender itself runs on your desktop and uses its normal graphics hardware.

## Build

From the repository root, with Docker available:

```sh
docker build \
  --build-arg LOCAL_UID="$(id -u)" \
  --build-arg LOCAL_GID="$(id -g)" \
  -t personal-site-blender-mcp:1.9.1 blender/mcp
```

On Docker Desktop, omit the UID/GID arguments to use the default 1000:1000. Only the files in this directory enter the build context; Blender scenes, credentials, renders and checkpoints are not baked into the image.

## Connect through Harness

1. Open `blender/scene/lantern_lane.blend` in your existing desktop Blender. Enable the matching Blender MCP add-on and start its listener on port 9876. Keep a 3D Viewport open.
2. Merge the `mcp-blender` entry from [harness.patch.example.yml](harness.patch.example.yml) into your **local** Harness profile's `cordis.patch.yml`, usually under `~/.dsh/profiles/web/`. Replace the absolute project placeholder in both the environment variable and volume mount. If that entry already exists, update it instead of adding a second one. Keep unrelated profile settings and privacy choices unchanged.
3. Build the image before switching the connector. A profile with `patchReload: live` reloads the changed connector; otherwise restart Harness. Do not launch a second MCP server alongside the managed connection.
4. Use Harness's connected Blender tools to check scene information and capture a viewport screenshot. All Blender edits still occur in the existing host Blender process.

The example preserves non-root execution, dropped Linux capabilities, `no-new-privileges`, a process limit, Blender safe mode and disabled server telemetry. The only mounted folder is this repository's `blender/` workspace. There is no home-directory or Docker-socket mount. Outbound network access is not blocked. These are container protections, **not** an OS sandbox around the separate host Blender process; retain the user's Blender add-on safety and telemetry choices.

The example uses Linux host networking so the container can reach Blender's loopback listener. On Docker Desktop, use `BLENDER_HOST=host.docker.internal` and the network mode supported by your host/add-on binding; do not assume a bridge network can reach a Linux loopback-only listener. No GPU passthrough is required.

## Paths and outputs

The container sees the project as `/workspace`. `BLENDER_PROJECT_DIR` must be the corresponding **absolute host** `blender/` directory. `mcp_bridge.py` translates only screenshot cache paths between these locations; it does not rewrite import, export, render or arbitrary Python paths. Host Blender should use the confirmed `.blend` location and relative paths such as `//../renders/`.

- Canonical editable scene: `blender/scene/lantern_lane.blend`.
- Render outputs: `blender/renders/` (ignored).
- Recovery copies: `blender/.checkpoints/` (ignored).
- Screenshot transport cache: `blender/.mcp-tmp/` (ignored).

Machine-local Harness profiles, model settings and credentials stay outside this repository. Normal website development uses the published assets and does not require this container or Blender.

## Optional maintenance helpers

`export_addon.py` exports the matching add-on bundled with the installed server. For example, from the repository root:

```sh
docker run --rm \
  --cap-drop=ALL --security-opt=no-new-privileges:true \
  --volume="$PWD/blender:/workspace" \
  --entrypoint=python personal-site-blender-mcp:1.9.1 \
  /opt/blender-mcp/export_addon.py
```

Install the ignored `blender/blender_mcp_addon.py` in Blender through **Preferences > Add-ons > Install from Disk**. The helper refuses to overwrite an existing exported file.

`check.py` is an optional standalone MCP round-trip checker. Use it only when the Harness-managed connector is disconnected, with the same environment/network/mount options as the profile and `python /opt/blender-mcp/check.py` as the container command. It reads the scene and captures a screenshot without changing geometry, then writes `blender/renders/review/mcp/connection-check.png`. Prefer the existing Harness tools during ordinary work.

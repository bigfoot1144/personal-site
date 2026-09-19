# Local Blender + Dockerized Codex + GPT-6 Astra

Prepared September 13, 2026. This kit uses the community project [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp), with Codex CLI 0.154.0 and Blender MCP 1.9.1 pinned in the Dockerfile.

Updated to open Bash by default and store the active Codex configuration in a writable named volume. Existing users can follow `UPGRADE.md`.

| Component | Where it runs |
| --- | --- |
| Codex CLI and the Blender MCP Python server | One local Docker container |
| Blender GUI, add-on, Python scene operations, and rendering | Your existing desktop Blender |
| GPT-6 Astra inference | OpenAI's service |
| Project files | This kit's `work` folder, mounted at `/workspace` |

Blender continues using your computer's normal graphics configuration. The container does not need a GPU.

## What the sandbox covers

The container runs as a non-root user, drops Linux capabilities, and mounts one project folder plus a dedicated Codex state volume. The host home directory and Docker socket are not mounted. Outbound network access is available for authentication and model requests. This is not an egress-restricted sandbox.

**Blender itself remains outside Docker.** Its add-on runs Python with Blender's host-user permissions. The included safe-mode setting checks scripts, and Codex prompts for `execute_blender_code` calls, but neither creates an OS sandbox around Blender. For isolation of Blender operations as well, run Blender in an isolated VM or container and share only the project folder.

The `danger-full-access` setting in this kit turns off Codex's inner shell sandbox because Docker provides that boundary. It applies to this container's Codex configuration. OpenAI documents this container pattern; it avoids needing extra privileges for nested `bwrap`. See [Codex sandbox guidance](https://learn.chatgpt.com/docs/agent-approvals-security).

## 1. Prepare the folder and Docker

Install/start Docker Desktop on Windows or macOS, or Docker Engine with the Compose plugin on Linux. On Windows use Linux containers. These commands assume a local Docker engine, not a remote Docker context.

Extract the entire kit, then open a terminal in its `blender-codex-docker` folder. On Windows, use PowerShell for these steps and keep the project on the Windows filesystem when Blender is a Windows application.

Check Docker:

```sh
docker version
docker compose version
```

Make a `.env` file by copying `.env.example`. On macOS/Linux:

```sh
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `BLENDER_PROJECT_DIR` to the absolute path of the extracted kit's **work subfolder**, as your host Blender sees it. Leave quotes around paths with spaces. Use forward slashes on Windows.

| Host setup | Example `BLENDER_PROJECT_DIR` | `BLENDER_HOST` | `DOCKER_NETWORK_MODE` |
| --- | --- | --- | --- |
| macOS + Docker Desktop | `/Users/alex/blender-codex-docker/work` | `host.docker.internal` | `bridge` |
| Windows + Docker Desktop | `C:/Users/alex/blender-codex-docker/work` | `host.docker.internal` | `bridge` |
| Linux + native Docker Engine | `/home/alex/blender-codex-docker/work` | `127.0.0.1` | `host` |

For native Linux, also set `LOCAL_UID` and `LOCAL_GID` to the values printed by `id -u` and `id -g` before building. The Linux host-network choice reaches the add-on's loopback listener, but it shares the host network namespace. File and process isolation remain. Merely adding a `host-gateway` alias does not make a Linux loopback-only listener reachable. See [Docker host networking](https://docs.docker.com/engine/network/drivers/host/) and the upstream project's Docker instructions.

## 2. Build and install the matching Blender add-on

```sh
docker compose build
docker compose run --rm codex python /opt/blender-docker/export_addon.py
```

The second command places `blender_mcp_addon.py` in `work`. It exports the copy bundled with the installed MCP package, so the server and add-on match. It refuses to overwrite an existing exported file.

In local Blender, open **Edit > Preferences > Add-ons**, use **Install from Disk** or **Install** depending on your Blender version, and choose `work/blender_mcp_addon.py`. Enable **MCP for Blender**. In the 3D Viewport press **N**, open its MCP tab, and start the server on port **9876**. Some releases label the button **Connect to Claude**; it starts the same socket listener.

Leave a 3D Viewport editor open. Leave optional asset services off for the first check. This kit sets `DISABLE_TELEMETRY=true` for the MCP process; also switch off telemetry consent in the add-on preferences if you want it off in Blender. The [upstream setup](https://github.com/ahujasid/blender-mcp#installing-the-blender-addon) describes those controls.

## 3. Test the connection and viewport image

With Blender running:

```sh
docker compose run --rm codex python /opt/blender-docker/check.py
```

This starts the real MCP server, initializes an MCP client, requests scene information, and requests a viewport screenshot. It does not call Astra or edit scene geometry. Success prints `PASS` and creates `work/connection-check.png`. Open that image and confirm it shows your viewport.

The adapter is needed because the upstream screenshot tool asks Blender to write a PNG and then reads that PNG from the MCP server's own filesystem. The adapter maps `/workspace/.mcp-tmp/...` to the corresponding host path, including Windows drive-letter paths. This conclusion follows from the [upstream screenshot implementation](https://github.com/ahujasid/blender-mcp/blob/main/src/blender_mcp/server.py). The same bind mount makes the resulting file available to both processes.

## 4. Open Bash, sign in, and start Astra

```sh
docker compose run --rm codex
```

This opens Bash in `/workspace`. On native Linux, if the network settings are not yet in `.env`, use:

```sh
env DOCKER_NETWORK_MODE=host BLENDER_HOST=127.0.0.1 docker compose run --rm codex
```

Inside the container, sign in if needed and launch Codex:

```sh
codex login --device-auth
codex -C . -m gpt-6-astra
```

Follow the browser link and enter the one-time login code. Device login may need enabling in your ChatGPT security settings or by your workspace administrator. The dedicated `codex-state` Docker volume keeps login state between runs. An existing signed-in user can go straight to the second command. See [authentication](https://learn.chatgpt.com/docs/auth) and the official [Astra model command](https://learn.chatgpt.com/docs/models).

`codex` on its own also works from `/workspace`. The `-C .` option explicitly chooses the current working directory. A bare `codex .` passes the dot as an initial prompt. See the [CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli).

When asked whether you trust `/workspace`, choose the appropriate answer. Trust decisions and settings are saved in `/home/node/.codex/config.toml`, a regular writable file in the state volume. The host `config.toml` supplies initial defaults through `/opt/blender-docker/config.default.toml`; startup copies it only when the active config is missing or empty. To change settings after initialization, edit the active file inside the container or use Codex's settings commands.

Explicit container commands still work, for example `docker compose run --rm codex codex login status` or the checker from step 3.

If device login is unavailable, the authentication documentation provides a local browser-login and auth-cache-copy fallback. If your account cannot select Astra, check its model access and workspace policy. MCP configuration cannot grant model access.

Inside Codex, type `/mcp` to confirm that `blender` is connected. The included `config.toml` sets Astra with high reasoning effort, registers the adapter as a stdio MCP server, and configures the Blender tool policy. See [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

The hosted ChatGPT page does not read the container's local configuration. Use the Codex CLI running in this container for this workflow.

## 5. First task

Start with a fresh Blender scene or save a copy of an existing project. Give Codex this instruction:

Inspect the current Blender scene and take a viewport screenshot. Read BLENDER_PROJECT_DIR from your environment. Create a collection named MCP_Test with a beveled metallic orange cube, a matte ground plane, a camera, and three area lights. Preserve other collections. Frame the new collection and inspect a screenshot. Save a new test_scene.blend in BLENDER_PROJECT_DIR without overwriting an existing file.

Shell paths and Blender paths differ. Codex sees `/workspace/test_scene.blend`; Blender needs the host path from `BLENDER_PROJECT_DIR`. The adapter translates viewport screenshot paths only. Import, export, and render paths inside Python must use host paths. `work/AGENTS.md` reminds Codex of this distinction.

## 6. Use a staged creative workflow

Build the main shapes and camera framing first. Then add reusable geometry, materials, lighting, and finally animation. Ask for a screenshot or inexpensive render between stages and save numbered `.blend` checkpoints. Request explicit units, named collections, reusable instances, and deterministic seeds when useful.

A good first scene is a rain-soaked retro-futurist observatory: a copper telescope, warm interior, cool exterior, modular shelves, plants, wet window glass, and an eight-second camera push. Review the silhouette and camera before adding small details. Start with a low-resolution preview before a full Cycles render.

After the basic setup works, the upstream plugin's optional asset integrations can add HDRIs, textures, and models. Check each integration's own setup and licensing. The adapter and checker in this kit cover the scene/screenshot workflow; external asset-service workflows have not been validated here.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Failed to persist `config.toml` when trusting `/workspace` | Apply the updated `compose.yaml`, `Dockerfile`, `entrypoint.sh`, and `.dockerignore`, then rebuild and start a new container. The active config must be a regular file in the writable state volume. See `UPGRADE.md`. |
| Connection refused | Start the add-on server in Blender. Match `BLENDER_PORT` to the sidebar port. |
| Native Linux cannot reach Blender | Use `DOCKER_NETWORK_MODE=host` and `BLENDER_HOST=127.0.0.1`. |
| Docker Desktop host connection fails | Check VPN/firewall handling of Docker. A fallback is Desktop 4.34+ with Settings > Resources > Network > Enable host networking, then the same two settings as Linux. This shares host networking and is incompatible with Enhanced Container Isolation. |
| Scene information works but screenshot fails | Verify `BLENDER_PROJECT_DIR` is the exact host path of this kit's `work` directory and that Docker shares this folder. |
| No 3D viewport / blank capture | Keep Blender's normal GUI and a 3D Viewport editor open. Keep Blender visible if it falls back to a window screenshot. |
| Permission denied under `/workspace` on Linux | Fix `LOCAL_UID`/`LOCAL_GID`, rebuild, and check ownership of the host `work` folder. |
| Long render times out | The underlying Blender connection also has an approximately 180-second timeout. Increasing only Codex's tool timeout does not remove it. Reduce preview resolution or split work. Check whether Blender is still busy before retrying. |
| Safe mode rejects generated Python | Have Codex rewrite it using allowed Blender operations. Safe mode is a script filter, not a host security boundary. |
| `/mcp` has no Blender entry | Confirm you launched this kit's container command, rather than another Codex installation on the host. |

Exit Codex to return to Bash, then run `exit` to leave the container. `--rm` removes the temporary container; project files and the named state volume remain. Stop the add-on listener in Blender when the session is finished.

## Verification performed for this kit

The original TOML/YAML and Python files were parsed, host-path mapping was checked for macOS/Linux/Windows including spaces, and the installed Blender MCP 1.9.1 screenshot implementation was exercised with a simulated host response. The bundled add-on and required MCP interfaces were checked. For this update, Bash syntax, initial config seeding, preservation of existing config/auth, atomic config replacement, and command forwarding were checked in temporary directories. Docker and Blender were not available in the authoring environment, so no Docker build or real desktop/GPU round trip was run here. Step 3 is the check to run on your computer.

See `IDEAS.md` for linked demos and project ideas.

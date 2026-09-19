"""Launch upstream Blender MCP with a host/container screenshot-path adapter.

Upstream asks Blender to write a screenshot, then reads that file locally.
Both paths must refer to the same bind-mounted file. Only the filepath of
get_viewport_screenshot is rewritten. Blender scripts still use host paths.
"""

import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import tempfile


CACHE_DIR = Path("/workspace/.mcp-tmp")


def host_screenshot_path(container_path, host_project_dir):
    """Translate one cache filepath without altering Python or other tool args."""
    path = PurePosixPath(container_path)
    if ".." in path.parts:
        raise ValueError("Screenshot path must not contain parent traversal.")
    relative = path.relative_to(PurePosixPath(str(CACHE_DIR)))
    if not relative.parts:
        raise ValueError("Screenshot path must name a file.")
    if PureWindowsPath(host_project_dir).is_absolute():
        host_root = PureWindowsPath(host_project_dir)
        return (host_root / ".mcp-tmp" / PureWindowsPath(*relative.parts)).as_posix()
    host_root = PurePosixPath(host_project_dir)
    if not host_root.is_absolute():
        raise ValueError("BLENDER_PROJECT_DIR must be an absolute host path.")
    return str(host_root / ".mcp-tmp" / relative)


def install_path_mapping(connection_class, host_project_dir):
    original = connection_class.send_command

    def send_command(self, command_type, params=None):
        if command_type == "get_viewport_screenshot" and params and params.get("filepath"):
            params = dict(params)
            params["filepath"] = host_screenshot_path(params["filepath"], host_project_dir)
        return original(self, command_type, params)

    connection_class.send_command = send_command


def main():
    host_root = os.environ["BLENDER_PROJECT_DIR"]
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(CACHE_DIR)
    tempfile.tempdir = str(CACHE_DIR)
    from blender_mcp import server

    install_path_mapping(server.BlenderConnection, host_root)
    server.main()


if __name__ == "__main__":
    main()

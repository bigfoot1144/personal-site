"""Export the addon bundled with the installed server so the versions match."""

from importlib.resources import files
from pathlib import Path


destination = Path("/workspace/blender_mcp_addon.py")
if destination.exists():
    raise SystemExit("blender/blender_mcp_addon.py already exists. Rename it before exporting another copy.")
source = files("blender_mcp").joinpath("bundled", "addon.py")
destination.write_bytes(source.read_bytes())
print("Exported blender/blender_mcp_addon.py. Install this file in your local Blender.")

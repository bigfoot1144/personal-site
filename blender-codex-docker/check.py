"""Check the actual MCP connection and screenshot round trip without an AI call."""

import asyncio
import base64
from datetime import timedelta
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(Path(__file__).with_name("mcp_bridge.py"))],
        env=dict(os.environ),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=180)) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}
            for required in ("get_scene_info", "get_viewport_screenshot"):
                if required not in names:
                    raise RuntimeError(f"MCP tool missing: {required}")
            print("MCP initialized; scene and screenshot tools are available.")
            scene = await session.call_tool("get_scene_info", {
                "user_prompt": "Verify the Blender connection without changing the scene."
            })
            scene_text = "\n".join(getattr(item, "text", "") for item in scene.content)
            if scene.isError or scene_text.startswith("Error"):
                raise RuntimeError(scene_text)
            print("Scene response:", scene_text)
            screenshot = await session.call_tool("get_viewport_screenshot", {
                "max_size": 800,
                "user_prompt": "Verify the Blender viewport screenshot connection."
            })
            if screenshot.isError:
                raise RuntimeError(str(screenshot.content))
            for item in screenshot.content:
                if item.type == "image":
                    image_bytes = base64.b64decode(item.data, validate=True)
                    if not image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
                        raise RuntimeError("Screenshot response was not PNG data.")
                    path = Path("/workspace/connection-check.png")
                    path.write_bytes(image_bytes)
                    print("PASS: viewport image received. Open work/connection-check.png on the host.")
                    return
            raise RuntimeError("The screenshot tool returned no image.")


if __name__ == "__main__":
    asyncio.run(main())

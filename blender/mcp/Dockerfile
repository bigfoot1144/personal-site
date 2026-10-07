FROM python:3.11-slim-bookworm

ARG BLENDER_MCP_VERSION=1.9.1
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000

RUN pip install --no-cache-dir "blender-mcp==${BLENDER_MCP_VERSION}" \
    && groupadd --gid "${LOCAL_GID}" blender \
    && useradd --uid "${LOCAL_UID}" --gid "${LOCAL_GID}" --create-home blender \
    && mkdir -p /workspace \
    && chown blender:blender /workspace

COPY mcp_bridge.py check.py export_addon.py /opt/blender-mcp/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DISABLE_TELEMETRY=true \
    BLENDER_MCP_SAFE_MODE=1

USER blender
WORKDIR /workspace
ENTRYPOINT ["python", "/opt/blender-mcp/mcp_bridge.py"]

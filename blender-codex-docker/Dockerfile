FROM node:22-bookworm-slim

ARG CODEX_VERSION=0.154.0
ARG BLENDER_MCP_VERSION=1.9.1
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates git python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g "@openai/codex@${CODEX_VERSION}" \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir "blender-mcp==${BLENDER_MCP_VERSION}"

RUN if [ "${LOCAL_GID}" != "$(id -g node)" ]; then groupmod -g "${LOCAL_GID}" node; fi \
    && if [ "${LOCAL_UID}" != "$(id -u node)" ]; then usermod -u "${LOCAL_UID}" node; fi \
    && mkdir -p /home/node/.codex /workspace \
    && chown -R node:node /home/node /workspace

COPY entrypoint.sh mcp_bridge.py check.py export_addon.py /opt/blender-docker/
COPY config.toml /opt/blender-docker/config.default.toml

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DISABLE_TELEMETRY=true \
    BLENDER_MCP_SAFE_MODE=1 \
    TERM=xterm-256color

USER node
WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "/opt/blender-docker/entrypoint.sh"]
CMD ["/bin/bash"]

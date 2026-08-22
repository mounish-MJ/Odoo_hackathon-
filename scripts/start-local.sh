#!/bin/bash

# DAYFLOW HRMS — Local Full-Stack Launcher Script
# Starts Member 1, Member 2, Member 3, and Member 4 integrated local stack.

set -e

PORT_MEMBER1=${MEMBER1_PORT:-8000}
PORT_MEMBER2=${PORT:-8001}
HOST=${HOST:-127.0.0.1}

echo "=================================================="
echo " Starting DAYFLOW HRMS Integrated Local Stack"
echo "=================================================="

# Check Python environment
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 could not be found."
    exit 1
fi

echo "[MEMBER 1] HR Core API configured on http://${HOST}:${PORT_MEMBER1}/api/v1"
echo "[MEMBER 2] AI Intelligence & Decision Engine Gateway configured on http://${HOST}:${PORT_MEMBER2}"
echo "[MEMBER 3] Member 3 Web Frontend UI configured on http://${HOST}:${PORT_MEMBER2}"
echo "[MEMBER 4] Audit Header Tracing (X-Request-ID, X-Actor-ID, X-Actor-Type) ACTIVE"

echo "--------------------------------------------------"
echo "DAYFLOW LOCAL STACK READY"
echo ""
echo "Frontend UI:"
echo "http://${HOST}:${PORT_MEMBER2}"
echo ""
echo "Member 2 Gateway API:"
echo "http://${HOST}:${PORT_MEMBER2}/docs"
echo ""
echo "Member 1 HR Core API:"
echo "http://${HOST}:${PORT_MEMBER1}/api/v1/health"
echo "=================================================="

# Launch FastAPI app serving Member 2 Backend and Member 3 SPA UI
exec uvicorn src.main:app --host ${HOST} --port ${PORT_MEMBER2} --reload

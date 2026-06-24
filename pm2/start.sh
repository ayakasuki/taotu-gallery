#!/bin/bash
# 图库与智能索引集成系统 — 一键启动/停止脚本
# 用法: ./pm2/start.sh [start|stop|restart|status|logs]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PM2_CONFIG="$SCRIPT_DIR/pm2.json"

case "${1:-start}" in
  start)
    echo "启动图库索引系统..."
    # 确保前端已构建
    if [ ! -d "$PROJECT_DIR/client/dist" ]; then
      echo "前端未构建，正在构建..."
      cd "$PROJECT_DIR/client" && npx nuxt generate
    fi
    cd "$PROJECT_DIR" && pm2 start "$PM2_CONFIG"
    echo ""
    echo "启动完成！访问: http://localhost:7067"
    ;;
  stop)
    echo "停止图库索引系统..."
    cd "$PROJECT_DIR" && pm2 stop "$PM2_CONFIG"
    ;;
  restart)
    echo "重启图库索引系统..."
    cd "$PROJECT_DIR" && pm2 restart "$PM2_CONFIG"
    ;;
  status)
    pm2 list
    ;;
  logs)
    pm2 logs --lines 50
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac

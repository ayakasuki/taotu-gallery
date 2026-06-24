const fs = require('fs');
const https = require('https');
const http = require('http');
const app = require('./app');
const logger = require('./config/logger');
const configService = require('./services/configService');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const siteConfig = await configService.readSiteConfig();
    const httpsConfig = siteConfig.https || {};

    if (httpsConfig.enabled && httpsConfig.certPath && httpsConfig.keyPath) {
      // HTTPS 模式
      try {
        const cert = fs.readFileSync(httpsConfig.certPath);
        const key = fs.readFileSync(httpsConfig.keyPath);

        https.createServer({ cert, key }, app).listen(PORT, () => {
          logger.info(`HTTPS 服务已启动，监听端口 ${PORT}`);
          logger.info(`证书: ${httpsConfig.certPath}`);
        });
      } catch (certErr) {
        logger.error(`HTTPS 启动失败（证书读取错误），回退到 HTTP: ${certErr.message}`);
        http.createServer(app).listen(PORT, () => {
          logger.info(`HTTP 服务已启动（HTTPS 回退），监听端口 ${PORT}`);
        });
      }
    } else {
      // HTTP 模式
      http.createServer(app).listen(PORT, () => {
        logger.info(`HTTP 服务已启动，监听端口 ${PORT}`);
      });
    }

    logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    logger.error(`服务启动失败: ${err.message}`);
    process.exit(1);
  }
}

startServer();

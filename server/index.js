require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const https = require('https');
const http = require('http');
const logger = require('./config/logger');
const { bootstrap } = require('./services/startupService');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await bootstrap();

    const app = require('./app');
    const configService = require('./services/configService');
    const siteConfig = await configService.readSiteConfig();
    const httpsConfig = siteConfig.https || {};

    if (httpsConfig.enabled && httpsConfig.certPath && httpsConfig.keyPath) {
      try {
        const cert = fs.readFileSync(httpsConfig.certPath);
        const key = fs.readFileSync(httpsConfig.keyPath);

        https.createServer({ cert, key }, app).listen(PORT, () => {
          logger.info('HTTPS 服务已启动，监听端口 ' + PORT);
          logger.info('证书: ' + httpsConfig.certPath);
        });
      } catch (certErr) {
        logger.error('HTTPS 启动失败（证书读取错误），回退到 HTTP: ' + certErr.message);
        http.createServer(app).listen(PORT, () => {
          logger.info('HTTP 服务已启动（HTTPS 回退），监听端口 ' + PORT);
        });
      }
    } else {
      http.createServer(app).listen(PORT, () => {
        logger.info('HTTP 服务已启动，监听端口 ' + PORT);
      });
    }

    logger.info('环境: ' + (process.env.NODE_ENV || 'development'));
  } catch (err) {
    logger.error('服务启动失败: ' + err.message);
    process.exit(1);
  }
}

startServer();

const nodemailer = require('nodemailer');
const configService = require('./configService');

function buildTransport(smtp = {}) {
  if (!smtp.host || !smtp.port) {
    const err = new Error('SMTP 未配置');
    err.statusCode = 400;
    throw err;
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: parseInt(smtp.port),
    secure: !!smtp.secure,
    auth: smtp.username ? { user: smtp.username, pass: smtp.password || '' } : undefined
  });
}

async function sendMail({ to, subject, text, html }) {
  const siteConfig = await configService.readSiteConfig();
  const smtp = siteConfig.smtp || {};
  const transporter = buildTransport(smtp);
  const from = smtp.from || smtp.username;
  if (!from) {
    const err = new Error('SMTP 发件人未配置');
    err.statusCode = 400;
    throw err;
  }
  return transporter.sendMail({ from, to, subject, text, html });
}

async function sendVerificationCode(email, code) {
  const siteConfig = await configService.readSiteConfig();
  const siteName = siteConfig.siteName || '桃图智库';
  return sendMail({
    to: email,
    subject: siteName + ' 注册验证码',
    text: '你的注册验证码是：' + code + '。验证码 2 分钟内有效。',
    html: '<p>你的注册验证码是：</p><h2>' + code + '</h2><p>验证码 2 分钟内有效。</p>'
  });
}

async function sendPasswordResetCode(email, code) {
  const siteConfig = await configService.readSiteConfig();
  const siteName = siteConfig.siteName || '桃图智库';
  return sendMail({
    to: email,
    subject: siteName + ' 密码重置验证码',
    text: '你的密码重置验证码是：' + code + '。验证码 2 分钟内有效。如非本人操作，请忽略此邮件。',
    html: '<p>你的密码重置验证码是：</p><h2>' + code + '</h2><p>验证码 2 分钟内有效。如非本人操作，请忽略此邮件。</p>'
  });
}

async function testSmtp(to) {
  return sendMail({
    to,
    subject: 'SMTP 测试邮件',
    text: '这是一封来自桃图智库的 SMTP 配置测试邮件。',
    html: '<p>这是一封来自桃图智库的 SMTP 配置测试邮件。</p>'
  });
}

module.exports = { sendMail, sendVerificationCode, sendPasswordResetCode, testSmtp };

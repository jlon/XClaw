const baseConfig = require('./electron-builder.config.cjs');

module.exports = {
  ...baseConfig,
  win: {
    ...baseConfig.win,
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
};

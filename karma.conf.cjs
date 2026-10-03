const fs = require('node:fs');

// Respect CI/user choice; the host Chrome fallback avoids downloading a second browser.
if (!process.env.CHROME_BIN && fs.existsSync('/opt/google/chrome/chrome')) {
  process.env.CHROME_BIN = '/opt/google/chrome/chrome';
}

module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: { clearContext: false, jasmine: { random: false } },
    reporters: ['progress'],
    browsers: ['ChromeHeadlessLocal'],
    customLaunchers: {
      ChromeHeadlessLocal: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']
      }
    },
    singleRun: true,
    browserNoActivityTimeout: 60000,
    captureTimeout: 120000,
    concurrency: 1
  });
};

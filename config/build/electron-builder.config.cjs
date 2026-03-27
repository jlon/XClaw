const branding = require('../release-branding.json');
const updateFeeds = require('./update-feeds.json');

module.exports = {
  appId: branding.appId,
  productName: branding.productName,
  copyright: `Copyright © 2026 ${branding.copyrightOwner}`,
  compression: 'maximum',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  directories: {
    output: 'release',
    buildResources: 'resources',
  },
  files: [
    'dist',
    'dist-electron',
    'package.json'
  ],
  extraResources: [
    {
      from: 'resources/',
      to: 'resources/',
      filter: ['**/*', '!icons/*.md', '!icons/*.svg', '!bin/**', '!screenshot/**'],
    },
  ],
  afterPack: './scripts/after-pack.cjs',
  asar: true,
  asarUnpack: ['**/*.node'],
  npmRebuild: false,
  publish: [
    {
      provider: 'generic',
      url: `${updateFeeds.baseUrl}/${updateFeeds.channels.beta}`,
    },
  ],
  generateUpdatesFilesForAllChannels: true,
  mac: {
    extraResources: [
      { from: 'resources/bin/darwin-${arch}', to: 'bin' },
      { from: 'resources/cli/posix/', to: 'cli/' },
    ],
    category: 'public.app-category.productivity',
    icon: 'resources/icons/icon.icns',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'config/macos/entitlements.mac.plist',
    entitlementsInherit: 'config/macos/entitlements.mac.plist',
    notarize: true,
    extendInfo: {
      NSMicrophoneUsageDescription: `${branding.productName} requires microphone access for voice features`,
      NSCameraUsageDescription: `${branding.productName} requires camera access for video features`,
    },
  },
  dmg: {
    background: 'resources/dmg-background.png',
    icon: 'resources/icons/icon.icns',
    iconSize: 100,
    window: { width: 540, height: 380 },
    contents: [
      { type: 'file', x: 130, y: 220 },
      { type: 'link', path: '/Applications', x: 410, y: 220 },
    ],
  },
  win: {
    verifyUpdateCodeSignature: false,
    extraResources: [
      { from: 'resources/bin/win32-${arch}', to: 'bin' },
      { from: 'resources/cli/win32/', to: 'cli/' },
    ],
    icon: 'resources/icons/icon.ico',
    target: [
      { target: 'nsis', arch: 'x64' },
      { target: 'nsis', arch: 'arm64' },
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    warningsAsErrors: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    differentialPackage: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: branding.productName,
    uninstallDisplayName: branding.productName,
    license: 'LICENSE',
    include: 'scripts/installer.nsh',
    installerIcon: 'resources/icons/icon.ico',
    uninstallerIcon: 'resources/icons/icon.ico',
  },
  linux: {
    extraResources: [
      { from: 'resources/bin/linux-${arch}', to: 'bin' },
      { from: 'resources/cli/posix/', to: 'cli/' },
    ],
    icon: 'resources/icons',
    target: [
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64'] },
    ],
    category: 'Utility',
    maintainer: `${branding.teamName} <${branding.maintainerEmail}>`,
    vendor: branding.vendor,
    synopsis: branding.synopsis,
    description: branding.description,
    desktop: {
      entry: {
        Name: branding.productName,
        Comment: branding.desktopComment,
        Categories: 'Utility;Network;',
        Keywords: 'ai;assistant;automation;chat;',
        StartupWMClass: branding.executableName,
      },
    },
  },
  appImage: {
    license: 'LICENSE',
  },
  deb: {
    depends: [
      'libgtk-3-0 | libgtk-3-0t64',
      'libnotify4 | libnotify4t64',
      'libnss3',
      'libxss1 | libxss1t64',
      'libxtst6 | libxtst6t64',
      'xdg-utils',
      'libatspi2.0-0 | libatspi2.0-0t64',
      'libuuid1',
    ],
    afterInstall: 'scripts/linux/after-install.sh',
    afterRemove: 'scripts/linux/after-remove.sh',
  },
};

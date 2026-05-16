const fs = require('fs');
const path = require('path');

const plistPath = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Info.plist'
);

if (!fs.existsSync(plistPath)) process.exit(0);

let plist = fs.readFileSync(plistPath, 'utf-8');
plist = plist.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
  '<key>CFBundleDisplayName</key>\n\t<string>Avatica</string>'
);
plist = plist.replace(
  /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
  '<key>CFBundleName</key>\n\t<string>Avatica</string>'
);
fs.writeFileSync(plistPath, plist);
console.log('Patched Electron.app Info.plist → Avatica');

// Copy app icon into Electron.app for dev mode
const icnsSrc = path.join(__dirname, '..', 'build', 'icon.icns');
const icnsDst = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Resources', 'electron.icns'
);
if (fs.existsSync(icnsSrc) && fs.existsSync(path.dirname(icnsDst))) {
  fs.copyFileSync(icnsSrc, icnsDst);
  console.log('Patched Electron.app icon');
}

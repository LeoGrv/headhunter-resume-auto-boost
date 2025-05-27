#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Автоматическое обновление версии расширения
 * Обновляет версию в package.json, manifest.json и popup.html
 */

function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function incrementVersion(version, type = 'patch') {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      parts[2]++;
      break;
  }
  
  return parts.join('.');
}

function updatePackageJson(newVersion) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ package.json обновлен до версии ${newVersion}`);
}

function updateManifest(newVersion) {
  const manifestPath = path.join(process.cwd(), 'public/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ manifest.json обновлен до версии ${newVersion}`);
}

function updatePopupHtml(newVersion) {
  const popupPath = path.join(process.cwd(), 'src/popup/popup.html');
  let content = fs.readFileSync(popupPath, 'utf8');
  
  // Обновляем версию в HTML
  const versionRegex = /v\d+\.\d+\.\d+/g;
  content = content.replace(versionRegex, `v${newVersion}`);
  
  fs.writeFileSync(popupPath, content);
  console.log(`✅ popup.html обновлен до версии ${newVersion}`);
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch'; // patch, minor, major
  
  console.log('🚀 Автоматическое обновление версии...');
  
  const currentVersion = getCurrentVersion();
  const newVersion = incrementVersion(currentVersion, versionType);
  
  console.log(`📋 Текущая версия: ${currentVersion}`);
  console.log(`📋 Новая версия: ${newVersion} (${versionType})`);
  
  try {
    updatePackageJson(newVersion);
    updateManifest(newVersion);
    updatePopupHtml(newVersion);
    
    console.log(`\n🎉 Версия успешно обновлена с ${currentVersion} до ${newVersion}!`);
    console.log(`\n📝 Следующие шаги:`);
    console.log(`   1. npm run build`);
    console.log(`   2. git add .`);
    console.log(`   3. git commit -m "🚀 Release v${newVersion}"`);
    console.log(`   4. git tag v${newVersion}`);
    console.log(`   5. git push && git push --tags`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении версии:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getCurrentVersion, incrementVersion, updatePackageJson, updateManifest, updatePopupHtml }; 
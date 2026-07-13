const fs = require('fs');
const path = require('path');

const directory = './src';

function replaceAlertsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('Alert.alert(')) return;

  // Add import statement at the top if it doesn't exist
  if (!content.includes("import { showCustomAlert } from '")) {
    // Calculate relative path to src/components/CustomAlert
    const depth = filePath.split(path.sep).length - 2; // -1 for src, -1 for filename
    let prefix = '../'.repeat(depth) || './';
    if (prefix === './' && filePath.includes('components')) {
      prefix = './';
    } else if (prefix === './') {
      prefix = './components/';
    } else {
      prefix += 'components/';
    }
    const importStmt = `import { showCustomAlert } from '${prefix}CustomAlert';\n`;
    
    // insert after the last react/react-native import
    const lines = content.split('\n');
    let lastImportIdx = 0;
    lines.forEach((line, i) => {
      if (line.startsWith('import ')) lastImportIdx = i;
    });
    
    lines.splice(lastImportIdx + 1, 0, importStmt);
    content = lines.join('\n');
  }

  // Replace Alert.alert( with showCustomAlert(
  content = content.replace(/Alert\.alert\(/g, 'showCustomAlert(');
  
  // Try to remove Alert from react-native imports
  content = content.replace(/,\s*Alert([,}])/g, '$1');
  content = content.replace(/Alert,\s*/g, '');
  content = content.replace(/import { Alert } from 'react-native';\n/, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js') && file !== 'CustomAlert.js') {
      replaceAlertsInFile(fullPath);
    }
  }
}

processDirectory(directory);
console.log('Done!');

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const oldDir = path.join(srcDir, 'features', 'core', 'jbwos');
const newDir = path.join(srcDir, 'features', 'core', 'youkan');

function copyDir(src, dest) {
	if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (let entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// 1. Youkanディレクトリへコピー
if (fs.existsSync(oldDir)) {
	console.log('Copying directory...');
	copyDir(oldDir, newDir);
	// 元のディレクトリをリネームなどでロックされがちなため、一旦置いておくか後で手動削除
} else if (!fs.existsSync(newDir)) {
	console.log('Old directory not found! Ensure we are in a clean state.');
	process.exit(1);
}

// 2. ファイル収集
function walk(dir, files) {
	const list = fs.readdirSync(dir);
	for (let file of list) {
		const filePath = path.join(dir, file);
		if (filePath.includes('node_modules') || filePath.includes('.git')) continue;
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			// Do not walk into old jbwos dir again since we copied it
			if (filePath === oldDir) continue;
			walk(filePath, files);
		} else {
			if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.json') || filePath.endsWith('.css') || filePath.endsWith('.php')) {
				files.push(filePath);
			}
		}
	}
	return files;
}

let allFiles = walk(srcDir, []);

// 3. リネームと置換
allFiles.forEach(file => {
	let currentPath = file;
	let fileName = path.basename(file);

	// Rename file if matches
	if (/jbwos/i.test(fileName)) {
		let newName = fileName.replace(/JBWOS/g, 'Youkan').replace(/jbwos/g, 'youkan').replace(/Jbwos/g, 'Youkan');
		let newPath = path.join(path.dirname(file), newName);
		if (currentPath !== newPath) {
			fs.renameSync(currentPath, newPath);
			currentPath = newPath;
			console.log(`Renamed: ${fileName} -> ${newName}`);
		}
	}

	// Replace content
	let content = fs.readFileSync(currentPath, 'utf8');
	if (/jbwos/i.test(content)) {
		let newContent = content.replace(/JBWOS/g, 'Youkan').replace(/jbwos/g, 'youkan').replace(/Jbwos/g, 'Youkan');
		if (newContent !== content) {
			fs.writeFileSync(currentPath, newContent, 'utf8');
			console.log(`Updated content: ${currentPath}`);
		}
	}
});
console.log('Done replacement. Now please manually delete old jbwos directory if not locked.');

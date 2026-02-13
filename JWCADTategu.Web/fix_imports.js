const fs = require('fs');
const path = require('path');

const projectRoot = String.raw`c:\Users\doorf\OneDrive\ドキュメント\プロジェクト\TateguDesignStudio\JWCADTategu.Web`;
const targetDir = path.join(projectRoot, 'src', 'features', 'core', 'jbwos', 'components');
const typesFile = path.join(projectRoot, 'src', 'features', 'core', 'jbwos', 'types.ts');

function walk(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let content = fs.readFileSync(filePath, 'utf8');

            // Calculate relative path from this file to typesFile
            let relativePath = path.relative(path.dirname(filePath), typesFile);
            // path.relative might return 'types.ts', convert to './types' or '../../types' etc.
            // and remove extension .ts
            relativePath = relativePath.replace(/\\/g, '/').replace('.ts', '');
            if (!relativePath.startsWith('.')) {
                relativePath = './' + relativePath;
            }

            // Target patterns to replace: any variation of ../types or types.ts
            const patterns = [
                /from ['"]\.\.\/types['"]/g,
                /from ['"]\.\.\/\.\.\/types['"]/g,
                /from ['"]\.\.\/\.\.\/\.\.\/types['"]/g,
                /from ['"]\.\.\/types\.ts['"]/g,
                /from ['"]\.\.\/\.\.\/types\.ts['"]/g,
                /from ['"]\.\.\/\.\.\/\.\.\/types\.ts['"]/g
            ];

            let changed = false;
            patterns.forEach(pattern => {
                if (pattern.test(content)) {
                    console.log(`Replacing in ${filePath}: ${pattern.source} -> ${relativePath}`);
                    content = content.replace(pattern, `from '${relativePath}'`);
                    changed = true;
                }
            });

            if (changed) {
                fs.writeFileSync(filePath, content, 'utf8');
            }
        }
    });
}

walk(targetDir);
console.log('Done.');

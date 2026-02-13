const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'JWCADTategu.Web/src/features/core/jbwos/components/Modal/DecisionDetailModal.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Target garbage start: className = "w-full ...
const startIdx = lines.findIndex(l => l.trim().startsWith('className = "w-full bg-slate-50'));
// Target garbage end: </motion.div > (with space)
const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '</motion.div >');

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find garbage block');
    console.log('StartIdx:', startIdx);
    console.log('EndIdx:', endIdx);
    process.exit(1);
}

console.log(`Removing lines ${startIdx + 1} to ${endIdx + 1}`);

// We want to keep the closing div of Right Column (which is before startIdx)
// We want to Replace the garbage block with correct closing tags.
// The garbage started at line 842 (index 841).
// The garbage ends at line 957 (index 956) which is </motion.div >.
// Line 958 is empty.
// Line 959 is Footer.

// Replacement content
const replacement = [
    '                        </div>',
    '                    </div>',
    '                </motion.div>'
];

// Remove from startIdx to endIdx (inclusive of endIdx because endIdx is the garbage closing tag)
// Also check if there is an empty line after endIdx to remove?
// Line 958 was empty. Let's include it if it exists.
let removeCount = endIdx - startIdx + 1;
if (lines[endIdx + 1].trim() === '') {
    removeCount++;
}

lines.splice(startIdx, removeCount, ...replacement);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed DecisionDetailModal.tsx');

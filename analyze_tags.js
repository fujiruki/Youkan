const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'JWCADTategu.Web/src/features/core/jbwos/components/Modal/DecisionDetailModal.tsx');
const content = fs.readFileSync(filePath, 'utf8');

let balance = 0;
let lines = content.split('\n');

// Specific focus on div balance
let divBalance = 0;
let motionDivBalance = 0;

console.log('--- Tag Balance Analysis ---');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Count <div (word boundary check is simple here)
    // Avoid comments
    if (line.trim().startsWith('//') || line.trim().startsWith('{/*')) continue;

    const openDivs = (line.match(/<div\b/g) || []).length;
    const closeDivs = (line.match(/<\/div>/g) || []).length;

    const openMotion = (line.match(/<motion\.div\b/g) || []).length;
    const closeMotion = (line.match(/<\/motion\.div>/g) || []).length;

    divBalance += openDivs - closeDivs;
    motionDivBalance += openMotion - closeMotion;

    if (openDivs > 0 || closeDivs > 0 || openMotion > 0 || closeMotion > 0) {
        // console.log(`Line ${i+1}: DivDelta=${openDivs-closeDivs} Balance=${divBalance} | MotionDelta=${openMotion-closeMotion} Balance=${motionDivBalance} | ${line.trim()}`);
    }
}

console.log(`Final Div Balance: ${divBalance}`);
console.log(`Final Motion Div Balance: ${motionDivBalance}`);

if (divBalance !== 0) {
    console.log('ERROR: Div balance is not zero!');
    // Try to find where it goes wrong (negative balance implies too many closes, positive implies unclosed)
}
if (motionDivBalance !== 0) {
    console.log('ERROR: Motion Div balance is not zero!');
}

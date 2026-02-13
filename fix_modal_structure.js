const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'JWCADTategu.Web/src/features/core/jbwos/components/Modal/DecisionDetailModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// 1. Find Left Column End
// It ends after the Volume Calendar section.
// Look for the line containing `volumeOnly={true}` then find the closing div of that component, then the wrapper div, then the Left Column div.
// Or easier: Look for `{/* Top: Date Inputs` which starts Left Col.
// And `{/* RIGHT COLUMN` which SHOULD start Right Col.

// Let's find the insertion point for Right Column Wrapper.
// It should be before `<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">` which starts Assignee section label.
// And after `</div>` of Left Column.

const assigneeLabelIndex = lines.findIndex(l => l.includes('text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1') && l.includes('担当者'));
if (assigneeLabelIndex === -1) {
    console.error('Could not find Assignee Label');
    process.exit(1);
}

// Search backwards for the Left Column closing tag.
// The structure before Assignee is:
// Left Column Footer (Memo) -> </div>
// Left Column Wrapper -> </div>
let leftColumnEndIndex = -1;
for (let i = assigneeLabelIndex - 1; i >= 0; i--) {
    if (lines[i].trim() === '</div>') {
        // Check if this is the Left Column end.
        // Before this should be the Memo section.
        // Let's assume the first </div> before Assignee is specific to the previous section container?
        // Actually, in the current broken state, there might be multiple checkings needed.

        // Let's just look for the line that has the class `space-y-2 pt-1 pb-4`. That is the Assignee container.
        // Or if it's missing, we need to add it.
        leftColumnEndIndex = i; // Provisional
        break;
    }
}

// 2. Wrap Right Column
// Identify start and end of Right Column content.
// Start: Assignee Section (around assigneeLabelIndex)
// End: Subtasks Section End.

// Find Subtask Widget
const subtaskWidgetIndex = lines.findIndex(l => l.includes('<SubtaskListWidget'));
// Find the closing div of the container holding SubtaskListWidget
let subtaskContainerEndIndex = -1;
for (let i = subtaskWidgetIndex; i < lines.length; i++) {
    if (lines[i].trim() === '</div>') {
        subtaskContainerEndIndex = i;
        break;
    }
}

// Now we construct the new content.
// We need to inject the Right Column Wrapper opening tag BEFORE the Assignee Section container.
// The Assignee Section container usually starts with `<div className="space-y-2 pt-1 pb-4`.
const assigneeContainerIndex = lines.findIndex(l => l.includes('className="space-y-2 pt-1 pb-4 border-b'));

// Also we need to ensure Left Column is closed.
// If we insert Right Column wrapper, we must ensure it is after Left Column.

// Let's allow specific regex replacement for reliability.

// A. Fix Right Column Start
// Look for:
// </div> (Left Col End)
// <div className="space-y-2 pt-1 pb-4... (Assignee Start)
// Replace with:
// </div>
// <div className="w-full md:w-[320px] lg:w-[360px] flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">
// <div className="space-y-2 pt-1 pb-4...

const rightColClass = 'w-full md:w-[320px] lg:w-[360px] flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6';

// Check if Right Column Wrapper already exits
const hasRightCol = content.includes('w-full md:w-[320px]');

if (!hasRightCol) {
    console.log('Inserting Right Column Wrapper...');
    // Find the Place to insert.
    // We look for the Assignee Header start
    const targetLine = '<div className="space-y-2 pt-1 pb-4 border-b border-slate-100 dark:border-slate-800">';
    const replacement = `<div className="${rightColClass}">\n${targetLine}`;
    content = content.replace(targetLine, replacement);
}

// B. Fix Right Column End & Body End
// Look for SubtaskListWidget
// The container of SubtaskListWidget is <div className="flex-1 min-h-0 pt-2 pb-4">
// After that div closes, we need to close Right Column, then Body.

const subtaskContainerStart = '<div className="flex-1 min-h-0 pt-2 pb-4">';
const splitParts = content.split(subtaskContainerStart);
if (splitParts.length === 2) {
    const afterSubtasks = splitParts[1];
    // Find the closing of SubtaskListWidget container.
    const closingDivIndex = afterSubtasks.indexOf('</div>');
    if (closingDivIndex !== -1) {
        // We want to reconstruct the part after Subtask Container.
        // It should be:
        // </div> (End Subtask Container)
        // </div> (End Right Column)
        // </div> (End Body)
        // (No </motion.div> here)
        // ... Footer ...
        // </motion.div> (End Modal)

        // Find Footer Start
        const footerStartIdx = afterSubtasks.indexOf('<div className="absolute bottom-4');

        // The content between Subtask Container End and Footer Start should be just closing divs.
        const correctClosing = `
                            </div>
                        </div>
                    </div>
`;
        // Rebuild content
        const beforeFooter = afterSubtasks.substring(0, closingDivIndex + 6); // include </div>
        const afterFooter = afterSubtasks.substring(footerStartIdx);

        // Clean up garbage between them
        const newAfterSubtasks = beforeFooter + correctClosing + afterFooter;

        content = splitParts[0] + subtaskContainerStart + newAfterSubtasks;
    }
}

// C. Fix Footer End
// Ensure </motion.div> is after Footer.
// Footer ends with </div>.
// Then </motion.div>.
// Then )} <AnimatePresence>.

// Search for the end of file structure.
// Look for final </AnimatePresence>
const finalPart = `
                    </motion.div>
            )}
        </AnimatePresence>
    );
};
`;

// Replace the end of the file from the last Footer closing div.
// Footer main div: <div className="absolute bottom-4 ..."> ... </div>
// It ends before the current messy closing tags.
// Let's find the last </div> before the potentially messy end.
const lastDivIndex = content.lastIndexOf('</div>');
// This might be risky if we match the wrong div.

// Safer approach: Regex specifically for the end of Footer.
// Footer has: <CheckCircle2 size={18} /> {yesButtonLabel || '今日やる'} </button> </div> </div> </div>
// 901: <CheckCircle2 ...
// 902: </button>
// 903: </div> (Buttons container)
// 904: </div> (Footer inner container)
// 905: </div> (Footer absolute container)

const footerSignature = '<CheckCircle2 size={18} /> {yesButtonLabel || \'今日やる\'}';
const footerSigIndex = content.indexOf(footerSignature);

if (footerSigIndex !== -1) {
    // Find the 3rd </div> after signature
    let currentIdx = footerSigIndex;
    let divCount = 0;
    while (divCount < 3 && currentIdx < content.length) {
        const nextDiv = content.indexOf('</div>', currentIdx);
        if (nextDiv === -1) break;
        currentIdx = nextDiv + 6;
        divCount++;
    }

    // Now currentIdx is after the Footer.
    // Cut everything after and append correct closing.
    content = content.substring(0, currentIdx) + finalPart;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed DecisionDetailModal.tsx structure');

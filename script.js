/* ============================================= */
/* DOM REFERENCES                                 */
/* ============================================= */

const workflowContainer = document.getElementById('workflowContainer');
const targetWorkflowContainer = document.getElementById('targetWorkflowContainer');

const sourceSearchInput = document.getElementById('sourceSearchInput');
const targetSearchInput = document.getElementById('targetSearchInput');
const sourceSearchBtn = document.getElementById('sourceSearchBtn');
const targetSearchBtn = document.getElementById('targetSearchBtn');
const sourceAutocompleteList = document.getElementById('sourceAutocompleteList');
const targetAutocompleteList = document.getElementById('targetAutocompleteList');

const sourceCountEl = document.getElementById('sourceCount');
const targetCountEl = document.getElementById('targetCount');

const sourceStatus = document.getElementById('sourceStatus');
const targetStatus = document.getElementById('targetStatus');

const refreshBtn = document.getElementById('refreshBtn');

const downloadSourceJsonBtn = document.getElementById('downloadSourceJsonBtn');
const viewSourceJsonBtn = document.getElementById('viewSourceJsonBtn');
const sourceJsonViewerWrap = document.getElementById('sourceJsonViewerWrap');
const sourceJsonViewer = document.getElementById('sourceJsonViewer');
const uploadSourceJsonInput = document.getElementById('uploadSourceJsonInput');
const uploadedJsonEditorWrap = document.getElementById('uploadedJsonEditorWrap');
const uploadedJsonEditorLabel = document.getElementById('uploadedJsonEditorLabel');
const uploadedJsonEditor = document.getElementById('uploadedJsonEditor');
const saveUploadedJsonBtn = document.getElementById('saveUploadedJsonBtn');
const closeUploadedJsonEditorBtn = document.getElementById('closeUploadedJsonEditorBtn');

const validateBtn = document.getElementById('validateBtn');
const validationPanel = document.getElementById('validationPanel');
const validationSummary = document.getElementById('validationSummary');
const validationList = document.getElementById('validationList');

const exportSummaryJsonBtn = document.getElementById('exportSummaryJsonBtn');
const exportSummaryTextBtn = document.getElementById('exportSummaryTextBtn');

const summaryEmpty = document.getElementById('summaryEmpty');
const summaryCard = document.getElementById('summaryCard');
const summaryPairCount = document.getElementById('summaryPairCount');
const pairMatrixContainer = document.getElementById('pairMatrixContainer');
const focusedSourceName = document.getElementById('focusedSourceName');
const statStages = document.getElementById('statStages');
const statTrigger = document.getElementById('statTrigger');
const statType = document.getElementById('statType');

const previewBtn = document.getElementById('previewBtn');
const toggleJsonBtn = document.getElementById('toggleJsonBtn');
const jsonViewerWrap = document.getElementById('jsonViewerWrap');
const jsonViewer = document.getElementById('jsonViewer');

const previewSourceSelect = document.getElementById('previewSourceSelect');
const previewTargetSelect = document.getElementById('previewTargetSelect');
const generateJsonBtn = document.getElementById('generateJsonBtn');

const importBtn = document.getElementById('importBtn');
const trackDot = document.getElementById('trackDot');

const progressPanel = document.getElementById('progressPanel');
const progressList = document.getElementById('progressList');

const crossTenantBtn = document.getElementById('crossTenantBtn');
const crossTenantModal = document.getElementById('crossTenantModal');
const tenantBaseUrl = document.getElementById('tenantBaseUrl');
const tenantEmployeeGUID = document.getElementById('tenantEmployeeGUID');
const tenantHrzEmail = document.getElementById('tenantHrzEmail');
const tenantHrzEmpID = document.getElementById('tenantHrzEmpID');
const crossTenantCancelBtn = document.getElementById('crossTenantCancelBtn');
const crossTenantSaveBtn = document.getElementById('crossTenantSaveBtn');
const tenantBadge = document.getElementById('tenantBadge');
const tenantBadgeText = document.getElementById('tenantBadgeText');
const resetTenantBtn = document.getElementById('resetTenantBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmPairSummary = document.getElementById('confirmPairSummary');
const confirmPairList = document.getElementById('confirmPairList');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmProceedBtn = document.getElementById('confirmProceedBtn');

const successModal = document.getElementById('successModal');
const successTitle = document.getElementById('successTitle');
const successPairsTotal = document.getElementById('successPairsTotal');
const successPairsSucceeded = document.getElementById('successPairsSucceeded');
const successPairsFailed = document.getElementById('successPairsFailed');
const successPairsSkipped = document.getElementById('successPairsSkipped');
const successStagesTotal = document.getElementById('successStagesTotal');
const successTime = document.getElementById('successTime');
const importAnotherBtn = document.getElementById('importAnotherBtn');

const generatedJsonModal = document.getElementById('generatedJsonModal');
const generatedJsonViewer = document.getElementById('generatedJsonViewer');
const generatedJsonMeta = document.getElementById('generatedJsonMeta');
const downloadGeneratedJsonBtn = document.getElementById('downloadGeneratedJsonBtn');
const closeGeneratedJsonBtn = document.getElementById('closeGeneratedJsonBtn');

/* ============================================= */
/* STATE                                          */
/* ============================================= */

let allWorkflows = [];       // source-side directory, always the default/home tenant
let targetWorkflows = [];    // target-side directory; equals allWorkflows unless cross-tenant is active
let targetTenant = null;     // null = same tenant as source; otherwise { baseUrl, employeeGUID, hrzEmail, hrzEmpID }

// Multi-select state. Each Source entry is:
//   { id, workflow, uploaded, loading }
//     - id: WFID for a fetched workflow, or a synthetic "uploaded-..." id
//     - uploaded: true when `workflow` came from an uploaded/edited JSON
//       file rather than the fetched directory (no WFID guarantee)
//     - loading: true while the full record is being fetched by WFID after
//       being picked from the autocomplete list
// Each Target entry is: { id, workflow } (id === workflow.WFID always,
// since targets always come from the fetched directory).
let sourceEntries = [];
let targetEntries = [];

let focusedSourceId = null;       // which Source chip the center panel / JSON actions act on
let uploadedEditorLoadedId = null; // which uploaded entry's JSON currently fills the editor textarea
                                    // (guards against clobbering in-progress edits on unrelated re-renders)
let uploadCounter = 0;             // used to build unique ids for uploaded sources

let sourceAutocompleteMatches = [];
let targetAutocompleteMatches = [];
let sourceHighlightIndex = -1;
let targetHighlightIndex = -1;

// Not every Source x Target combination is necessarily wanted, so the
// person picks exactly which ones via the pair-selection matrix (a grid of
// checkboxes) instead of every Source always being forced against every
// Target. `selectedPairKeys` holds pairKey(sourceId, targetId) for every
// combination currently turned on - this is the actual set validation and
// import operate on. `knownPairKeys` tracks every combination the matrix
// has ever shown the person, purely so a *newly appearing* combination
// (a fresh Source or Target just added) can default to selected without
// that same logic re-checking a box the person deliberately unchecked on
// a later, unrelated re-render.
let selectedPairKeys = new Set();
let knownPairKeys = new Set();

// Validation runs across whatever's currently selected in the pair matrix.
// `lastValidationPairs` is an array of per-pair results; `lastValidationSignature`
// is a snapshot of exactly which pairs were validated, so the result set
// can be detected as stale the moment the selection changes.
let lastValidationPairs = null;
let lastValidationSignature = null;

let lastGeneratedPayload = null; // most recently generated single-pair preview JSON (for its own download button)
let lastBulkSummary = null;      // array of per-pair audit summaries from the most recent bulk import (for export)

/* ============================================= */
/* INITIALIZATION                                 */
/* ============================================= */

// Auto-run the same initialization Refresh does - as soon as the page is
// ready. Using document.readyState instead of only listening for
// DOMContentLoaded guards against the case where that event has already
// fired by the time this script executes (e.g. this file being loaded
// late, injected into an already-parsed document, or run inside a host
// page/iframe) - an addEventListener call after the event already fired
// would otherwise silently never run, which is exactly what forced a
// manual Refresh click before.
function initializeApp() {
    loadWorkflows();
    setActiveStep(1);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

refreshBtn.addEventListener('click', loadWorkflows);

previewBtn.addEventListener('click', () => {
    if (!focusedSourceId) {
        showToast('Select a source workflow chip to preview.', 'error');
        return;
    }
    renderFocusedSourceSummary();
    showToast('Preview refreshed.', 'success');
});

toggleJsonBtn.addEventListener('click', toggleJsonViewer);

generateJsonBtn.addEventListener('click', generateAndShowMigrationJson);
downloadGeneratedJsonBtn.addEventListener('click', () => {
    if (!lastGeneratedPayload) return;
    const targetEntry = targetEntries.find(e => e.id === previewTargetSelect.value);
    const filename = `${(targetEntry && workflowDisplayName(targetEntry.workflow)) || 'workflow'}-migration.json`;
    downloadTextFile(JSON.stringify(lastGeneratedPayload, null, 2), filename);
});
closeGeneratedJsonBtn.addEventListener('click', () => generatedJsonModal.classList.add('hidden'));

validateBtn.addEventListener('click', runValidation);

exportSummaryJsonBtn.addEventListener('click', () => {
    if (!lastBulkSummary) return;
    const bulk = buildBulkMigrationSummary(lastBulkSummary);
    downloadTextFile(JSON.stringify(bulk, null, 2), 'workflow-migration-summary.json');
});
exportSummaryTextBtn.addEventListener('click', () => {
    if (!lastBulkSummary) return;
    const bulk = buildBulkMigrationSummary(lastBulkSummary);
    downloadTextFile(formatBulkMigrationSummaryAsText(bulk), 'workflow-migration-summary.txt');
});

// Downloads the Source selection as JSON. With exactly one loaded Source
// this behaves as before (a single .json file). With more than one, it
// bundles every loaded Source workflow into a single .zip - one .json file
// per workflow - rather than the browser silently only ever downloading
// whichever chip happens to be focused. Entries still being fetched by
// WFID are skipped (with a toast) rather than downloaded half-loaded.
downloadSourceJsonBtn.addEventListener('click', () => {
    const loadedEntries = sourceEntries.filter(e => !e.loading);

    if (loadedEntries.length === 0) {
        showToast('Add at least one Source workflow first.', 'error');
        return;
    }

    const loadingCount = sourceEntries.length - loadedEntries.length;
    if (loadingCount > 0) {
        showToast(`${loadingCount} workflow(s) still loading were skipped from the download.`, 'info');
    }

    if (loadedEntries.length === 1) {
        const entry = loadedEntries[0];
        const filename = `${sanitizeFilenamePart(entry.workflow.WFName || workflowDisplayName(entry.workflow))}.json`;
        downloadTextFile(JSON.stringify(entry.workflow, null, 2), filename);
        return;
    }

    downloadSourceEntriesAsZip(loadedEntries);
});

// Strips characters that aren't safe in a filename and collapses
// whitespace, so workflow names full of slashes/colons/etc. don't break
// the downloaded file (or a path inside the ZIP).
function sanitizeFilenamePart(name) {
    const cleaned = String(name || 'workflow')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 80);
    return cleaned || 'workflow';
}

// Picks a filename for `workflow` inside the ZIP that doesn't collide with
// one already used: plain name first, then name+WFID, then name+counter.
function buildUniqueZipFilename(workflow, usedNames) {
    const base = sanitizeFilenamePart(workflow.WFName || workflowDisplayName(workflow));

    let candidate = `${base}.json`;
    if (!usedNames.has(candidate.toLowerCase())) {
        usedNames.add(candidate.toLowerCase());
        return candidate;
    }

    if (workflow.WFID) {
        candidate = `${base}-${sanitizeFilenamePart(workflow.WFID)}.json`;
        if (!usedNames.has(candidate.toLowerCase())) {
            usedNames.add(candidate.toLowerCase());
            return candidate;
        }
    }

    let counter = 2;
    candidate = `${base}-${counter}.json`;
    while (usedNames.has(candidate.toLowerCase())) {
        counter += 1;
        candidate = `${base}-${counter}.json`;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
}

async function downloadSourceEntriesAsZip(entries) {
    if (typeof JSZip === 'undefined') {
        showToast('ZIP support failed to load - try downloading workflows one at a time instead.', 'error');
        return;
    }

    const originalLabel = downloadSourceJsonBtn.textContent;
    downloadSourceJsonBtn.disabled = true;
    downloadSourceJsonBtn.textContent = 'Zipping...';

    try {
        const zip = new JSZip();
        const usedNames = new Set();

        entries.forEach(entry => {
            const filename = buildUniqueZipFilename(entry.workflow, usedNames);
            zip.file(filename, JSON.stringify(entry.workflow, null, 2));
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `source-workflows-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`Downloaded ${entries.length} workflow(s) as a ZIP.`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Unable to build the ZIP file.', 'error');
    } finally {
        downloadSourceJsonBtn.textContent = originalLabel;
        renderSourcePanel(); // recompute the correct disabled state / label
    }
}

viewSourceJsonBtn.addEventListener('click', () => {
    const entry = sourceEntries.find(e => e.id === focusedSourceId);
    if (!entry) {
        showToast('Select a Source workflow chip first.', 'error');
        return;
    }

    const isHidden = sourceJsonViewerWrap.classList.contains('hidden');

    if (isHidden) {
        sourceJsonViewer.value = JSON.stringify(entry.workflow, null, 2);
        sourceJsonViewerWrap.classList.remove('hidden');
        viewSourceJsonBtn.textContent = 'Hide JSON';
        viewSourceJsonBtn.setAttribute('aria-expanded', 'true');
    } else {
        sourceJsonViewerWrap.classList.add('hidden');
        viewSourceJsonBtn.textContent = 'View JSON';
        viewSourceJsonBtn.setAttribute('aria-expanded', 'false');
    }
});

uploadSourceJsonInput.addEventListener('change', handleSourceJsonUpload);
saveUploadedJsonBtn.addEventListener('click', saveUploadedJsonEdits);
closeUploadedJsonEditorBtn.addEventListener('click', () => {
    uploadedJsonEditorWrap.classList.add('hidden');
});

importBtn.addEventListener('click', openConfirmModal);
confirmCancelBtn.addEventListener('click', closeConfirmModal);
confirmProceedBtn.addEventListener('click', () => {
    closeConfirmModal();
    runBulkImport();
});

importAnotherBtn.addEventListener('click', resetForNewImport);

crossTenantBtn.addEventListener('click', openCrossTenantModal);
crossTenantCancelBtn.addEventListener('click', () => crossTenantModal.classList.add('hidden'));
crossTenantSaveBtn.addEventListener('click', saveCrossTenantConfig);
resetTenantBtn.addEventListener('click', resetCrossTenant);

previewSourceSelect.addEventListener('change', () => { lastGeneratedPayload = null; });
previewTargetSelect.addEventListener('change', () => { lastGeneratedPayload = null; });

/* ============================================= */
/* AUTOCOMPLETE: SOURCE / TARGET SEARCH FIELDS    */
/* ============================================= */

// Returns up to 8 workflows from `pool` whose display name or internal
// WFName contains `term` (case-insensitive), excluding anything whose WFID
// is already in `excludeIds` - so items already selected drop out of their
// own suggestion list.
function getAutocompleteMatches(pool, term, excludeIds) {
    const q = (term || '').trim().toLowerCase();
    if (!q) return [];

    return pool
        .filter(w => w && w.WFID && !excludeIds.has(w.WFID))
        .filter(w => {
            const name = workflowDisplayName(w).toLowerCase();
            const internalName = (w.WFName || '').toLowerCase();
            return name.includes(q) || internalName.includes(q);
        })
        .slice(0, 8);
}

function currentSourceExcludeIds() {
    return new Set(sourceEntries.filter(e => !e.uploaded).map(e => e.id));
}

function currentTargetExcludeIds() {
    return new Set(targetEntries.map(e => e.id));
}

sourceSearchInput.addEventListener('input', () => {
    sourceHighlightIndex = -1;
    sourceAutocompleteMatches = getAutocompleteMatches(allWorkflows, sourceSearchInput.value, currentSourceExcludeIds());
    renderAutocompleteDropdown(sourceAutocompleteList, sourceAutocompleteMatches, sourceHighlightIndex);
});

sourceSearchInput.addEventListener('focus', () => {
    if (sourceSearchInput.value.trim()) {
        sourceAutocompleteMatches = getAutocompleteMatches(allWorkflows, sourceSearchInput.value, currentSourceExcludeIds());
        renderAutocompleteDropdown(sourceAutocompleteList, sourceAutocompleteMatches, sourceHighlightIndex);
    }
});

sourceSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (sourceAutocompleteMatches.length === 0) return;
        sourceHighlightIndex = (sourceHighlightIndex + 1) % sourceAutocompleteMatches.length;
        renderAutocompleteDropdown(sourceAutocompleteList, sourceAutocompleteMatches, sourceHighlightIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (sourceAutocompleteMatches.length === 0) return;
        sourceHighlightIndex = (sourceHighlightIndex - 1 + sourceAutocompleteMatches.length) % sourceAutocompleteMatches.length;
        renderAutocompleteDropdown(sourceAutocompleteList, sourceAutocompleteMatches, sourceHighlightIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        commitSourceAutocompleteSelection();
    } else if (e.key === 'Escape') {
        hideAutocompleteDropdown(sourceAutocompleteList);
    }
});

sourceAutocompleteList.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const match = sourceAutocompleteMatches[Number(item.dataset.index)];
    if (match) {
        addSourceWorkflow(match);
        sourceSearchInput.value = '';
        sourceSearchInput.focus();
        hideAutocompleteDropdown(sourceAutocompleteList);
    }
});

sourceSearchBtn.addEventListener('click', commitSourceAutocompleteSelection);

function commitSourceAutocompleteSelection() {
    if (sourceAutocompleteMatches.length > 0) {
        const index = sourceHighlightIndex >= 0 ? sourceHighlightIndex : 0;
        const match = sourceAutocompleteMatches[index];
        if (match) {
            addSourceWorkflow(match);
            sourceSearchInput.value = '';
            hideAutocompleteDropdown(sourceAutocompleteList);
        }
        return;
    }

    const term = sourceSearchInput.value.trim();
    if (!term) {
        showToast('Type part of a workflow name to search.', 'error');
        return;
    }

    const exact = allWorkflows.find(w => (w.WFName || '').toLowerCase() === term.toLowerCase()
        || workflowDisplayName(w).toLowerCase() === term.toLowerCase());

    if (!exact) {
        showToast(`No workflow found matching "${term}".`, 'error');
        return;
    }

    addSourceWorkflow(exact);
    sourceSearchInput.value = '';
}

targetSearchInput.addEventListener('input', () => {
    targetHighlightIndex = -1;
    targetAutocompleteMatches = getAutocompleteMatches(targetWorkflows, targetSearchInput.value, currentTargetExcludeIds());
    renderAutocompleteDropdown(targetAutocompleteList, targetAutocompleteMatches, targetHighlightIndex);
});

targetSearchInput.addEventListener('focus', () => {
    if (targetSearchInput.value.trim()) {
        targetAutocompleteMatches = getAutocompleteMatches(targetWorkflows, targetSearchInput.value, currentTargetExcludeIds());
        renderAutocompleteDropdown(targetAutocompleteList, targetAutocompleteMatches, targetHighlightIndex);
    }
});

targetSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (targetAutocompleteMatches.length === 0) return;
        targetHighlightIndex = (targetHighlightIndex + 1) % targetAutocompleteMatches.length;
        renderAutocompleteDropdown(targetAutocompleteList, targetAutocompleteMatches, targetHighlightIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (targetAutocompleteMatches.length === 0) return;
        targetHighlightIndex = (targetHighlightIndex - 1 + targetAutocompleteMatches.length) % targetAutocompleteMatches.length;
        renderAutocompleteDropdown(targetAutocompleteList, targetAutocompleteMatches, targetHighlightIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        commitTargetAutocompleteSelection();
    } else if (e.key === 'Escape') {
        hideAutocompleteDropdown(targetAutocompleteList);
    }
});

targetAutocompleteList.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const match = targetAutocompleteMatches[Number(item.dataset.index)];
    if (match) {
        addTargetWorkflow(match);
        targetSearchInput.value = '';
        targetSearchInput.focus();
        hideAutocompleteDropdown(targetAutocompleteList);
    }
});

targetSearchBtn.addEventListener('click', commitTargetAutocompleteSelection);

function commitTargetAutocompleteSelection() {
    if (targetAutocompleteMatches.length > 0) {
        const index = targetHighlightIndex >= 0 ? targetHighlightIndex : 0;
        const match = targetAutocompleteMatches[index];
        if (match) {
            addTargetWorkflow(match);
            targetSearchInput.value = '';
            hideAutocompleteDropdown(targetAutocompleteList);
        }
        return;
    }

    const term = targetSearchInput.value.trim();
    if (!term) {
        showToast('Type part of a workflow name to search.', 'error');
        return;
    }

    const exact = targetWorkflows.find(w => (w.WFName || '').toLowerCase() === term.toLowerCase()
        || workflowDisplayName(w).toLowerCase() === term.toLowerCase());

    if (!exact) {
        showToast(`No workflow found matching "${term}".`, 'error');
        return;
    }

    addTargetWorkflow(exact);
    targetSearchInput.value = '';
}

// Clicking outside either autocomplete field/dropdown closes it.
document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-input-wrap')) {
        hideAutocompleteDropdown(sourceAutocompleteList);
        hideAutocompleteDropdown(targetAutocompleteList);
    }
});

/* ============================================= */
/* LOAD WORKFLOWS (single API call, shared)       */
/* ============================================= */

// Loads the full workflow directory into memory (allWorkflows/targetWorkflows)
// so the autocomplete fields can filter instantly, without ever rendering it
// as a browsable list up front - only matches for whatever's been typed are
// shown. Runs automatically on page load and whenever Refresh is clicked.
async function loadWorkflows() {
    showSourceListLoading();

    try {
        allWorkflows = await fetchAllWorkflows();
        hideSourceListStatus();
    } catch (error) {
        console.error(error);
        showSourceListError('Unable to load the workflow directory.');
        showToast('Unable to load Source workflows.', 'error');
    }

    await loadTargetWorkflows();
}

// Loads the target-side list from whichever tenant is currently configured
// (the default/home tenant, or a connected cross-tenant target).
async function loadTargetWorkflows() {
    targetStatus.textContent = 'Loading workflow directory...';
    targetStatus.classList.remove('hidden', 'status-error');
    targetStatus.classList.add('status-loading');

    try {
        targetWorkflows = targetTenant
            ? await fetchAllWorkflows(targetTenant)
            : allWorkflows;

        targetStatus.classList.add('hidden');

    } catch (error) {
        console.error(error);
        targetStatus.textContent = 'Unable to load Target workflows.';
        targetStatus.classList.remove('hidden', 'status-loading');
        targetStatus.classList.add('status-error');
        showToast('Unable to load Target workflows.', 'error');
    }
}

function showSourceListLoading() {
    sourceStatus.textContent = 'Loading workflow directory...';
    sourceStatus.classList.remove('hidden', 'status-error');
    sourceStatus.classList.add('status-loading');
}

function showSourceListError(message) {
    sourceStatus.textContent = message;
    sourceStatus.classList.remove('hidden', 'status-loading');
    sourceStatus.classList.add('status-error');
}

function hideSourceListStatus() {
    sourceStatus.classList.add('hidden');
}

/* ============================================= */
/* SOURCE (LEFT) MULTI-SELECT                     */
/* ============================================= */

// Adds `workflowStub` (a lightweight entry from the allWorkflows directory,
// with at least WFID/WFName) to the Source selection, then fetches the
// authoritative full record via WFConfigByID so the chip reflects the
// freshest config rather than whatever was cached in the last full-list
// fetch (mirrors the old single-select searchSourceWorkflow behavior).
async function addSourceWorkflow(workflowStub) {
    if (!workflowStub || !workflowStub.WFID) return;

    if (sourceEntries.some(e => !e.uploaded && e.id === workflowStub.WFID)) {
        showToast('That workflow is already in your Source selection.', 'info');
        return;
    }

    const entryId = workflowStub.WFID;
    const entry = { id: entryId, workflow: workflowStub, uploaded: false, loading: true };
    sourceEntries.push(entry);
    focusedSourceId = entryId;
    renderSourcePanel();
    invalidateValidation();
    updateActionAvailability();

    try {
        const fresh = await fetchWorkflowById(workflowStub.WFID);
        entry.workflow = fresh;
        entry.loading = false;
    } catch (error) {
        console.error(error);
        sourceEntries = sourceEntries.filter(e => e.id !== entryId);
        if (focusedSourceId === entryId) {
            focusedSourceId = sourceEntries.length > 0 ? sourceEntries[sourceEntries.length - 1].id : null;
        }
        showToast(`Unable to load workflow "${workflowDisplayName(workflowStub)}".`, 'error');
    }

    renderSourcePanel();
    invalidateValidation();
    updateActionAvailability();
}

function removeSourceEntry(id) {
    const removed = sourceEntries.find(e => e.id === id);
    sourceEntries = sourceEntries.filter(e => e.id !== id);

    if (focusedSourceId === id) {
        focusedSourceId = sourceEntries.length > 0 ? sourceEntries[sourceEntries.length - 1].id : null;
    }
    if (uploadedEditorLoadedId === id) {
        uploadedEditorLoadedId = null;
        uploadedJsonEditorWrap.classList.add('hidden');
    }

    renderSourcePanel();
    invalidateValidation();
    updateActionAvailability();

    if (removed) {
        showToast(`Removed "${workflowDisplayName(removed.workflow)}" from Source.`, 'info');
    }
}

function focusSourceEntry(id) {
    focusedSourceId = id;
    renderSourcePanel();
}

function renderSourcePanel() {
    renderChipList(workflowContainer, sourceEntries, {
        onRemove: removeSourceEntry,
        onFocus: focusSourceEntry,
        focusedId: focusedSourceId,
        emptyMessage: 'Type a workflow name above to search, pick from the suggestions, or upload a JSON file.'
    });

    sourceCountEl.textContent = String(sourceEntries.length);

    const focused = sourceEntries.find(e => e.id === focusedSourceId);
    viewSourceJsonBtn.disabled = !(focused && !focused.loading);

    const loadedCount = sourceEntries.filter(e => !e.loading).length;
    downloadSourceJsonBtn.disabled = loadedCount === 0;
    downloadSourceJsonBtn.textContent = loadedCount > 1
        ? `Download All as ZIP (${loadedCount})`
        : 'Download JSON';

    renderFocusedSourceSummary();
    renderPairPickers();
    renderPairOverview();
    updateStepTrack();
}

/* ============================================= */
/* PAIR SELECTION MATRIX (Source x Target grid)   */
/* ============================================= */

// Returns { sourceEntry, targetEntry } for every currently-selected,
// currently-valid pair (i.e. both sides still loaded and present) - the
// single source of truth used by validation, import, and the pair-count
// display, instead of anything re-deriving a full cross-product.
function getSelectedPairs() {
    const loadedSources = sourceEntries.filter(e => !e.loading);
    const pairs = [];

    loadedSources.forEach(s => {
        targetEntries.forEach(t => {
            if (selectedPairKeys.has(pairKey(s.id, t.id))) {
                pairs.push({ sourceEntry: s, targetEntry: t });
            }
        });
    });

    return pairs;
}

// Keeps selectedPairKeys/knownPairKeys in sync with the current Source and
// Target selections: any brand-new combination (one that's never been
// shown in the matrix before) defaults to selected, and any combination
// whose Source or Target no longer exists is dropped from both sets so it
// doesn't linger as a stale "selected" pair the person never actually saw.
// Combinations the person has already seen and deliberately unchecked stay
// unchecked across unrelated re-renders.
function syncPairSelection() {
    const loadedSources = sourceEntries.filter(e => !e.loading);
    const validKeys = new Set();

    loadedSources.forEach(s => {
        targetEntries.forEach(t => {
            const key = pairKey(s.id, t.id);
            validKeys.add(key);

            if (!knownPairKeys.has(key)) {
                selectedPairKeys.add(key);
                knownPairKeys.add(key);
            }
        });
    });

    Array.from(knownPairKeys).forEach(key => {
        if (!validKeys.has(key)) {
            knownPairKeys.delete(key);
            selectedPairKeys.delete(key);
        }
    });
}

function renderPairOverview() {
    syncPairSelection();

    const loadedSources = sourceEntries.filter(e => !e.loading);
    const possiblePairCount = loadedSources.length * targetEntries.length;
    const selectedCount = getSelectedPairs().length;

    summaryPairCount.textContent = possiblePairCount === 0
        ? 'Add Source and Target workflows to begin.'
        : `${selectedCount} of ${possiblePairCount} possible pair(s) selected for import`;

    renderPairMatrix(pairMatrixContainer, loadedSources, targetEntries, selectedPairKeys);
}

// Event delegation: individual checkbox toggles, plus the corner
// All/None buttons and clicking a row/column heading to flip everything in
// that row/column at once (a "smart" toggle - if the whole row/column is
// already fully selected, clicking it clears the row/column instead of
// re-selecting it).
pairMatrixContainer.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.pair-matrix-checkbox');
    if (!checkbox) return;

    const key = pairKey(checkbox.dataset.sourceId, checkbox.dataset.targetId);
    if (checkbox.checked) {
        selectedPairKeys.add(key);
    } else {
        selectedPairKeys.delete(key);
    }

    invalidateValidation();
    renderPairOverview();
    updateActionAvailability();
});

pairMatrixContainer.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-matrix-action]');
    const rowHead = e.target.closest('[data-toggle-row]');
    const colHead = e.target.closest('[data-toggle-col]');

    if (!actionBtn && !rowHead && !colHead) return;

    const loadedSources = sourceEntries.filter(s => !s.loading);

    if (actionBtn) {
        const turnOn = actionBtn.dataset.matrixAction === 'select-all';
        loadedSources.forEach(s => targetEntries.forEach(t => {
            const key = pairKey(s.id, t.id);
            if (turnOn) selectedPairKeys.add(key); else selectedPairKeys.delete(key);
        }));
    } else if (rowHead) {
        const sourceId = rowHead.dataset.toggleRow;
        const rowKeys = targetEntries.map(t => pairKey(sourceId, t.id));
        const allOn = rowKeys.every(k => selectedPairKeys.has(k));
        rowKeys.forEach(k => (allOn ? selectedPairKeys.delete(k) : selectedPairKeys.add(k)));
    } else if (colHead) {
        const targetId = colHead.dataset.toggleCol;
        const colKeys = loadedSources.map(s => pairKey(s.id, targetId));
        const allOn = colKeys.every(k => selectedPairKeys.has(k));
        colKeys.forEach(k => (allOn ? selectedPairKeys.delete(k) : selectedPairKeys.add(k)));
    }

    invalidateValidation();
    renderPairOverview();
    updateActionAvailability();
});

function renderFocusedSourceSummary() {
    const entry = sourceEntries.find(e => e.id === focusedSourceId);

    if (!entry) {
        summaryEmpty.classList.remove('hidden');
        summaryCard.classList.add('hidden');
        uploadedJsonEditorWrap.classList.add('hidden');
        return;
    }

    summaryEmpty.classList.add('hidden');
    summaryCard.classList.remove('hidden');

    focusedSourceName.textContent = entry.loading
        ? 'Loading\u2026'
        : workflowDisplayName(entry.workflow);

    if (entry.loading) {
        statStages.textContent = '-';
        statTrigger.textContent = '-';
        statType.textContent = '-';
    } else {
        const { stageCount, triggerType, workflowType } = summarizeWorkflow(entry.workflow);
        statStages.textContent = stageCount;
        statTrigger.textContent = triggerType;
        statType.textContent = workflowType;
    }

    if (entry.uploaded) {
        uploadedJsonEditorWrap.classList.remove('hidden');
        uploadedJsonEditorLabel.textContent = `Editing: ${workflowDisplayName(entry.workflow)}`;

        // Only refill the textarea when the FOCUSED entry actually changed -
        // otherwise an unrelated re-render (e.g. adding a Target) would wipe
        // out whatever the person is mid-way through typing.
        if (uploadedEditorLoadedId !== entry.id) {
            uploadedJsonEditor.value = JSON.stringify(entry.workflow, null, 2);
            uploadedEditorLoadedId = entry.id;
        }
    } else {
        uploadedJsonEditorWrap.classList.add('hidden');
    }

    if (!sourceJsonViewerWrap.classList.contains('hidden') && !entry.loading) {
        sourceJsonViewer.value = JSON.stringify(entry.workflow, null, 2);
    }
}

function toggleJsonViewer() {
    const isHidden = jsonViewerWrap.classList.contains('hidden');

    if (isHidden) {
        jsonViewerWrap.classList.remove('hidden');
        toggleJsonBtn.textContent = 'Hide Transformed JSON';
        toggleJsonBtn.setAttribute('aria-expanded', 'true');
    } else {
        jsonViewerWrap.classList.add('hidden');
        toggleJsonBtn.textContent = 'Show Transformed JSON';
        toggleJsonBtn.setAttribute('aria-expanded', 'false');
    }
}

/* ============================================= */
/* TARGET (RIGHT) MULTI-SELECT                    */
/* No per-item API call - reuses the already      */
/* loaded target directory (refetched at import)  */
/* ============================================= */

function addTargetWorkflow(workflow) {
    if (!workflow || !workflow.WFID) return;

    if (targetEntries.some(e => e.id === workflow.WFID)) {
        showToast('That workflow is already in your Target selection.', 'info');
        return;
    }

    targetEntries.push({ id: workflow.WFID, workflow });
    renderTargetPanel();
    invalidateValidation();
    updateActionAvailability();
}

function removeTargetEntry(id) {
    const removed = targetEntries.find(e => e.id === id);
    targetEntries = targetEntries.filter(e => e.id !== id);

    renderTargetPanel();
    invalidateValidation();
    updateActionAvailability();

    if (removed) {
        showToast(`Removed "${workflowDisplayName(removed.workflow)}" from Target.`, 'info');
    }
}

function renderTargetPanel() {
    renderChipList(targetWorkflowContainer, targetEntries, {
        onRemove: removeTargetEntry,
        emptyMessage: 'Type a workflow name above to search and pick from the suggestions.'
    });

    targetCountEl.textContent = String(targetEntries.length);
    renderFocusedSourceSummary();
    renderPairPickers();
    renderPairOverview();
    updateStepTrack();
}

/* ============================================= */
/* PREVIEW-PAIR PICKERS (Generate JSON section)   */
/* ============================================= */

// The "View / Download Generated JSON" action previews exactly one
// Source -> Target pair at a time (it's a preview of the literal payload,
// not a bulk operation) - these two <select> elements let the person pick
// which of their selected pairs to preview, defaulting to keeping whatever
// was already chosen if it's still in range.
function renderPairPickers() {
    const loadedSources = sourceEntries.filter(e => !e.loading);

    fillSelect(previewSourceSelect, loadedSources.map(e => ({ id: e.id, label: workflowDisplayName(e.workflow) })));
    fillSelect(previewTargetSelect, targetEntries.map(e => ({ id: e.id, label: workflowDisplayName(e.workflow) })));
}

function fillSelect(selectEl, items) {
    const previousValue = selectEl.value;
    selectEl.innerHTML = '';

    if (items.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '\u2014';
        selectEl.appendChild(opt);
        selectEl.disabled = true;
        return;
    }

    selectEl.disabled = false;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.label;
        selectEl.appendChild(opt);
    });

    if (items.some(i => i.id === previousValue)) {
        selectEl.value = previousValue;
    }
}

/* ============================================= */
/* UPLOAD JSON AS AN ADDITIONAL SOURCE WORKFLOW   */
/* ============================================= */

function handleSourceJsonUpload(event) {
    const file = event.target.files && event.target.files[0];
    uploadSourceJsonInput.value = ''; // allow re-uploading the same filename later

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        let parsed;
        try {
            parsed = JSON.parse(reader.result);
        } catch (error) {
            showToast('That file is not valid JSON.', 'error');
            return;
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            showToast('Uploaded JSON must be a single workflow object.', 'error');
            return;
        }

        const entryId = `uploaded-${Date.now()}-${uploadCounter++}`;
        sourceEntries.push({ id: entryId, workflow: parsed, uploaded: true, loading: false });
        focusedSourceId = entryId;

        renderSourcePanel();
        invalidateValidation();
        updateActionAvailability();
        showToast(`"${file.name}" added as a Source workflow.`, 'success');
    };
    reader.onerror = () => showToast('Unable to read that file.', 'error');
    reader.readAsText(file);
}

function saveUploadedJsonEdits() {
    const entry = sourceEntries.find(e => e.id === focusedSourceId);
    if (!entry || !entry.uploaded) {
        showToast('Select an uploaded Source chip to edit.', 'error');
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(uploadedJsonEditor.value);
    } catch (error) {
        showToast('Fix the JSON syntax before saving.', 'error');
        return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        showToast('Uploaded JSON must be a single workflow object.', 'error');
        return;
    }

    entry.workflow = parsed;

    renderSourcePanel();
    invalidateValidation();
    updateActionAvailability();
    showToast('Uploaded JSON changes saved.', 'success');
}

/* ============================================= */
/* CROSS-TENANT TARGET CONFIGURATION              */
/* ============================================= */

function openCrossTenantModal() {
    tenantBaseUrl.value = targetTenant ? targetTenant.baseUrl : '';
    tenantEmployeeGUID.value = targetTenant ? targetTenant.employeeGUID : '';
    tenantHrzEmail.value = targetTenant ? targetTenant.hrzEmail : '';
    tenantHrzEmpID.value = targetTenant ? targetTenant.hrzEmpID : '';
    crossTenantModal.classList.remove('hidden');
}

async function saveCrossTenantConfig() {
    const baseUrl = tenantBaseUrl.value.trim();
    const employeeGUID = tenantEmployeeGUID.value.trim();
    const hrzEmail = tenantHrzEmail.value.trim();
    const hrzEmpID = tenantHrzEmpID.value.trim();

    if (!baseUrl || !employeeGUID || !hrzEmail || !hrzEmpID) {
        showToast('Please fill in all target tenant fields.', 'error');
        return;
    }

    crossTenantSaveBtn.disabled = true;
    crossTenantSaveBtn.textContent = 'Connecting...';

    const previousTenant = targetTenant;
    targetTenant = { baseUrl, employeeGUID, hrzEmail, hrzEmpID };

    // Switching tenants invalidates every Target selection tied to the
    // previous tenant's workflows.
    targetEntries = [];
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();
    renderTargetPanel();
    updateActionAvailability();

    try {
        await loadTargetWorkflows();

        tenantBadgeText.textContent = `Cross-tenant target: ${baseUrl}`;
        tenantBadge.classList.remove('hidden');
        crossTenantModal.classList.add('hidden');
        showToast('Connected to target tenant.', 'success');

    } catch (error) {
        console.error(error);
        targetTenant = previousTenant; // roll back so the badge/state stays consistent with what's actually loaded
        showToast('Unable to connect to that target tenant.', 'error');
    } finally {
        crossTenantSaveBtn.disabled = false;
        crossTenantSaveBtn.textContent = 'Connect Target Tenant';
    }
}

async function resetCrossTenant() {
    targetTenant = null;
    targetEntries = [];
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();
    renderTargetPanel();
    tenantBadge.classList.add('hidden');
    updateActionAvailability();

    await loadTargetWorkflows();
    showToast('Target reset to the default tenant.', 'success');
}

/* ============================================= */
/* STEP TRACK (decorative progress indicator)     */
/* ============================================= */

function updateStepTrack() {
    const hasLoadedSource = sourceEntries.some(e => !e.loading);
    const hasTarget = targetEntries.length > 0;

    if (!hasLoadedSource) {
        setActiveStep(1, []);
    } else if (!hasTarget) {
        setActiveStep(2, [1]);
    } else {
        setActiveStep(3, [1, 2]);
    }
}

/* ============================================= */
/* ACTION AVAILABILITY (Import + Generate JSON)   */
/* ============================================= */

function isReadyToMigrate() {
    return getSelectedPairs().length > 0;
}

// A validation result set is only trustworthy for the exact set of
// selected pairs it was computed against - if the pair-matrix selection
// changes afterward (checkbox toggled, or a Source/Target added/removed),
// it goes stale.
function computeSelectionSignature() {
    return getSelectedPairs()
        .map(({ sourceEntry, targetEntry }) => pairKey(sourceEntry.id, targetEntry.id))
        .sort()
        .join(',');
}

function invalidateValidation() {
    lastValidationPairs = null;
    lastValidationSignature = null;
    validationPanel.classList.add('hidden');
    validationList.innerHTML = '';
}

function validationIsCurrent() {
    return Boolean(lastValidationPairs) && lastValidationSignature === computeSelectionSignature();
}

// The inline "Show Transformed JSON" viewer only ever reflects the most
// recently generated single-pair preview payload - collapse and clear it
// whenever that payload goes stale (new selection, tenant switch, etc).
function resetTransformedJsonViewer() {
    toggleJsonBtn.classList.add('hidden');
    toggleJsonBtn.setAttribute('aria-expanded', 'false');
    toggleJsonBtn.textContent = 'Show Transformed JSON';
    jsonViewerWrap.classList.add('hidden');
    jsonViewer.value = '';
}

// The "Preview pair" / Generate JSON tool inspects any one loaded
// Source + Target combination, independent of which boxes are checked in
// the pair matrix - it's a read-only inspection aid, not a migration
// action - so it only needs *something* on each side to pick from.
function hasLoadedSourceAndTarget() {
    return sourceEntries.some(e => !e.loading) && targetEntries.length > 0;
}

function updateActionAvailability() {
    const ready = isReadyToMigrate();

    generateJsonBtn.disabled = !hasLoadedSourceAndTarget();
    validateBtn.disabled = !ready;

    const canImport = ready
        && validationIsCurrent()
        && lastValidationPairs.some(p => p.errors.length === 0);
    importBtn.disabled = !canImport;
}

/* ============================================= */
/* COMPATIBILITY VALIDATION (Source x Target)     */
/* ============================================= */

// Runs validateWorkflowPair() across exactly the pairs currently checked in
// the pair-selection matrix (not necessarily every Source x Target
// combination), so the person can see, pair by pair, which of their chosen
// import operations are blocked before committing to a bulk import.
function runValidation() {
    if (!isReadyToMigrate()) {
        showToast('Check at least one Source \u2192 Target pair in the matrix above first.', 'error');
        return;
    }

    const pairs = getSelectedPairs().map(({ sourceEntry, targetEntry }) => {
        const result = validateWorkflowPair(sourceEntry.workflow, targetEntry.workflow);
        return {
            sourceId: sourceEntry.id,
            targetId: targetEntry.id,
            sourceName: workflowDisplayName(sourceEntry.workflow),
            targetName: workflowDisplayName(targetEntry.workflow),
            errors: result.errors,
            warnings: result.warnings,
            dependencies: result.dependencies
        };
    });

    lastValidationPairs = pairs;
    lastValidationSignature = computeSelectionSignature();

    validationPanel.classList.remove('hidden');
    renderPairValidationResults(validationSummary, validationList, pairs);

    const blocked = pairs.filter(p => p.errors.length > 0).length;
    if (blocked > 0) {
        showToast(`${blocked} of ${pairs.length} pair(s) blocked by validation errors.`, 'error');
    } else {
        const withWarnings = pairs.filter(p => p.warnings.length > 0).length;
        showToast(withWarnings > 0
            ? `All ${pairs.length} pair(s) passed with ${withWarnings} warning(s) to review.`
            : `All ${pairs.length} pair(s) passed validation.`, 'success');
    }

    updateActionAvailability();
}

/* ============================================= */
/* SYSTEM GENERATED JSON (single-pair preview)    */
/* ============================================= */

async function generateAndShowMigrationJson() {
    const sourceEntry = sourceEntries.find(e => e.id === previewSourceSelect.value);
    const targetEntry = targetEntries.find(e => e.id === previewTargetSelect.value);

    if (!sourceEntry || sourceEntry.loading || !targetEntry) {
        showToast('Pick a loaded Source and a Target above to preview a pair.', 'error');
        return;
    }

    generateJsonBtn.disabled = true;
    generateJsonBtn.textContent = 'Generating...';

    try {
        const { payload, stageCount, triggerType } = buildWorkflowMigrationPayload(
            sourceEntry.workflow,
            targetEntry.workflow
        );

        lastGeneratedPayload = payload;

        generatedJsonViewer.value = JSON.stringify(payload, null, 2);
        generatedJsonMeta.textContent = `${stageCount} stages \u00b7 ${triggerType} \u00b7 ${workflowDisplayName(sourceEntry.workflow)} \u2192 ${workflowDisplayName(targetEntry.workflow)}`;
        generatedJsonModal.classList.remove('hidden');

        // Keep the inline center-panel viewer (toggleJsonBtn/jsonViewer) in
        // sync too - it shows the transformed payload, not the raw source.
        jsonViewer.value = JSON.stringify(payload, null, 2);
        toggleJsonBtn.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        showToast('Unable to generate the migration JSON.', 'error');
    } finally {
        generateJsonBtn.disabled = !hasLoadedSourceAndTarget();
        generateJsonBtn.textContent = 'View / Download Generated JSON';
    }
}

/* ============================================= */
/* CONFIRMATION MODAL                             */
/* ============================================= */

function openConfirmModal() {
    if (!isReadyToMigrate()) {
        showToast('Check at least one Source \u2192 Target pair in the matrix above first.', 'error');
        return;
    }

    if (!validationIsCurrent()) {
        showToast('Please run Validate Selected Pairs before importing.', 'error');
        return;
    }

    const importablePairs = lastValidationPairs.filter(p => p.errors.length === 0);
    const blockedPairs = lastValidationPairs.filter(p => p.errors.length > 0);

    if (importablePairs.length === 0) {
        showToast('Every pair is blocked by validation errors. Resolve them before importing.', 'error');
        return;
    }

    confirmPairSummary.textContent = blockedPairs.length > 0
        ? `${importablePairs.length} import operation(s) will run. ${blockedPairs.length} pair(s) are blocked by validation errors and will be skipped.`
        : `${importablePairs.length} import operation(s) will run.`;

    confirmPairList.innerHTML = '';
    importablePairs.slice(0, 6).forEach(pair => {
        const li = document.createElement('li');
        li.textContent = `${pair.sourceName} \u2192 ${pair.targetName}`;
        confirmPairList.appendChild(li);
    });
    if (importablePairs.length > 6) {
        const li = document.createElement('li');
        li.textContent = `\u2026and ${importablePairs.length - 6} more`;
        confirmPairList.appendChild(li);
    }

    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}

/* ============================================= */
/* BULK IMPORT / MIGRATION                        */
/* ============================================= */

// Runs one import operation per importable (error-free) pair from the last
// validation run, sequentially - one at a time, not in parallel - so the
// per-pair progress list stays easy to follow and so a shared-tenant API
// with no documented concurrency guarantees isn't hit with a burst of
// simultaneous writes. Pairs that were blocked by validation errors are
// listed as "skipped" rather than attempted.
async function runBulkImport() {
    const importablePairs = lastValidationPairs.filter(p => p.errors.length === 0);
    const skippedPairs = lastValidationPairs.filter(p => p.errors.length > 0);

    setActiveStep(4, [1, 2, 3]);
    progressPanel.classList.remove('hidden');
    progressList.innerHTML = '';
    trackDot.classList.add('traveling');
    importBtn.disabled = true;
    generateJsonBtn.disabled = true;
    validateBtn.disabled = true;

    const rows = importablePairs.map(pair => ({
        pair,
        el: addProgressStep(progressList, `${pair.sourceName} \u2192 ${pair.targetName}`)
    }));

    skippedPairs.forEach(pair => {
        const el = addProgressStep(progressList, `${pair.sourceName} \u2192 ${pair.targetName} (blocked by validation)`);
        setStepState(el, 'skipped');
    });

    const results = [];
    let succeeded = 0;
    let failed = 0;
    let totalStages = 0;
    const overallStart = performance.now();

    for (const { pair, el } of rows) {
        const sourceEntry = sourceEntries.find(e => e.id === pair.sourceId);
        const targetEntry = targetEntries.find(e => e.id === pair.targetId);

        if (!sourceEntry || !targetEntry) {
            setStepState(el, 'error');
            failed += 1;
            results.push(buildMigrationSummary({
                sourceWorkflow: sourceEntry ? sourceEntry.workflow : null,
                targetWorkflow: targetEntry ? targetEntry.workflow : null,
                stageCount: 0,
                triggerType: 'Unknown',
                dependencies: pair.dependencies,
                warnings: pair.warnings,
                errors: pair.errors,
                status: 'failed',
                errorMessage: 'Source or Target selection changed during import.'
            }));
            continue;
        }

        setStepState(el, 'active');

        try {
            // Re-fetch both workflows fresh right before their own import,
            // even though validation already ran, to guarantee the latest
            // data for that specific pair. An uploaded-JSON source isn't
            // part of any tenant's records and has no WFID to look up by -
            // the uploaded/edited object itself is treated as authoritative.
            const freshSource = sourceEntry.uploaded
                ? sourceEntry.workflow
                : await fetchWorkflowById(sourceEntry.workflow.WFID);

            const freshTarget = await fetchWorkflowById(targetEntry.workflow.WFID, targetTenant);

            const { payload, stageCount, triggerType } = buildWorkflowMigrationPayload(freshSource, freshTarget);
            await updateWorkflow(payload, targetTenant);

            setStepState(el, 'done');
            succeeded += 1;
            totalStages += stageCount;

            results.push(buildMigrationSummary({
                sourceWorkflow: freshSource,
                targetWorkflow: freshTarget,
                stageCount,
                triggerType,
                dependencies: pair.dependencies,
                warnings: pair.warnings,
                errors: pair.errors,
                status: 'success'
            }));

        } catch (error) {
            console.error(error);
            setStepState(el, 'error');
            failed += 1;

            results.push(buildMigrationSummary({
                sourceWorkflow: sourceEntry.workflow,
                targetWorkflow: targetEntry.workflow,
                stageCount: 0,
                triggerType: 'Unknown',
                dependencies: pair.dependencies,
                warnings: pair.warnings,
                errors: pair.errors,
                status: 'failed',
                errorMessage: error.message
            }));
        }
    }

    skippedPairs.forEach(pair => {
        const sourceEntry = sourceEntries.find(e => e.id === pair.sourceId);
        const targetEntry = targetEntries.find(e => e.id === pair.targetId);

        results.push(buildMigrationSummary({
            sourceWorkflow: sourceEntry ? sourceEntry.workflow : null,
            targetWorkflow: targetEntry ? targetEntry.workflow : null,
            stageCount: 0,
            triggerType: 'Unknown',
            dependencies: pair.dependencies,
            warnings: pair.warnings,
            errors: pair.errors,
            status: 'skipped'
        }));
    });

    trackDot.classList.remove('traveling');
    lastBulkSummary = results;

    const elapsedSeconds = ((performance.now() - overallStart) / 1000).toFixed(1);

    if (failed === 0) {
        showToast(`Bulk import completed: ${succeeded} of ${lastValidationPairs.length} pair(s) imported successfully.`, 'success');
    } else if (succeeded > 0) {
        showToast(`Bulk import finished with ${failed} failure(s) out of ${importablePairs.length} attempted.`, 'error');
    } else {
        showToast('Bulk import failed for every attempted pair.', 'error');
    }

    showBulkSuccessModal({
        total: lastValidationPairs.length,
        succeeded,
        failed,
        skipped: skippedPairs.length,
        totalStages,
        timeLabel: `${elapsedSeconds}s`
    });

    importBtn.disabled = false;
    generateJsonBtn.disabled = false;
    validateBtn.disabled = false;
    updateActionAvailability();
}

/* ============================================= */
/* SUCCESS MODAL / RESET                          */
/* ============================================= */

function showBulkSuccessModal({ total, succeeded, failed, skipped, totalStages, timeLabel }) {
    successTitle.textContent = failed > 0
        ? 'Bulk import completed with issues'
        : 'Workflows imported successfully';

    successPairsTotal.textContent = total;
    successPairsSucceeded.textContent = succeeded;
    successPairsFailed.textContent = failed;
    successPairsSkipped.textContent = skipped;
    successStagesTotal.textContent = totalStages;
    successTime.textContent = timeLabel;

    successModal.classList.remove('hidden');
}

function resetForNewImport() {
    successModal.classList.add('hidden');

    sourceEntries = [];
    targetEntries = [];
    focusedSourceId = null;
    uploadedEditorLoadedId = null;

    selectedPairKeys = new Set();
    knownPairKeys = new Set();

    lastGeneratedPayload = null;
    lastBulkSummary = null;
    invalidateValidation();

    sourceSearchInput.value = '';
    targetSearchInput.value = '';
    hideAutocompleteDropdown(sourceAutocompleteList);
    hideAutocompleteDropdown(targetAutocompleteList);

    resetTransformedJsonViewer();

    uploadedJsonEditorWrap.classList.add('hidden');
    uploadedJsonEditor.value = '';
    downloadSourceJsonBtn.disabled = true;
    downloadSourceJsonBtn.textContent = 'Download JSON';
    viewSourceJsonBtn.disabled = true;
    sourceJsonViewerWrap.classList.add('hidden');
    sourceJsonViewer.value = '';
    viewSourceJsonBtn.textContent = 'View JSON';
    viewSourceJsonBtn.setAttribute('aria-expanded', 'false');

    progressPanel.classList.add('hidden');
    progressList.innerHTML = '';

    importBtn.disabled = true;
    generateJsonBtn.disabled = true;
    generateJsonBtn.textContent = 'View / Download Generated JSON';
    validateBtn.disabled = true;

    renderSourcePanel();
    renderTargetPanel();

    setActiveStep(1);
}
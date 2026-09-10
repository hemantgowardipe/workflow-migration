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

const exportSummaryJsonBtn = document.getElementById('exportSummaryJsonBtn');
const exportSummaryTextBtn = document.getElementById('exportSummaryTextBtn');

const summaryCard = document.getElementById('summaryCard');
const summaryPairCount = document.getElementById('summaryPairCount');
const pairSourceSearch = document.getElementById('pairSourceSearch');
const pairTargetSearch = document.getElementById('pairTargetSearch');
const pairSourceListContainer = document.getElementById('pairSourceListContainer');
const pairTargetListContainer = document.getElementById('pairTargetListContainer');
const pairTargetHeading = document.getElementById('pairTargetHeading');
const pairReviewToggleBtn = document.getElementById('pairReviewToggleBtn');
const pairReviewList = document.getElementById('pairReviewList');
const focusedSourceName = document.getElementById('focusedSourceName');
const statStages = document.getElementById('statStages');
const statTrigger = document.getElementById('statTrigger');
const statType = document.getElementById('statType');

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
const successStagesTotal = document.getElementById('successStagesTotal');
const successTime = document.getElementById('successTime');
const importAnotherBtn = document.getElementById('importAnotherBtn');

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

// `selectedPairKeys` holds pairKey(sourceId, targetId) for every migration
// pair currently turned on in the picker - this is the actual set Import
// operates on. A Target can only ever be claimed by ONE Source at a time
// (there's no "multiple Sources overwrite the same Target" use case - the
// second import would just clobber the first).
//
// Most pairs are still built by hand via the Targets checklist, but the
// FIRST time a given Source/Target combination is ever considered, it's
// auto-selected if the two share a name (WFName or AppTitle, case-
// insensitive) and the Target isn't already claimed by a different Source -
// see syncPairSelection() below. `knownPairKeys` records every combination
// that's already been through that one-time check, so a person unchecking
// an auto-matched pair (or leaving a non-matching one unchecked) sticks
// across later re-renders instead of being re-evaluated every time.
let selectedPairKeys = new Set();
let knownPairKeys = new Set();

// State for the master-detail pair picker itself (separate from the
// left-panel focusedSourceId, which drives JSON view/download/edit) -
// which Source's Target list is currently showing, and the two free-text
// filters for narrowing each side of the picker at scale.
let pairFocusedSourceId = null;
let pairSourceFilter = '';
let pairTargetFilter = '';
let pairReviewOpen = false;

let lastBulkSummary = null; // array of per-pair audit summaries from the most recent bulk import (for export)

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
        focusedId: focusedSourceId
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
    renderPairOverview();
    updateStepTrack();
}

function renderFocusedSourceSummary() {
    const entry = sourceEntries.find(e => e.id === focusedSourceId);

    if (!entry) {
        summaryCard.classList.add('hidden');
        uploadedJsonEditorWrap.classList.add('hidden');
        return;
    }

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
    updateActionAvailability();
}

function removeTargetEntry(id) {
    const removed = targetEntries.find(e => e.id === id);
    targetEntries = targetEntries.filter(e => e.id !== id);

    renderTargetPanel();
    updateActionAvailability();

    if (removed) {
        showToast(`Removed "${workflowDisplayName(removed.workflow)}" from Target.`, 'info');
    }
}

function renderTargetPanel() {
    renderChipList(targetWorkflowContainer, targetEntries, {
        onRemove: removeTargetEntry
    });

    targetCountEl.textContent = String(targetEntries.length);
    renderFocusedSourceSummary();
    renderPairOverview();
    updateStepTrack();
}

/* ============================================= */
/* UPLOAD JSON AS ADDITIONAL SOURCE WORKFLOW(S)   */
/* ============================================= */

// Reads one File as text, wrapped in a Promise so multiple files can be
// read one after another with a plain for/await loop instead of nesting
// FileReader callbacks.
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read that file.'));
        reader.readAsText(file);
    });
}

// The file input allows selecting several files at once (see `multiple` on
// #uploadSourceJsonInput) - each valid one becomes its own Source chip, the
// same as uploading them one at a time. A problem with any single file
// (unreadable, invalid JSON, not a single workflow object) only skips that
// file; it doesn't stop the rest of the batch from being added.
async function handleSourceJsonUpload(event) {
    const files = Array.from(event.target.files || []);
    uploadSourceJsonInput.value = ''; // allow re-uploading the same filename(s) later

    if (files.length === 0) return;

    let addedCount = 0;
    let lastAddedFileName = null;
    const failedNames = [];

    for (const file of files) {
        let raw;
        try {
            raw = await readFileAsText(file);
        } catch (error) {
            failedNames.push(`${file.name} (unreadable)`);
            continue;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            failedNames.push(`${file.name} (invalid JSON)`);
            continue;
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            failedNames.push(`${file.name} (not a single workflow object)`);
            continue;
        }

        const entryId = `uploaded-${Date.now()}-${uploadCounter++}`;
        sourceEntries.push({ id: entryId, workflow: parsed, uploaded: true, loading: false });
        focusedSourceId = entryId;
        lastAddedFileName = file.name;
        addedCount += 1;
    }

    renderSourcePanel();
    updateActionAvailability();

    if (addedCount > 0) {
        showToast(
            addedCount === 1
                ? `"${lastAddedFileName}" added as a Source workflow.`
                : `${addedCount} file(s) added as Source workflows.`,
            'success'
        );
    }

    if (failedNames.length > 0) {
        const shown = failedNames.slice(0, 5).join(', ');
        const suffix = failedNames.length > 5 ? `, and ${failedNames.length - 5} more` : '';
        showToast(`Skipped ${failedNames.length} file(s): ${shown}${suffix}`, 'error');
    }
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
/* PAIR SELECTION: MASTER-DETAIL PICKER           */
/* A Target can only ever belong to ONE Source at */
/* a time - there's no "two Sources overwrite the */
/* same Target" use case, so the Targets list      */
/* itself enforces that rule. The one exception to */
/* "everything is a manual checkbox click" is a    */
/* same-name auto-match - see syncPairSelection(). */
/* ============================================= */

// Returns { sourceEntry, targetEntry } for every currently-selected,
// currently-valid pair (i.e. both sides still loaded and present) - the
// single source of truth used by Import and the pair-count display.
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

// True if `workflowA` and `workflowB` share a name - compared against both
// WFName (internal name) and AppTitle (display name) on each side, case-
// insensitively, since either field might be the one that actually lines up
// between a Source and a Target.
function namesMatch(workflowA, workflowB) {
    const namesA = [workflowA.WFName, workflowA.AppTitle].filter(Boolean).map(n => n.toLowerCase());
    const namesB = [workflowB.WFName, workflowB.AppTitle].filter(Boolean).map(n => n.toLowerCase());

    if (namesA.length === 0 || namesB.length === 0) return false;

    return namesA.some(name => namesB.includes(name));
}

// Removes any selected pair whose Source or Target no longer exists, then
// auto-selects any brand-new Source/Target combination that shares a name
// (and whose Target isn't already claimed by a different Source), and
// finally resolves ownership conflicts: if more than one Source somehow
// ended up claiming the same Target, only the first (in Source list order)
// is kept and the rest are dropped, since a Target can only belong to one
// Source. Returns a Map of targetId -> sourceId for whichever Target owns
// it (if any) after all of that, so callers don't have to recompute it
// separately.
function syncPairSelection() {
    const loadedSources = sourceEntries.filter(e => !e.loading);
    const validKeys = new Set();

    loadedSources.forEach(s => {
        targetEntries.forEach(t => validKeys.add(pairKey(s.id, t.id)));
    });

    // Drop selection/bookkeeping for anything referencing a Source or
    // Target that no longer exists.
    Array.from(selectedPairKeys).forEach(key => {
        if (!validKeys.has(key)) {
            selectedPairKeys.delete(key);
        }
    });
    Array.from(knownPairKeys).forEach(key => {
        if (!validKeys.has(key)) {
            knownPairKeys.delete(key);
        }
    });

    // Auto-match: the FIRST time a given Source/Target combination is ever
    // seen, check whether they share a name and, if so, select the pair
    // automatically - no checkbox click required. Every combination is only
    // ever considered once (tracked in knownPairKeys), so a person
    // unchecking an auto-matched pair - or simply not checking a
    // non-matching one - is never silently overridden on a later re-render.
    // Sources are processed in list order, so if two Sources happen to
    // share a name with the same Target, the first Source in the list wins
    // and the second is left for manual selection, consistent with the
    // one-Source-per-Target rule.
    loadedSources.forEach(s => {
        targetEntries.forEach(t => {
            const key = pairKey(s.id, t.id);
            if (knownPairKeys.has(key)) return;
            knownPairKeys.add(key);

            if (!namesMatch(s.workflow, t.workflow)) return;

            const alreadyClaimed = loadedSources.some(other => other.id !== s.id
                && selectedPairKeys.has(pairKey(other.id, t.id)));

            if (!alreadyClaimed) {
                selectedPairKeys.add(key);
            }
        });
    });

    const owners = new Map();
    loadedSources.forEach(s => {
        targetEntries.forEach(t => {
            const key = pairKey(s.id, t.id);
            if (!selectedPairKeys.has(key)) return;

            if (owners.has(t.id)) {
                selectedPairKeys.delete(key); // another Source already claimed this Target
            } else {
                owners.set(t.id, s.id);
            }
        });
    });

    return owners;
}

// Read-only helper for renderPairOverview(): which Targets can `sourceId`
// currently be paired with - i.e. every Target that either isn't claimed by
// any Source yet, or is already claimed by `sourceId` itself. Targets owned
// by a *different* Source are left out entirely.
function getAvailableTargetsForSource(sourceId, owners) {
    if (!sourceId) return [];
    return targetEntries.filter(t => {
        const ownerId = owners.get(t.id);
        return !ownerId || ownerId === sourceId;
    });
}

// Renders every piece of the master-detail pair picker from current state:
// the pair-count banner, the Sources list (with per-row selected-count
// badges), the Targets list scoped to whichever Source is focused (with
// Targets already claimed by a different Source left out entirely), and
// the flat "review" list of every currently selected pair. Called after
// any mutation to sourceEntries/targetEntries/selectedPairKeys/filters/focus.
function renderPairOverview() {
    const owners = syncPairSelection();

    const loadedSources = sourceEntries.filter(e => !e.loading);
    const possiblePairCount = loadedSources.length * targetEntries.length;
    const selectedPairs = getSelectedPairs();

    summaryPairCount.textContent = possiblePairCount === 0
        ? 'Add Source and Target workflows to begin.'
        : `${selectedPairs.length} pair(s) selected for import (of ${targetEntries.length} Target(s), ${targetEntries.length - owners.size} still unassigned)`;

    // Keep the focused Source valid - default to the first loaded Source
    // once one exists, and drop the focus if that Source was removed.
    if (!loadedSources.some(s => s.id === pairFocusedSourceId)) {
        pairFocusedSourceId = loadedSources.length > 0 ? loadedSources[0].id : null;
    }

    renderPairSourceList(pairSourceListContainer, loadedSources, {
        focusedId: pairFocusedSourceId,
        filterTerm: pairSourceFilter,
        totalTargets: targetEntries.length,
        getSelectedCount: (sourceId) => targetEntries.filter(t => owners.get(t.id) === sourceId).length,
        onFocus: (sourceId) => {
            pairFocusedSourceId = sourceId;
            renderPairOverview();
        }
    });

    const focusedSourceEntry = loadedSources.find(s => s.id === pairFocusedSourceId);
    pairTargetHeading.textContent = focusedSourceEntry
        ? `Targets for ${workflowDisplayName(focusedSourceEntry.workflow)}`
        : 'Targets';

    const availableTargets = getAvailableTargetsForSource(pairFocusedSourceId, owners);

    renderPairTargetList(pairTargetListContainer, availableTargets, {
        focusedSourceId: pairFocusedSourceId,
        filterTerm: pairTargetFilter,
        totalTargets: targetEntries.length,
        isChecked: (targetId) => owners.get(targetId) === pairFocusedSourceId,
        onToggle: (targetId, checked) => {
            const key = pairKey(pairFocusedSourceId, targetId);
            if (checked) {
                selectedPairKeys.add(key);
            } else {
                selectedPairKeys.delete(key);
            }
            renderPairOverview();
            updateActionAvailability();
        }
    });

    renderPairReviewList(
        pairReviewList,
        selectedPairs.map(({ sourceEntry, targetEntry }) => ({
            sourceId: sourceEntry.id,
            targetId: targetEntry.id,
            sourceName: workflowDisplayName(sourceEntry.workflow),
            targetName: workflowDisplayName(targetEntry.workflow)
        })),
        (sourceId, targetId) => {
            selectedPairKeys.delete(pairKey(sourceId, targetId));
            renderPairOverview();
            updateActionAvailability();
        }
    );
}

pairSourceSearch.addEventListener('input', () => {
    pairSourceFilter = pairSourceSearch.value;
    renderPairOverview();
});

pairTargetSearch.addEventListener('input', () => {
    pairTargetFilter = pairTargetSearch.value;
    renderPairOverview();
});

pairReviewToggleBtn.addEventListener('click', () => {
    pairReviewOpen = !pairReviewOpen;
    pairReviewList.classList.toggle('hidden', !pairReviewOpen);
    pairReviewToggleBtn.setAttribute('aria-expanded', String(pairReviewOpen));
    pairReviewToggleBtn.classList.toggle('pair-review-toggle-open', pairReviewOpen);
});

/* ============================================= */
/* ACTION AVAILABILITY (Import)                   */
/* ============================================= */

function isReadyToMigrate() {
    return getSelectedPairs().length > 0;
}

function updateActionAvailability() {
    importBtn.disabled = !isReadyToMigrate();
}

/* ============================================= */
/* CONFIRMATION MODAL                             */
/* ============================================= */

function openConfirmModal() {
    const pairs = getSelectedPairs();

    if (pairs.length === 0) {
        showToast('Check at least one Source \u2192 Target pair in the picker above first.', 'error');
        return;
    }

    confirmPairSummary.textContent = `${pairs.length} import operation(s) will run.`;

    confirmPairList.innerHTML = '';
    pairs.slice(0, 6).forEach(({ sourceEntry, targetEntry }) => {
        const li = document.createElement('li');
        li.textContent = `${workflowDisplayName(sourceEntry.workflow)} \u2192 ${workflowDisplayName(targetEntry.workflow)}`;
        confirmPairList.appendChild(li);
    });
    if (pairs.length > 6) {
        const li = document.createElement('li');
        li.textContent = `\u2026and ${pairs.length - 6} more`;
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

// Runs one import operation per selected pair, sequentially - one at a
// time, not in parallel - so the per-pair progress list stays easy to
// follow and so a shared-tenant API with no documented concurrency
// guarantees isn't hit with a burst of simultaneous writes. Any failure
// (network, a missing WFID on re-fetch, etc) is caught per pair and
// reported inline rather than stopping the whole batch.
async function runBulkImport() {
    const pairs = getSelectedPairs();

    setActiveStep(4, [1, 2, 3]);
    progressPanel.classList.remove('hidden');
    progressList.innerHTML = '';
    trackDot.classList.add('traveling');
    importBtn.disabled = true;

    const rows = pairs.map(({ sourceEntry, targetEntry }) => ({
        sourceEntry,
        targetEntry,
        el: addProgressStep(progressList, `${workflowDisplayName(sourceEntry.workflow)} \u2192 ${workflowDisplayName(targetEntry.workflow)}`)
    }));

    const results = [];
    let succeeded = 0;
    let failed = 0;
    let totalStages = 0;
    const overallStart = performance.now();

    for (const { sourceEntry, targetEntry, el } of rows) {
        setStepState(el, 'active');

        try {
            // Re-fetch both workflows fresh right before their own import,
            // to guarantee the latest data for that specific pair. An
            // uploaded-JSON source isn't part of any tenant's records and
            // has no WFID to look up by - the uploaded/edited object itself
            // is treated as authoritative.
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
                status: 'failed',
                errorMessage: error.message
            }));
        }
    }

    trackDot.classList.remove('traveling');
    lastBulkSummary = results;

    const elapsedSeconds = ((performance.now() - overallStart) / 1000).toFixed(1);

    if (failed === 0) {
        showToast(`Bulk import completed: ${succeeded} of ${pairs.length} pair(s) imported successfully.`, 'success');
    } else if (succeeded > 0) {
        showToast(`Bulk import finished with ${failed} failure(s) out of ${pairs.length} attempted.`, 'error');
    } else {
        showToast('Bulk import failed for every attempted pair.', 'error');
    }

    showBulkSuccessModal({
        total: pairs.length,
        succeeded,
        failed,
        totalStages,
        timeLabel: `${elapsedSeconds}s`
    });

    importBtn.disabled = false;
    updateActionAvailability();
}

/* ============================================= */
/* SUCCESS MODAL / RESET                          */
/* ============================================= */

function showBulkSuccessModal({ total, succeeded, failed, totalStages, timeLabel }) {
    successTitle.textContent = failed > 0
        ? 'Bulk import completed with issues'
        : 'Workflows imported successfully';

    successPairsTotal.textContent = total;
    successPairsSucceeded.textContent = succeeded;
    successPairsFailed.textContent = failed;
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
    pairFocusedSourceId = null;
    pairSourceFilter = '';
    pairTargetFilter = '';
    pairReviewOpen = false;
    pairSourceSearch.value = '';
    pairTargetSearch.value = '';
    pairReviewList.classList.add('hidden');
    pairReviewToggleBtn.setAttribute('aria-expanded', 'false');
    pairReviewToggleBtn.classList.remove('pair-review-toggle-open');

    lastBulkSummary = null;

    sourceSearchInput.value = '';
    targetSearchInput.value = '';
    hideAutocompleteDropdown(sourceAutocompleteList);
    hideAutocompleteDropdown(targetAutocompleteList);

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

    renderSourcePanel();
    renderTargetPanel();

    setActiveStep(1);
}
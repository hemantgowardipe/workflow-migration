/* ============================================= */
/* DOM REFERENCES                                 */
/* ============================================= */

const workflowContainer = document.getElementById('workflowContainer');
const targetWorkflowContainer = document.getElementById('targetWorkflowContainer');

const sourceSearchInput = document.getElementById('sourceSearchInput');
const targetSearchInput = document.getElementById('targetSearchInput');
const sourceSearchBtn = document.getElementById('sourceSearchBtn');
const targetSearchBtn = document.getElementById('targetSearchBtn');

const sourceStatus = document.getElementById('sourceStatus');
const targetStatus = document.getElementById('targetStatus');

const refreshBtn = document.getElementById('refreshBtn');

const downloadSourceJsonBtn = document.getElementById('downloadSourceJsonBtn');
const viewSourceJsonBtn = document.getElementById('viewSourceJsonBtn');
const sourceJsonViewerWrap = document.getElementById('sourceJsonViewerWrap');
const sourceJsonViewer = document.getElementById('sourceJsonViewer');
const uploadSourceJsonInput = document.getElementById('uploadSourceJsonInput');
const uploadedJsonEditorWrap = document.getElementById('uploadedJsonEditorWrap');
const uploadedJsonEditor = document.getElementById('uploadedJsonEditor');
const useFetchedSourceBtn = document.getElementById('useFetchedSourceBtn');
const saveUploadedJsonBtn = document.getElementById('saveUploadedJsonBtn');

const validateBtn = document.getElementById('validateBtn');
const validationPanel = document.getElementById('validationPanel');
const validationSummary = document.getElementById('validationSummary');
const validationList = document.getElementById('validationList');

const exportSummaryJsonBtn = document.getElementById('exportSummaryJsonBtn');
const exportSummaryTextBtn = document.getElementById('exportSummaryTextBtn');

const summaryEmpty = document.getElementById('summaryEmpty');
const summaryCard = document.getElementById('summaryCard');
const summaryWorkflowName = document.getElementById('summaryWorkflowName');
const statStages = document.getElementById('statStages');
const statTrigger = document.getElementById('statTrigger');
const statType = document.getElementById('statType');

const previewBtn = document.getElementById('previewBtn');
const toggleJsonBtn = document.getElementById('toggleJsonBtn');
const jsonViewerWrap = document.getElementById('jsonViewerWrap');
const jsonViewer = document.getElementById('jsonViewer');

const generateJsonBtn = document.getElementById('generateJsonBtn');

const importBtn = document.getElementById('importBtn');
const trackDot = document.getElementById('trackDot');

const progressPanel = document.getElementById('progressPanel');
const progressList = document.getElementById('progressList');

const selectedTargetName = document.getElementById('selectedTargetName');

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
const confirmSourceName = document.getElementById('confirmSourceName');
const confirmTargetName = document.getElementById('confirmTargetName');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmProceedBtn = document.getElementById('confirmProceedBtn');

const successModal = document.getElementById('successModal');
const successSourceName = document.getElementById('successSourceName');
const successTargetName = document.getElementById('successTargetName');
const successStages = document.getElementById('successStages');
const successTrigger = document.getElementById('successTrigger');
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

let allWorkflows = [];       // source-side list, always the default/home tenant
let targetWorkflows = [];    // target-side list; equals allWorkflows unless cross-tenant is active
let targetTenant = null;     // null = same tenant as source; otherwise { baseUrl, employeeGUID, hrzEmail, hrzEmpID }

let selectedSourceWorkflow = null;
let selectedTargetWorkflow = null;

let previewedSourceWFID = null; // guards against a stale preview being imported/generated

let lastGeneratedPayload = null; // the most recently generated migration JSON (for download)

let sourceIsUploaded = false; // true when the active source came from an uploaded JSON file, not the fetched list

let lastValidation = null;          // result of validateWorkflowCompatibility(), or null if stale/not yet run
let lastValidationSourceKey = null; // snapshot of what was validated, to detect staleness
let lastValidationTargetKey = null;

let lastMigrationSummary = null; // most recently generated audit report (for export)

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

previewBtn.addEventListener('click', previewSourceWorkflow);
toggleJsonBtn.addEventListener('click', toggleJsonViewer);

generateJsonBtn.addEventListener('click', generateAndShowMigrationJson);
downloadGeneratedJsonBtn.addEventListener('click', () => {
    if (!lastGeneratedPayload) return;
    const filename = `${workflowDisplayName(selectedTargetWorkflow) || 'workflow'}-migration.json`;
    downloadTextFile(JSON.stringify(lastGeneratedPayload, null, 2), filename);
});
closeGeneratedJsonBtn.addEventListener('click', () => generatedJsonModal.classList.add('hidden'));

validateBtn.addEventListener('click', runValidation);

exportSummaryJsonBtn.addEventListener('click', () => {
    if (!lastMigrationSummary) return;
    const filename = `${lastMigrationSummary.targetWorkflowName || 'workflow'}-migration-summary.json`;
    downloadTextFile(JSON.stringify(lastMigrationSummary, null, 2), filename);
});
exportSummaryTextBtn.addEventListener('click', () => {
    if (!lastMigrationSummary) return;
    const filename = `${lastMigrationSummary.targetWorkflowName || 'workflow'}-migration-summary.txt`;
    downloadTextFile(formatMigrationSummaryAsText(lastMigrationSummary), filename);
});

downloadSourceJsonBtn.addEventListener('click', () => {
    if (!selectedSourceWorkflow) {
        showToast('Select or upload a Source Workflow first.', 'error');
        return;
    }
    const filename = `${selectedSourceWorkflow.WFName || 'source-workflow'}.json`;
    downloadTextFile(JSON.stringify(selectedSourceWorkflow, null, 2), filename);
});

viewSourceJsonBtn.addEventListener('click', () => {
    if (!selectedSourceWorkflow) {
        showToast('Select or upload a Source Workflow first.', 'error');
        return;
    }

    const isHidden = sourceJsonViewerWrap.classList.contains('hidden');

    if (isHidden) {
        sourceJsonViewer.value = JSON.stringify(selectedSourceWorkflow, null, 2);
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
useFetchedSourceBtn.addEventListener('click', revertToFetchedSource);
saveUploadedJsonBtn.addEventListener('click', saveUploadedJsonEdits);

importBtn.addEventListener('click', openConfirmModal);
confirmCancelBtn.addEventListener('click', closeConfirmModal);
confirmProceedBtn.addEventListener('click', () => {
    closeConfirmModal();
    runImport();
});

importAnotherBtn.addEventListener('click', resetForNewImport);

crossTenantBtn.addEventListener('click', openCrossTenantModal);
crossTenantCancelBtn.addEventListener('click', () => crossTenantModal.classList.add('hidden'));
crossTenantSaveBtn.addEventListener('click', saveCrossTenantConfig);
resetTenantBtn.addEventListener('click', resetCrossTenant);

// Per the search-based Source/Target workflow requirement: we don't show
// the full workflow list any more. Instead, searching looks up a single
// workflow by exact Internal Name (WFName) match against whichever list is
// already loaded in memory (there's no per-workflow "get one" endpoint, see
// api.js), and only that single match is displayed/loaded.
sourceSearchBtn.addEventListener('click', searchSourceWorkflow);
sourceSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchSourceWorkflow();
    }
});

targetSearchBtn.addEventListener('click', searchTargetWorkflow);
targetSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchTargetWorkflow();
    }
});

async function searchSourceWorkflow() {
    const term = sourceSearchInput.value.trim();

    if (!term) {
        showToast('Enter an internal name (WFName) to search.', 'error');
        return;
    }

    const match = allWorkflows.find(w => (w.WFName || '').toLowerCase() === term.toLowerCase());

    if (!match) {
        renderNoSearchResult(workflowContainer, `No workflow found with internal name "${term}".`);
        return;
    }

    sourceSearchBtn.disabled = true;
    sourceSearchBtn.textContent = 'Loading...';
    showSourceListLoading();

    try {
        // WorkflowConfigList only gets us the WFID for this WFName - fetch
        // the authoritative single-record JSON via WFConfigByID so the
        // Source panel reflects the freshest full config, rather than
        // whatever was cached in the last full-list fetch.
        const freshWorkflow = await fetchWorkflowById(match.WFID);
        hideSourceListStatus();
        onSourceWorkflowSelected(freshWorkflow, { uploaded: false });
    } catch (error) {
        console.error(error);
        hideSourceListStatus();
        renderNoSearchResult(workflowContainer, `Unable to load workflow "${term}".`);
        showToast('Unable to load Source Workflow.', 'error');
    } finally {
        sourceSearchBtn.disabled = false;
        sourceSearchBtn.textContent = 'Search';
    }
}

function searchTargetWorkflow() {
    const term = targetSearchInput.value.trim();

    if (!term) {
        showToast('Enter an internal name (WFName) to search.', 'error');
        return;
    }

    const match = targetWorkflows.find(w => (w.WFName || '').toLowerCase() === term.toLowerCase());

    if (!match) {
        renderNoSearchResult(targetWorkflowContainer, `No workflow found with internal name "${term}".`);
        return;
    }

    onTargetWorkflowSelected(match);
}

/* ============================================= */
/* LOAD WORKFLOWS (single API call, shared)       */
/* ============================================= */

// Loads the full workflow directory into memory (allWorkflows/targetWorkflows)
// so search-by-name can resolve instantly, without ever rendering it as a
// browsable list - the Source/Target panels only ever show a single
// search result. Runs automatically on page load and whenever Refresh is
// clicked, so both paths stay in sync (requirement: auto-refresh on load).
async function loadWorkflows() {
    showSourceListLoading();

    try {
        allWorkflows = await fetchAllWorkflows();

        hideSourceListStatus();
        if (!sourceIsUploaded) {
            renderNoSearchResult(workflowContainer, 'Search for a workflow by its internal name (WFName), or upload a JSON file.');
        }

    } catch (error) {
        console.error(error);
        showSourceListError('Unable to load workflows.');
        renderNoSearchResult(workflowContainer, 'Unable to load the workflow directory.');
        showToast('Unable to load Source Workflow.', 'error');
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
        renderNoSearchResult(targetWorkflowContainer, 'Search for a workflow by its internal name (WFName).');

    } catch (error) {
        console.error(error);
        targetStatus.textContent = 'Unable to load Target Workflow.';
        targetStatus.classList.remove('hidden', 'status-loading');
        targetStatus.classList.add('status-error');
        renderNoSearchResult(targetWorkflowContainer, 'Unable to load the workflow directory.');
        showToast('Unable to load Target Workflow.', 'error');
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
/* SOURCE (LEFT) WORKFLOW SELECTION               */
/* ============================================= */

function onSourceWorkflowSelected(workflow, options) {
    const opts = options || {};

    selectedSourceWorkflow = workflow;
    sourceIsUploaded = Boolean(opts.uploaded);

    // Selecting a new source invalidates any previous preview / generated JSON / validation
    previewedSourceWFID = null;
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();

    if (sourceIsUploaded) {
        renderUploadedSourceBadge(workflowContainer, workflow);
        uploadedJsonEditorWrap.classList.remove('hidden');
        uploadedJsonEditor.value = JSON.stringify(workflow, null, 2);
    } else {
        renderSingleWorkflowResult(workflowContainer, workflow, onSourceWorkflowSelected, true);
        uploadedJsonEditorWrap.classList.add('hidden');
    }

    downloadSourceJsonBtn.disabled = false;
    viewSourceJsonBtn.disabled = false;
    if (!sourceJsonViewerWrap.classList.contains('hidden')) {
        sourceJsonViewer.value = JSON.stringify(workflow, null, 2);
    }

    summaryEmpty.classList.add('hidden');
    summaryCard.classList.remove('hidden');
    summaryWorkflowName.textContent = workflowDisplayName(workflow);
    statStages.textContent = '-';
    statTrigger.textContent = '-';
    statType.textContent = '-';

    toggleJsonBtn.classList.add('hidden');
    jsonViewerWrap.classList.add('hidden');
    jsonViewer.value = '';
    toggleJsonBtn.setAttribute('aria-expanded', 'false');
    toggleJsonBtn.textContent = 'Show JSON';

    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview Workflow';

    setActiveStep(1, [1]);
    updateActionAvailability();

    // Requirement: preview loads automatically once a workflow is selected,
    // with no extra click needed. The Preview button stays available for
    // manually re-running it (e.g. after editing the uploaded JSON).
    previewSourceWorkflow();
}

/* ============================================= */
/* PREVIEW (summarize source workflow)            */
/* ============================================= */

// WFConfigByID already returns the full workflow config (StagesConfig
// included) at search time (see searchSourceWorkflow), so - unlike the
// repository tool's previewSourceRepository() - there's no separate "get
// one" API call to make here. This just reads the already-loaded object and
// updates the UI.
async function previewSourceWorkflow() {
    if (!selectedSourceWorkflow) {
        showToast('Please select a Source Workflow.', 'error');
        return;
    }

    previewBtn.disabled = true;
    previewBtn.textContent = 'Loading...';

    try {
        const workflow = selectedSourceWorkflow;

        previewedSourceWFID = workflow.WFID;

        const { stageCount, triggerType, workflowType } = summarizeWorkflow(workflow);

        statStages.textContent = stageCount;
        statTrigger.textContent = triggerType;
        statType.textContent = workflowType;

        setActiveStep(2, [1, 2]);
        updateActionAvailability();

        showToast('Workflow preview loaded.', 'success');

    } catch (error) {
        console.error(error);
        showToast('Unable to load Source Workflow.', 'error');
    } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = 'Preview Workflow';
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
/* TARGET (RIGHT) WORKFLOW SELECTION              */
/* No API call - reuses already loaded dataset    */
/* ============================================= */

function onTargetWorkflowSelected(workflow) {
    selectedTargetWorkflow = workflow;
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();

    renderSingleWorkflowResult(targetWorkflowContainer, workflow, onTargetWorkflowSelected, true);

    selectedTargetName.textContent = workflowDisplayName(workflow);

    setActiveStep(3, [1, 2, 3]);
    updateActionAvailability();
}

/* ============================================= */
/* UPLOAD JSON AS ALTERNATIVE SOURCE WORKFLOW     */
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

        onSourceWorkflowSelected(parsed, { uploaded: true });
        showToast('Uploaded JSON is now the active Source Workflow.', 'success');
    };
    reader.onerror = () => showToast('Unable to read that file.', 'error');
    reader.readAsText(file);
}

function saveUploadedJsonEdits() {
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

    onSourceWorkflowSelected(parsed, { uploaded: true });
    showToast('Uploaded JSON changes saved.', 'success');
}

function revertToFetchedSource() {
    sourceIsUploaded = false;
    selectedSourceWorkflow = null;
    previewedSourceWFID = null;
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();

    uploadedJsonEditorWrap.classList.add('hidden');
    uploadedJsonEditor.value = '';
    downloadSourceJsonBtn.disabled = true;
    viewSourceJsonBtn.disabled = true;
    sourceJsonViewerWrap.classList.add('hidden');
    sourceJsonViewer.value = '';
    viewSourceJsonBtn.textContent = 'View JSON';
    viewSourceJsonBtn.setAttribute('aria-expanded', 'false');
    summaryEmpty.classList.remove('hidden');
    summaryCard.classList.add('hidden');

    renderNoSearchResult(workflowContainer, 'Search for a workflow by its internal name (WFName), or upload a JSON file.');
    sourceSearchInput.value = '';

    setActiveStep(1);
    updateActionAvailability();
    showToast('Switched back to the fetched Source Workflow.', 'success');
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

    // Switching tenants invalidates any target selection/preview state tied
    // to the previous tenant's workflows.
    selectedTargetWorkflow = null;
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();
    selectedTargetName.textContent = 'No target selected';
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
    selectedTargetWorkflow = null;
    lastGeneratedPayload = null;
    invalidateValidation();
    resetTransformedJsonViewer();
    selectedTargetName.textContent = 'No target selected';
    tenantBadge.classList.add('hidden');
    updateActionAvailability();

    await loadTargetWorkflows();
    showToast('Target reset to the default tenant.', 'success');
}

/* ============================================= */
/* ACTION AVAILABILITY (Import + Generate JSON)   */
/* ============================================= */

function isReadyToMigrate() {
    return Boolean(
        selectedSourceWorkflow &&
        selectedTargetWorkflow &&
        (sourceIsUploaded || previewedSourceWFID === selectedSourceWorkflow.WFID)
    );
}

// A validation result is only trustworthy for the exact source/target pair
// it was run against - if either selection changes afterward, it goes stale.
function invalidateValidation() {
    lastValidation = null;
    lastValidationSourceKey = null;
    lastValidationTargetKey = null;
    validationPanel.classList.add('hidden');
    validationList.innerHTML = '';
}

// The inline "Show Transformed JSON" viewer only ever reflects the most
// recently generated migration payload - collapse and clear it whenever
// that payload goes stale (new source/target selection, tenant switch, etc).
function resetTransformedJsonViewer() {
    toggleJsonBtn.classList.add('hidden');
    toggleJsonBtn.setAttribute('aria-expanded', 'false');
    toggleJsonBtn.textContent = 'Show Transformed JSON';
    jsonViewerWrap.classList.add('hidden');
    jsonViewer.value = '';
}

function validationIsCurrent() {
    return Boolean(
        lastValidation &&
        lastValidationSourceKey === selectedSourceWorkflow &&
        lastValidationTargetKey === selectedTargetWorkflow
    );
}

function updateActionAvailability() {
    const ready = isReadyToMigrate();
    generateJsonBtn.disabled = !ready;
    validateBtn.disabled = !ready;

    const canImport = ready && validationIsCurrent() && lastValidation.errors.length === 0;
    importBtn.disabled = !canImport;
}

/* ============================================= */
/* COMPATIBILITY VALIDATION (Source -> Target)    */
/* ============================================= */

function runValidation() {
    if (!isReadyToMigrate()) {
        showToast('Select and preview a source, then select a target, first.', 'error');
        return;
    }

    lastValidation = validateWorkflowCompatibility(selectedSourceWorkflow, selectedTargetWorkflow);
    lastValidationSourceKey = selectedSourceWorkflow;
    lastValidationTargetKey = selectedTargetWorkflow;

    validationPanel.classList.remove('hidden');
    renderValidationResults(validationSummary, validationList, lastValidation);

    if (lastValidation.errors.length > 0) {
        showToast(`Validation found ${lastValidation.errors.length} blocking error(s).`, 'error');
    } else if (lastValidation.warnings.length > 0) {
        showToast(`Validation passed with ${lastValidation.warnings.length} warning(s) to review.`, 'info');
    } else {
        showToast('Validation passed with no issues.', 'success');
    }

    updateActionAvailability();
}

/* ============================================= */
/* SYSTEM GENERATED JSON (preview + download)     */
/* ============================================= */

async function generateAndShowMigrationJson() {
    if (!isReadyToMigrate()) {
        showToast('Select and preview a source, then select a target, first.', 'error');
        return;
    }

    generateJsonBtn.disabled = true;
    generateJsonBtn.textContent = 'Generating...';

    try {
        const { payload, stageCount, triggerType } = buildWorkflowMigrationPayload(
            selectedSourceWorkflow,
            selectedTargetWorkflow
        );

        lastGeneratedPayload = payload;

        generatedJsonViewer.value = JSON.stringify(payload, null, 2);
        generatedJsonMeta.textContent = `${stageCount} stages \u00b7 ${triggerType} \u00b7 target: ${workflowDisplayName(selectedTargetWorkflow)}`;
        generatedJsonModal.classList.remove('hidden');

        // Keep the inline center-panel viewer (toggleJsonBtn/jsonViewer) in
        // sync too - it shows the transformed payload, not the raw source.
        jsonViewer.value = JSON.stringify(payload, null, 2);
        toggleJsonBtn.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        showToast('Unable to generate the migration JSON.', 'error');
    } finally {
        generateJsonBtn.disabled = !isReadyToMigrate();
        generateJsonBtn.textContent = 'View / Download Generated JSON';
    }
}

/* ============================================= */
/* CONFIRMATION MODAL                             */
/* ============================================= */

function openConfirmModal() {
    if (!selectedSourceWorkflow) {
        showToast('Please select a Source Workflow.', 'error');
        return;
    }

    if (!sourceIsUploaded && previewedSourceWFID !== selectedSourceWorkflow.WFID) {
        showToast('Please preview the source workflow before importing.', 'error');
        return;
    }

    if (!selectedTargetWorkflow) {
        showToast('Please select a Target Workflow.', 'error');
        return;
    }

    if (!validationIsCurrent()) {
        showToast('Please run Validate Compatibility before importing.', 'error');
        return;
    }

    if (lastValidation.errors.length > 0) {
        showToast('Resolve the validation errors before importing.', 'error');
        return;
    }

    confirmSourceName.textContent = workflowDisplayName(selectedSourceWorkflow);
    confirmTargetName.textContent = workflowDisplayName(selectedTargetWorkflow);
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}

/* ============================================= */
/* IMPORT / MIGRATION                             */
/* ============================================= */

async function runImport() {
    const startTime = performance.now();

    setActiveStep(4, [1, 2, 3]);
    progressPanel.classList.remove('hidden');
    progressList.innerHTML = '';
    trackDot.classList.add('traveling');
    importBtn.disabled = true;
    generateJsonBtn.disabled = true;

    const steps = [
        'Loading Source Workflow...',
        'Loading Target Workflow...',
        'Preparing Workflow Configuration...',
        'Uploading Workflow...',
        'Completed Successfully'
    ];

    const stepEls = steps.map(label => addProgressStep(progressList, label));

    try {
        // Steps 1-2: re-fetch both workflows fresh right before import, even
        // if a preview already ran, to guarantee the latest data. Now that
        // WFConfigByID is confirmed (see api.js), both source and target are
        // re-read directly by WFID instead of pulling the entire
        // WorkflowConfigList and filtering client-side.
        //
        // Exception: an uploaded-JSON source isn't part of any tenant's
        // records and has no WFID to look up by - the uploaded/edited object
        // itself is treated as authoritative.
        setStepState(stepEls[0], 'active');
        let freshSource;
        if (sourceIsUploaded) {
            freshSource = selectedSourceWorkflow;
        } else {
            try {
                freshSource = await fetchWorkflowById(selectedSourceWorkflow.WFID);
            } catch (fetchError) {
                throw new Error('Source workflow could not be found on reload.');
            }
        }
        setStepState(stepEls[0], 'done');

        setStepState(stepEls[1], 'active');
        let freshTarget;
        try {
            freshTarget = await fetchWorkflowById(selectedTargetWorkflow.WFID, targetTenant);
        } catch (fetchError) {
            throw new Error('Target workflow could not be found on reload.');
        }
        setStepState(stepEls[1], 'done');

        // Step 3: Preparing Workflow Configuration
        setStepState(stepEls[2], 'active');
        const { payload, stageCount, triggerType } = buildWorkflowMigrationPayload(freshSource, freshTarget);
        lastGeneratedPayload = payload;
        setStepState(stepEls[2], 'done');

        // Step 4: Uploading Workflow
        setStepState(stepEls[3], 'active');
        await updateWorkflow(payload, targetTenant);
        setStepState(stepEls[3], 'done');

        // Step 5: Completed Successfully
        setStepState(stepEls[4], 'done');

        const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(1);

        lastMigrationSummary = buildMigrationSummary({
            sourceWorkflow: freshSource,
            targetWorkflow: freshTarget,
            stageCount,
            triggerType,
            dependencies: lastValidation ? lastValidation.dependencies : [],
            warnings: lastValidation ? lastValidation.warnings : [],
            errors: lastValidation ? lastValidation.errors : [],
            status: 'success'
        });

        showSuccessModal({
            stages: stageCount,
            trigger: triggerType,
            timeLabel: `${elapsedSeconds}s`
        });

    } catch (error) {
        console.error(error);
        const activeEl = stepEls.find(el => el.classList.contains('active'));
        if (activeEl) {
            setStepState(activeEl, 'error');
        }

        lastMigrationSummary = buildMigrationSummary({
            sourceWorkflow: selectedSourceWorkflow,
            targetWorkflow: selectedTargetWorkflow,
            stageCount: 0,
            triggerType: 'Unknown',
            dependencies: lastValidation ? lastValidation.dependencies : [],
            warnings: lastValidation ? lastValidation.warnings : [],
            errors: lastValidation ? lastValidation.errors : [],
            status: 'failed',
            errorMessage: error.message
        });

        showToast('Workflow import failed.', 'error');
        importBtn.disabled = false;
        generateJsonBtn.disabled = false;
    } finally {
        trackDot.classList.remove('traveling');
    }
}

/* ============================================= */
/* SUCCESS MODAL / RESET                          */
/* ============================================= */

function showSuccessModal({ stages, trigger, timeLabel }) {
    successSourceName.textContent = workflowDisplayName(selectedSourceWorkflow);
    successTargetName.textContent = workflowDisplayName(selectedTargetWorkflow);
    successStages.textContent = stages;
    successTrigger.textContent = trigger;
    successTime.textContent = timeLabel;

    successModal.classList.remove('hidden');
}

function resetForNewImport() {
    successModal.classList.add('hidden');

    selectedSourceWorkflow = null;
    selectedTargetWorkflow = null;
    previewedSourceWFID = null;
    lastGeneratedPayload = null;
    lastMigrationSummary = null;
    sourceIsUploaded = false;
    invalidateValidation();

    sourceSearchInput.value = '';
    targetSearchInput.value = '';

    summaryEmpty.classList.remove('hidden');
    summaryCard.classList.add('hidden');
    resetTransformedJsonViewer();

    uploadedJsonEditorWrap.classList.add('hidden');
    uploadedJsonEditor.value = '';
    downloadSourceJsonBtn.disabled = true;
    viewSourceJsonBtn.disabled = true;
    sourceJsonViewerWrap.classList.add('hidden');
    sourceJsonViewer.value = '';
    viewSourceJsonBtn.textContent = 'View JSON';
    viewSourceJsonBtn.setAttribute('aria-expanded', 'false');

    selectedTargetName.textContent = 'No target selected';

    progressPanel.classList.add('hidden');
    progressList.innerHTML = '';

    importBtn.disabled = true;
    generateJsonBtn.disabled = true;
    generateJsonBtn.textContent = 'View / Download Generated JSON';
    validateBtn.disabled = true;

    renderNoSearchResult(workflowContainer, 'Search for a workflow by its internal name (WFName), or upload a JSON file.');
    renderNoSearchResult(targetWorkflowContainer, 'Search for a workflow by its internal name (WFName).');

    setActiveStep(1);
}

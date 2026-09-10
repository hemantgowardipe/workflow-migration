/* ============================================= */
/* WORKFLOW MIGRATION - FIELD OWNERSHIP           */
/* ============================================= */

// Properties that define the actual workflow LOGIC - these are the ones
// being migrated, so they always come from the SOURCE workflow.
// StagesConfig/WorkflowType/NumberOfStages are covered implicitly by the
// merge starting from a full copy of the source object. HttpParams (the
// workflow's HTTP action config - URLs, headers, payload templates used by
// HTTP-type stages/actions) is explicitly re-applied from source in
// buildWorkflowMigrationPayload below, the same way WORKFLOW_TARGET_OWNED_PROPS
// are re-applied from target, so it can never be silently dropped or left
// holding a stale target value.
const WORKFLOW_STRUCTURAL_PROPS = ['WorkflowType', 'NumberOfStages', 'StagesConfig', 'HttpParams'];

// Properties that identify/label the TARGET workflow record itself.
// When building the migration payload, every workflow-level property comes
// from the SOURCE workflow (its logic is what's being copied) EXCEPT this
// fixed list, which must always stay as the TARGET's own value, since these
// identify the target record and control how it appears in the app launcher.
//
// ObjectID, ObjectName and TriggerdOn are included here (not just the
// WFID/WFName identity fields) because those three must always reflect the
// TARGET workflow, never the source - even though TriggerdOn is otherwise a
// "logic" field. They are re-applied after the source copy below so they
// can never be silently overwritten with the source workflow's values.
//
// AppPermissions and OtherPermissions are also target-owned: who/what has
// access to the TARGET app is a property of the target record, not
// something that should be migrated in from the source workflow.
//
// NOTE: only WFID, WFName, AppTitle, AppDescription, ShowInApps and
// IsDisabled are documented fields. Any audit-style fields (created/modified
// by or date) are NOT in the API reference for workflows - if the real
// payload includes them, add their names to this list too so they don't get
// silently overwritten with the source workflow's values.
const WORKFLOW_TARGET_OWNED_PROPS = [
    'WFID',
    'WFName',
    'AppTitle',
    'AppDescription',
    'ShowInApps',
    'IsDisabled',
    'ObjectID',
    'ObjectName',
    'TriggerdOn',
    'AppPermissions',
    'OtherPermissions'
];

/* ============================================= */
/* KEY LOOKUP HELPER                              */
/* ============================================= */

// Finds a value on `obj` by a case-insensitive property name match.
function getProp(obj, name) {
    const key = Object.keys(obj || {}).find(k => k.toLowerCase() === name.toLowerCase());
    return key !== undefined ? obj[key] : undefined;
}

// StagesConfig is documented/expected as an array, but this tenant's API
// sometimes serializes nested config as a JSON-encoded string instead of an
// already-parsed array. Any code that needs to inspect StagesConfig's
// contents (validation, dependency scanning) should go through this helper
// rather than reading the raw property + Array.isArray directly, so a
// stringified array isn't mistaken for "missing".
//
// Returns a real array in both cases, or null if StagesConfig is missing,
// empty, or a string that doesn't parse to an array (so callers can still
// distinguish "no data" from "has data").
function getStagesConfigArray(workflow) {
    const raw = getProp(workflow, 'StagesConfig');

    if (Array.isArray(raw)) {
        return raw;
    }

    if (typeof raw === 'string' && raw.trim() !== '') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (parseError) {
            return null;
        }
    }

    return null;
}

/* ============================================= */
/* SUMMARY (used by the Preview step)             */
/* ============================================= */

// Unlike repositories, WorkflowConfigList already returns the full
// workflow config (StagesConfig included) - there's no separate
// "get workflow details" endpoint to call, so summarizing is just reading
// fields directly off the already-loaded workflow object.
function summarizeWorkflow(workflow) {
    const stageCount = Number(getProp(workflow, 'NumberOfStages')) || 0;
    const triggerType = getProp(workflow, 'TriggerdOn') || 'Unknown';
    const workflowType = getProp(workflow, 'WorkflowType');

    return {
        stageCount,
        triggerType,
        workflowType: workflowType !== undefined && workflowType !== null && workflowType !== ''
            ? workflowType
            : 'Unknown'
    };
}

/* ============================================= */
/* MIGRATION PAYLOAD (shared by preview + import) */
/* ============================================= */

// Pure function: given a source workflow object and a target workflow
// object, produces the exact payload that would be sent to the workflow
// update endpoint, without performing any network calls itself.
//
// Strategy: copy the source workflow's logic (WorkflowType, NumberOfStages,
// StagesConfig - and anything else present on it) as-is, then re-apply the
// target's own owned fields (WFID, WFName, AppTitle, AppDescription,
// ShowInApps, IsDisabled, ObjectID, ObjectName, TriggerdOn, AppPermissions,
// OtherPermissions) so the target record's identity, app-launcher
// visibility, trigger config, and permissions are never overwritten by the
// migration.
//
// NOTE ON StagesConfig: the API doc's examples show StagesConfig entries
// (e.g. { "type": 30, "stageInternalName": ..., "approverStageName": ... })
// with no per-stage GUID/ID field, unlike repository Sections/Fields which
// each carry their own id. So - unlike the repository migration tool -
// nothing inside StagesConfig is regenerated here; it's copied over
// verbatim from the source. If stages do turn out to carry their own scoped
// IDs in the real payload, that regeneration logic would need to be added
// here (parse StagesConfig, remap ids, re-serialize).
function buildWorkflowMigrationPayload(sourceWorkflow, targetWorkflow) {
    const mergedWorkflow = { ...sourceWorkflow };

    WORKFLOW_TARGET_OWNED_PROPS.forEach(prop => {
        const targetKey = Object.keys(targetWorkflow || {}).find(k => k.toLowerCase() === prop.toLowerCase());
        if (targetKey !== undefined) {
            mergedWorkflow[targetKey] = targetWorkflow[targetKey];
        }
    });

    // HttpParams is workflow LOGIC (HTTP action URLs/headers/payload
    // templates), so - like StagesConfig - it must always come from SOURCE.
    // The initial `{...sourceWorkflow}` copy above already includes it under
    // source's own key casing, but it's explicitly re-applied here (mirroring
    // how WORKFLOW_TARGET_OWNED_PROPS is enforced above) so it can never be
    // silently dropped or left as a stale target value:
    //   - if source has HttpParams, force it onto the payload under source's key
    //   - if source has NO HttpParams, strip out any HttpParams-cased key that
    //     may have come from elsewhere, so a stale target value can't linger
    const sourceHttpParamsKey = Object.keys(sourceWorkflow || {}).find(k => k.toLowerCase() === 'httpparams');
    if (sourceHttpParamsKey !== undefined) {
        mergedWorkflow[sourceHttpParamsKey] = sourceWorkflow[sourceHttpParamsKey];
    } else {
        Object.keys(mergedWorkflow).forEach(key => {
            if (key.toLowerCase() === 'httpparams') {
                delete mergedWorkflow[key];
            }
        });
    }

    const payload = mergedWorkflow;

    // Summarize off the final merged payload (not the raw source) so the
    // displayed stats match what's actually being sent - this matters now
    // that TriggerdOn is target-owned and no longer equal to the source's
    // TriggerdOn value.
    const { stageCount, triggerType } = summarizeWorkflow(payload);

    return {
        payload,
        stageCount,
        triggerType
    };
}

/* ============================================= */
/* MIGRATION SUMMARY / AUDIT REPORT               */
/* ============================================= */

function buildMigrationSummary({
    sourceWorkflow,
    targetWorkflow,
    stageCount,
    triggerType,
    status,
    errorMessage
}) {
    return {
        sourceWorkflowName: workflowDisplayName(sourceWorkflow),
        targetWorkflowName: workflowDisplayName(targetWorkflow),
        actionsMigrated: stageCount || 0,
        triggerMethod: triggerType || 'Unknown',
        transformationStatus: status,
        errorMessage: errorMessage || null,
        migrationTimestamp: new Date().toISOString()
    };
}

function formatMigrationSummaryAsText(summary) {
    const lines = [
        'WORKFLOW MIGRATION - AUDIT REPORT',
        '=================================',
        `Timestamp: ${summary.migrationTimestamp}`,
        `Status: ${summary.transformationStatus}`,
        `Source Workflow: ${summary.sourceWorkflowName}`,
        `Target Workflow: ${summary.targetWorkflowName}`,
        `Stages / Actions Migrated: ${summary.actionsMigrated}`,
        `Trigger Method: ${summary.triggerMethod}`,
        ''
    ];

    if (summary.errorMessage) {
        lines.push(`Error: ${summary.errorMessage}`, '');
    }

    return lines.join('\n');
}

/* ============================================= */
/* BULK MIGRATION SUMMARY / AUDIT REPORT          */
/* ============================================= */

// The multi-select Source x Target flow can run many pairs in one import
// action. `pairSummaries` is an array of the same per-pair objects produced
// by buildMigrationSummary() above (one per source/target pair) - this
// just wraps them with an overall roll-up so the export still reads as one
// coherent report instead of a bare array.
function buildBulkMigrationSummary(pairSummaries) {
    const list = pairSummaries || [];

    return {
        migrationTimestamp: new Date().toISOString(),
        totalPairs: list.length,
        succeeded: list.filter(p => p.transformationStatus === 'success').length,
        failed: list.filter(p => p.transformationStatus === 'failed').length,
        totalStagesMigrated: list.reduce((sum, p) => sum + (p.actionsMigrated || 0), 0),
        pairs: list
    };
}

function formatBulkMigrationSummaryAsText(bulkSummary) {
    const lines = [
        'WORKFLOW MIGRATION - BULK AUDIT REPORT',
        '=======================================',
        `Timestamp: ${bulkSummary.migrationTimestamp}`,
        `Total Pairs: ${bulkSummary.totalPairs}`,
        `Succeeded: ${bulkSummary.succeeded}`,
        `Failed: ${bulkSummary.failed}`,
        `Total Stages / Actions Migrated: ${bulkSummary.totalStagesMigrated}`,
        ''
    ];

    bulkSummary.pairs.forEach((pair, idx) => {
        lines.push(`--- Pair ${idx + 1} of ${bulkSummary.pairs.length} ---`);
        lines.push(formatMigrationSummaryAsText(pair));
        lines.push('');
    });

    return lines.join('\n');
}
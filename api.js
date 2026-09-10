/* ============================================= */
/* DEFAULT TENANT                                 */
/* ============================================= */

/* ============================================= */
/* DEFAULT TENANT (from host app's Local Storage) */
/* ============================================= */
/* The host app (QAF) already writes everything we */
/* need into Local Storage before this app loads:  */
/*   - "env"        -> API base URL                */
/*   - "user_key"   -> JSON string, .value has      */
/*                     EmployeeGUID, Email, HrzempId */
/* We read those directly instead of hardcoding or  */
/* relying on injected window globals. Read fresh   */
/* on every call (not cached at load) since login/  */
/* session state can change during the page's life. */

const FALLBACK_BASE_URL = 'https://aibdgindv1fapp.azurewebsites.net';

function readLocalStorageJSON(key) {
    let raw;

    try {
        raw = window.localStorage.getItem(key);
    } catch (storageError) {
        return null;
    }

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (parseError) {
        return null;
    }
}

// Builds the default tenant straight from what the host app has already
// stored in Local Storage.
function getDefaultTenant() {
    let env = '';

    try {
        env = window.localStorage.getItem('env') || '';
    } catch (storageError) {
        env = '';
    }

    const userKey = readLocalStorageJSON('user_key');
    const userValue = (userKey && userKey.value) || {};

    return {
        baseUrl: (env || FALLBACK_BASE_URL).trim(),
        employeeGUID: userValue.EmployeeGUID || window.EmployeeGUID || '',
        hrzEmail: userValue.Email || window.HRZEmail || '',
        hrzEmpID: (userValue.EmployeeID ?? window.HRZEmpID ?? '').toString()
    };
}

/* ============================================= */
/* TENANT-AWARE URL / HEADERS                     */
/* ============================================= */

// Every fetch helper below takes an optional `tenant` object
// ({ baseUrl, employeeGUID, hrzEmail, hrzEmpID }). When omitted, the default
// tenant is read fresh from Local Storage (see getDefaultTenant above), so
// all existing same-tenant call sites keep working unchanged.

function resolveTenant(tenant) {
    return tenant || getDefaultTenant();
}

function getHeaders(tenant) {
    const t = resolveTenant(tenant);
    return {
        'Content-Type': 'application/json',
        'EmployeeGUID': t.employeeGUID || '',
        'HRZEmail': t.hrzEmail || '',
        'HRZEmpID': t.hrzEmpID || ''
    };
}

function apiUrl(tenant, path) {
    const t = resolveTenant(tenant);
    const base = (t.baseUrl || FALLBACK_BASE_URL).replace(/\/+$/, '');
    return `${base}${path}`;
}

/* ============================================= */
/* API ENDPOINT PATHS                             */
/* ============================================= */

const GET_ALL_WORKFLOWS_PATH = '/api/WorkflowConfigList';

// Confirmed via network capture (GET /api/WFConfigByID?wfid=<guid>, 200 OK,
// same tenant auth headers as every other call here). This is the "get one
// workflow" endpoint that was previously assumed not to exist - prefer this
// over pulling the full WorkflowConfigList and filtering, whenever a WFID is
// already known, since it returns just the one record.
const GET_WORKFLOW_BY_ID_PATH = '/api/WFConfigByID';

// NOT DOCUMENTED IN THE API REFERENCE.
// There is no documented "update/create workflow" endpoint, unlike
// ObjectGet/ObjectUpdate for repositories. This path is a best-guess, named
// by analogy with ObjectUpdate. Confirm the real endpoint (path, method, and
// payload shape) with the backend team before using this in anything but a
// dry run / "download JSON" flow.
const WORKFLOW_UPDATE_PATH = '/api/WorkflowConfigUpdate';

/* ============================================= */
/* THIN FETCH HELPERS                             */
/* ============================================= */

async function apiGet(url, tenant) {
    let response;

    try {
        response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(tenant)
        });
    } catch (networkError) {
        // Preserve the browser's own message (e.g. a CORS rejection or DNS
        // failure) instead of replacing it with a generic string - this is
        // often the only place that distinguishes "server is unreachable"
        // from "server rejected the cross-origin request" when debugging a
        // tenant that isn't working yet.
        console.error(`Network error calling ${url}:`, networkError);
        throw new Error(`Network error while contacting the server (${networkError.message}). If this tenant is otherwise reachable, check the browser console for a CORS error.`);
    }

    if (!response.ok) {
        let bodyText = '';
        try {
            bodyText = await response.text();
        } catch (readError) {
            // Body isn't always present/readable - fine to ignore.
        }
        console.error(`Request to ${url} failed (HTTP ${response.status}):`, bodyText);
        throw new Error(`Request failed (HTTP ${response.status}).`);
    }

    return response.json();
}

async function apiPost(url, body, tenant) {
    let response;

    try {
        response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(tenant),
            body: JSON.stringify(body)
        });
    } catch (networkError) {
        console.error(`Network error calling ${url}:`, networkError);
        throw new Error(`Network error while contacting the server (${networkError.message}). If this tenant is otherwise reachable, check the browser console for a CORS error.`);
    }

    if (!response.ok) {
        let bodyText = '';
        try {
            bodyText = await response.text();
        } catch (readError) {
            // Body isn't always present/readable - fine to ignore.
        }
        console.error(`Request to ${url} failed (HTTP ${response.status}):`, bodyText);
        throw new Error(`Request failed (HTTP ${response.status}).`);
    }

    return response.json();
}

// Some tenants/environments on this platform return WorkflowConfigList as a
// bare array (the documented shape), but others wrap it in a container key -
// the exact same inconsistency unwrapSingleWorkflowResponse() below already
// exists to handle for the single-record endpoint. Without an equivalent
// here, a wrapped list response looks indistinguishable from "no data"
// (Array.isArray fails) even though the workflows are sitting right there
// under e.g. .Result or .Data - which is exactly the shape of failure that
// would only show up on some tenants and not others.
function unwrapWorkflowListResponse(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (response && typeof response === 'object') {
        for (const key of ['Result', 'result', 'Data', 'data', 'Workflows', 'workflows', 'Items', 'items', 'Records', 'records', 'value', 'Value']) {
            if (Array.isArray(response[key])) {
                return response[key];
            }
        }

        // Older OData-style envelope: { d: [...] } or { d: { results: [...] } }.
        if (response.d) {
            if (Array.isArray(response.d)) return response.d;
            if (response.d.results && Array.isArray(response.d.results)) return response.d.results;
        }
    }

    return null;
}

async function fetchAllWorkflows(tenant) {
    const raw = await apiGet(apiUrl(tenant, GET_ALL_WORKFLOWS_PATH), tenant);
    const workflows = unwrapWorkflowListResponse(raw);

    if (!Array.isArray(workflows)) {
        console.error('Unexpected WorkflowConfigList response shape - raw payload:', raw);
        throw new Error('Invalid workflow response (unexpected shape - see browser console for the raw payload).');
    }

    return workflows;
}

// Some single-record endpoints on this platform return the record wrapped
// in a container key rather than bare - handle the common shapes
// defensively instead of assuming the response is exactly the workflow
// object.
function unwrapSingleWorkflowResponse(response) {
    if (Array.isArray(response)) {
        return response.length > 0 ? response[0] : null;
    }

    if (response && typeof response === 'object') {
        if ('WFID' in response) {
            return response;
        }
        for (const key of ['Result', 'result', 'Data', 'data', 'Workflow', 'workflow']) {
            if (response[key] && typeof response[key] === 'object') {
                return unwrapSingleWorkflowResponse(response[key]);
            }
        }
    }

    return response;
}

// Fetches a single workflow's full config directly by WFID via WFConfigByID,
// instead of fetching the entire WorkflowConfigList and filtering client-side.
async function fetchWorkflowById(wfid, tenant) {
    if (!wfid) {
        throw new Error('A WFID is required to fetch a single workflow.');
    }

    const url = `${apiUrl(tenant, GET_WORKFLOW_BY_ID_PATH)}?wfid=${encodeURIComponent(wfid)}`;
    const raw = await apiGet(url, tenant);
    const workflow = unwrapSingleWorkflowResponse(raw);

    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
        throw new Error('Invalid workflow response from WFConfigByID.');
    }

    return workflow;
}

async function updateWorkflow(payload, tenant) {
    return apiPost(apiUrl(tenant, WORKFLOW_UPDATE_PATH), payload, tenant);
}
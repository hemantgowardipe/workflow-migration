/* ============================================= */
/* TOASTS                                         */
/* ============================================= */

function showToast(message, type) {
    const toastContainer = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4200);
}

/* ============================================= */
/* MISC HELPERS                                   */
/* ============================================= */

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

function renderSkeleton(rowCount) {
    return Array.from({ length: rowCount || 5 })
        .map(() => '<div class="skeleton-row"></div>')
        .join('');
}

function downloadTextFile(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// A workflow's display name: prefer AppTitle (what shows in the app
// launcher), fall back to the internal WFName.
function workflowDisplayName(workflow) {
    return (workflow && (workflow.AppTitle || workflow.WFName)) || 'Unnamed Workflow';
}

/* ============================================= */
/* WORKFLOW LIST RENDERING                        */
/* ============================================= */

function renderWorkflowList(containerEl, workflows, selectCallback, selectedWorkflow) {
    if (workflows.length === 0) {
        containerEl.innerHTML = '<div class="empty-message">No workflows found.</div>';
        return;
    }

    containerEl.innerHTML = '';

    workflows.forEach(workflow => {
        const row = document.createElement('div');
        row.className = 'repo-row';
        row.setAttribute('role', 'option');
        row.tabIndex = 0;

        if (selectedWorkflow && selectedWorkflow.WFID === workflow.WFID) {
            row.classList.add('selected');
            row.setAttribute('aria-selected', 'true');
        }

        row.innerHTML = `
            <div class="repo-name">${escapeHtml(workflowDisplayName(workflow))}</div>
            <div class="repo-id">${escapeHtml(workflow.WFID || '-')}</div>
        `;

        row.addEventListener('click', () => selectCallback(workflow));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectCallback(workflow);
            }
        });

        containerEl.appendChild(row);
    });
}

// Renders exactly one matched workflow as a result "card" (used by the
// search-based Source/Target panels instead of showing the full list).
function renderSingleWorkflowResult(containerEl, workflow, selectCallback, isSelected) {
    containerEl.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'repo-row' + (isSelected ? ' selected' : '');
    row.setAttribute('role', 'option');
    row.tabIndex = 0;
    if (isSelected) row.setAttribute('aria-selected', 'true');

    row.innerHTML = `
        <div class="repo-name">${escapeHtml(workflowDisplayName(workflow))}</div>
        <div class="repo-id">${escapeHtml(workflow.WFID || '-')}</div>
    `;

    if (selectCallback) {
        row.addEventListener('click', () => selectCallback(workflow));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectCallback(workflow);
            }
        });
    }

    containerEl.appendChild(row);
}

function renderNoSearchResult(containerEl, message) {
    containerEl.innerHTML = `<div class="empty-message">${escapeHtml(message || 'No workflow found.')}</div>`;
}

// Small badge shown in the Source panel when the active source came from an
// uploaded JSON file rather than the fetched environment.
function renderUploadedSourceBadge(containerEl, workflow) {
    containerEl.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'repo-row selected uploaded-source-row';
    row.innerHTML = `
        <div class="repo-name">&#128190; ${escapeHtml(workflowDisplayName(workflow))} <span class="uploaded-tag">Uploaded JSON</span></div>
        <div class="repo-id">${escapeHtml(workflow.WFID || 'no WFID in uploaded file')}</div>
    `;
    containerEl.appendChild(row);
}

/* ============================================= */
/* VALIDATION RESULTS                             */
/* ============================================= */

function renderValidationResults(summaryEl, listEl, validation) {
    const { errors, warnings } = validation;

    listEl.innerHTML = '';

    if (errors.length === 0) {
        summaryEl.className = 'validation-summary validation-ok';
        summaryEl.textContent = warnings.length > 0
            ? `No blocking errors. ${warnings.length} warning(s) to review.`
            : 'No issues found.';
    } else {
        summaryEl.className = 'validation-summary validation-blocked';
        summaryEl.textContent = `${errors.length} error(s) must be resolved before importing.`;
    }

    errors.forEach(err => {
        const li = document.createElement('li');
        li.className = 'validation-item validation-error';
        li.innerHTML = `<span class="validation-tag">Error${err.component ? ' \u00b7 ' + escapeHtml(err.component) : ''}</span><span>${escapeHtml(err.message)}</span>`;
        listEl.appendChild(li);
    });

    warnings.forEach(warn => {
        const li = document.createElement('li');
        li.className = 'validation-item validation-warning';
        li.innerHTML = `<span class="validation-tag">Warning${warn.component ? ' \u00b7 ' + escapeHtml(warn.component) : ''}</span><span>${escapeHtml(warn.message)}</span>`;
        listEl.appendChild(li);
    });
}

function filterWorkflows(workflows, searchTerm) {
    const term = (searchTerm || '').trim().toLowerCase();

    if (!term) {
        return workflows;
    }

    return workflows.filter(workflow => {
        const name = workflowDisplayName(workflow).toLowerCase();
        const internalName = (workflow.WFName || '').toLowerCase();
        return name.includes(term) || internalName.includes(term);
    });
}

/* ============================================= */
/* STEP TRACK                                     */
/* ============================================= */

function setActiveStep(activeStep, completeSteps) {
    const stepNodes = document.querySelectorAll('#stepTrack .step-node');
    const complete = completeSteps || [];

    stepNodes.forEach(node => {
        const step = Number(node.dataset.step);
        node.classList.remove('active', 'complete');

        if (complete.includes(step) && step !== activeStep) {
            node.classList.add('complete');
        } else if (step === activeStep) {
            node.classList.add('active');
        }
    });
}

/* ============================================= */
/* PROGRESS LIST                                  */
/* ============================================= */

function addProgressStep(progressListEl, label) {
    const li = document.createElement('li');
    li.className = 'progress-item';
    li.innerHTML = `<span class="progress-marker"></span><span class="progress-text">${escapeHtml(label)}</span>`;
    progressListEl.appendChild(li);
    return li;
}

function setStepState(el, state) {
    el.classList.remove('active', 'done', 'error');
    el.classList.add(state);

    const marker = el.querySelector('.progress-marker');
    if (state === 'done') {
        marker.textContent = '\u2713';
    } else if (state === 'error') {
        marker.textContent = '!';
    } else {
        marker.textContent = '';
    }
}

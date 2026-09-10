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
/* AUTOCOMPLETE DROPDOWN (Source/Target search)   */
/* ============================================= */

// Renders the type-ahead suggestion list for the Source/Target search
// inputs. `matches` is a plain array of workflow objects (not yet
// selected); `activeIndex` (-1 = none) highlights the keyboard-navigated
// row. Click handling is wired by the caller (script.js), which reads
// `data-index` back off the clicked row against its own copy of `matches`.
function renderAutocompleteDropdown(listEl, matches, activeIndex) {
    if (!matches || matches.length === 0) {
        listEl.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    listEl.innerHTML = '';

    matches.forEach((workflow, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item' + (idx === activeIndex ? ' active' : '');
        item.setAttribute('role', 'option');
        item.dataset.index = String(idx);

        item.innerHTML = `
            <div class="autocomplete-item-name">${escapeHtml(workflowDisplayName(workflow))}</div>
            <div class="autocomplete-item-id">${escapeHtml(workflow.WFName || workflow.WFID || '-')}</div>
        `;

        listEl.appendChild(item);
    });

    listEl.classList.remove('hidden');
}

function hideAutocompleteDropdown(listEl) {
    listEl.classList.add('hidden');
    listEl.innerHTML = '';
}

/* ============================================= */
/* SELECTED WORKFLOW CHIP LIST (multi-select)     */
/* ============================================= */

// Renders the list of currently-selected Source or Target workflows as
// removable "chips". Each entry is { id, workflow, uploaded?, loading? }:
//   - id: WFID for fetched workflows, or a synthetic "uploaded-..." id
//   - uploaded: true for a source that came from an uploaded/edited JSON
//     file rather than the fetched directory
//   - loading: true while the full record is still being fetched by WFID
//     after being picked from the autocomplete list
//
// `options.focusedId`, when it matches an entry's id, highlights that chip
// as selected - the focused entry is what the center panel's preview/JSON
// actions act on.
function renderChipList(containerEl, entries, options) {
    const opts = options || {};

    if (!entries || entries.length === 0) {
        containerEl.innerHTML = `<div class="empty-message">${escapeHtml(opts.emptyMessage || 'No workflows selected.')}</div>`;
        return;
    }

    containerEl.innerHTML = '';

    entries.forEach(entry => {
        const workflow = entry.workflow || {};
        const isFocused = opts.focusedId !== undefined && opts.focusedId === entry.id;

        const row = document.createElement('div');
        row.className = 'repo-row chip-row' + (isFocused ? ' selected' : '') + (entry.loading ? ' chip-row-loading' : '');
        row.setAttribute('role', 'option');
        row.tabIndex = 0;
        if (isFocused) row.setAttribute('aria-selected', 'true');

        const nameLabel = entry.loading ? 'Loading workflow…' : workflowDisplayName(workflow);
        const idLabel = entry.loading
            ? ''
            : (workflow.WFID || (entry.uploaded ? 'No WFID (uploaded JSON)' : '-'));

        row.innerHTML = `
            <div class="chip-row-main">
                <div class="repo-name">${escapeHtml(nameLabel)}${entry.uploaded ? ' <span class="uploaded-tag">Uploaded</span>' : ''}</div>
                <div class="repo-id">${escapeHtml(idLabel)}</div>
            </div>
            <button type="button" class="chip-remove-btn" aria-label="Remove ${escapeHtml(nameLabel)}" ${entry.loading ? 'disabled' : ''}>&times;</button>
        `;

        if (opts.onFocus && !entry.loading) {
            const focusRow = () => opts.onFocus(entry.id);
            row.addEventListener('click', (e) => {
                if (e.target.closest('.chip-remove-btn')) return;
                focusRow();
            });
            row.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.chip-remove-btn')) {
                    e.preventDefault();
                    focusRow();
                }
            });
        }

        const removeBtn = row.querySelector('.chip-remove-btn');
        if (opts.onRemove) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                opts.onRemove(entry.id);
            });
        }

        containerEl.appendChild(row);
    });
}

function renderNoSearchResult(containerEl, message) {
    containerEl.innerHTML = `<div class="empty-message">${escapeHtml(message || 'No workflow found.')}</div>`;
}

/* ============================================= */
/* PER-PAIR VALIDATION RESULTS (Source x Target)  */
/* ============================================= */

// `pairResults` is an array of { sourceName, targetName, errors, warnings }
// (one entry per Source x Target combination). Renders an overall summary
// line plus one item per pair, so a person reviewing a large cross-product
// can see at a glance which pairs are blocked.
function renderPairValidationResults(summaryEl, listEl, pairResults) {
    listEl.innerHTML = '';

    const total = pairResults.length;
    const blocked = pairResults.filter(p => p.errors.length > 0).length;
    const withWarnings = pairResults.filter(p => p.errors.length === 0 && p.warnings.length > 0).length;

    if (total === 0) {
        summaryEl.className = 'validation-summary';
        summaryEl.textContent = 'Nothing to validate yet.';
    } else if (blocked === 0) {
        summaryEl.className = 'validation-summary validation-ok';
        summaryEl.textContent = withWarnings > 0
            ? `All ${total} pair(s) are importable. ${withWarnings} have warning(s) to review.`
            : `All ${total} pair(s) passed validation with no issues.`;
    } else {
        summaryEl.className = 'validation-summary validation-blocked';
        summaryEl.textContent = `${blocked} of ${total} pair(s) blocked by errors and will be skipped. ${total - blocked} pair(s) are ready to import.`;
    }

    pairResults.forEach(pair => {
        const li = document.createElement('li');
        const state = pair.errors.length > 0 ? 'validation-error' : (pair.warnings.length > 0 ? 'validation-warning' : 'validation-pass');
        li.className = `validation-item pair-validation-item ${state}`;

        const badgeText = pair.errors.length > 0
            ? `${pair.errors.length} error(s)`
            : (pair.warnings.length > 0 ? `${pair.warnings.length} warning(s)` : 'Ready');

        const detailItems = [
            ...pair.errors.map(e => ({ tag: 'Error', component: e.component, message: e.message })),
            ...pair.warnings.map(w => ({ tag: 'Warning', component: w.component, message: w.message }))
        ];

        li.innerHTML = `
            <div class="pair-validation-head">
                <span class="pair-validation-route">${escapeHtml(pair.sourceName)}<span class="pair-arrow" aria-hidden="true">&rarr;</span>${escapeHtml(pair.targetName)}</span>
                <span class="validation-tag">${escapeHtml(badgeText)}</span>
            </div>
            ${detailItems.length > 0 ? `<ul class="pair-validation-details">${detailItems.map(item => `<li>${escapeHtml(item.tag)}${item.component ? ' &middot; ' + escapeHtml(item.component) : ''}: ${escapeHtml(item.message)}</li>`).join('')}</ul>` : ''}
        `;

        listEl.appendChild(li);
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

// States: 'active' (in progress), 'done' (succeeded), 'error' (failed), or
// 'skipped' (never attempted - e.g. a pair blocked by validation errors).
function setStepState(el, state) {
    el.classList.remove('active', 'done', 'error', 'skipped');
    el.classList.add(state);

    const marker = el.querySelector('.progress-marker');
    if (state === 'done') {
        marker.textContent = '\u2713';
    } else if (state === 'error') {
        marker.textContent = '!';
    } else if (state === 'skipped') {
        marker.textContent = '\u2014';
    } else {
        marker.textContent = '';
    }
}
/**
 * meetings.js — embed a sortable, filterable meetings table into any page.
 *
 * Usage:
 *   <div id="meetings-table"
 *        data-url="https://example.com/meetings.json"
 *        data-past="show">        <!-- optional: "show" to include past meetings -->
 *   </div>
 *   <script src="meetings.js"></script>
 *
 * The script finds every <div> with id="meetings-table" (or a custom selector
 * passed to MeetingsTable.init()) and replaces it with the rendered widget.
 */

(function () {
  'use strict';

  const COLUMNS = [
    { key: 'date',      label: 'Date' },
    { key: 'time',      label: 'Time' },
    { key: 'doors',     label: 'Doors Open' },
    { key: 'location',  label: 'Location' },
    { key: 'topic',     label: 'Topic' },
    { key: 'presenter', label: 'Presenter' },
  ];

  const STYLES = `
.mtg-widget { font-family: sans-serif; max-width: 100%; overflow-x: auto; }
.mtg-filter-wrap { margin-bottom: .5em; }
.mtg-filter { width: 100%; padding: .4em .6em; font-size: 1em; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
.mtg-table { border-collapse: collapse; width: 100%; font-size: .9em; }
.mtg-table th, .mtg-table td { border: 1px solid #ddd; padding: .45em .6em; text-align: left; vertical-align: top; }
.mtg-table th { background: #f0f0f0; cursor: pointer; user-select: none; white-space: nowrap; }
.mtg-table th:hover { background: #e0e0e0; }
.mtg-table th .sort-arrow { margin-left: .3em; opacity: .4; }
.mtg-table th.sorted .sort-arrow { opacity: 1; }
.mtg-table tbody tr:nth-child(even) { background: #fafafa; }
.mtg-table tbody tr:hover { background: #f5f5f5; }
.mtg-upcoming { background: #fffbe6 !important; font-weight: bold; }
.mtg-expand-btn { cursor: pointer; background: none; border: none; font-size: .85em; color: #555; padding: 0 .4em; }
.mtg-expand-cell { white-space: nowrap; }
.mtg-no-results { padding: .6em; color: #888; font-style: italic; }
`;

  function injectStyles() {
    if (document.getElementById('mtg-styles')) return;
    const el = document.createElement('style');
    el.id = 'mtg-styles';
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function formatDate(iso) {
    // Display as Month D, YYYY — parse as local date to avoid UTC offset shift
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function textContent(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function buildWidget(container, data, showPast) {
    const todayStr = today();

    const upcoming = data.filter(r => r.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
    const past     = data.filter(r => r.date <  todayStr).sort((a, b) => b.date.localeCompare(a.date));

    let sortKey = 'date';
    let sortDir = 1; // 1 = asc, -1 = desc
    let filterText = '';
    let upcomingExpanded = false;

    // ── DOM structure ──────────────────────────────────────────────────────────
    const widget = document.createElement('div');
    widget.className = 'mtg-widget';

    const filterWrap = document.createElement('div');
    filterWrap.className = 'mtg-filter-wrap';
    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.className = 'mtg-filter';
    filterInput.placeholder = 'Filter meetings…';
    filterWrap.appendChild(filterInput);
    widget.appendChild(filterWrap);

    const table = document.createElement('table');
    table.className = 'mtg-table';

    // ── Header ─────────────────────────────────────────────────────────────────
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Extra column for the expand toggle
    const thToggle = document.createElement('th');
    headerRow.appendChild(thToggle);

    COLUMNS.forEach(col => {
      const th = document.createElement('th');
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      th.appendChild(document.createTextNode(col.label));
      th.appendChild(arrow);
      th.dataset.key = col.key;
      th.addEventListener('click', () => {
        if (sortKey === col.key) {
          sortDir *= -1;
        } else {
          sortKey = col.key;
          sortDir = col.key === 'date' ? 1 : 1;
        }
        render();
      });
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    widget.appendChild(table);

    const noResults = document.createElement('div');
    noResults.className = 'mtg-no-results';
    noResults.textContent = 'No meetings match your filter.';
    noResults.style.display = 'none';
    widget.appendChild(noResults);

    // ── Render ─────────────────────────────────────────────────────────────────
    function sortRows(rows) {
      return [...rows].sort((a, b) => {
        const av = textContent(a[sortKey] || '').toLowerCase();
        const bv = textContent(b[sortKey] || '').toLowerCase();
        return av < bv ? -sortDir : av > bv ? sortDir : 0;
      });
    }

    function matchesFilter(row) {
      if (!filterText) return true;
      const needle = filterText.toLowerCase();
      return COLUMNS.some(col => textContent(row[col.key] || '').toLowerCase().includes(needle));
    }

    function makeRow(record, isNext) {
      const tr = document.createElement('tr');
      if (isNext) tr.className = 'mtg-upcoming';

      // Toggle cell (only meaningful on the "next" row)
      const tdToggle = document.createElement('td');
      tdToggle.className = 'mtg-expand-cell';
      if (isNext && upcoming.length > 1) {
        const btn = document.createElement('button');
        btn.className = 'mtg-expand-btn';
        btn.title = upcomingExpanded ? 'Collapse upcoming meetings' : 'Show all upcoming meetings';
        btn.textContent = upcomingExpanded ? '▲' : '▼';
        btn.addEventListener('click', () => {
          upcomingExpanded = !upcomingExpanded;
          render();
        });
        tdToggle.appendChild(btn);
      }
      tr.appendChild(tdToggle);

      COLUMNS.forEach(col => {
        const td = document.createElement('td');
        const raw = record[col.key] || '';
        if (col.key === 'date') {
          td.textContent = formatDate(raw);
        } else {
          td.innerHTML = raw; // allow HTML in location/presenter fields
        }
        tr.appendChild(td);
      });
      return tr;
    }

    function render() {
      // Update header arrows
      thead.querySelectorAll('th[data-key]').forEach(th => {
        th.classList.remove('sorted');
        th.querySelector('.sort-arrow').textContent = '';
      });
      const activeTh = thead.querySelector(`th[data-key="${sortKey}"]`);
      if (activeTh) {
        activeTh.classList.add('sorted');
        activeTh.querySelector('.sort-arrow').textContent = sortDir === 1 ? '▲' : '▼';
      }

      tbody.innerHTML = '';

      // Decide which upcoming rows to display
      let upcomingToShow = [];
      if (upcoming.length > 0) {
        if (filterText || upcomingExpanded) {
          upcomingToShow = sortRows(upcoming).filter(matchesFilter);
        } else {
          // Only the very next meeting
          upcomingToShow = [upcoming[0]].filter(matchesFilter);
        }
      }

      // Past rows
      let pastToShow = showPast ? sortRows(past).filter(matchesFilter) : [];

      // Combined for "no results" check
      const totalVisible = upcomingToShow.length + pastToShow.length;
      noResults.style.display = totalVisible === 0 ? '' : 'none';
      table.style.display    = totalVisible === 0 ? 'none' : '';

      // Render upcoming
      upcomingToShow.forEach((record, i) => {
        const isNext = !filterText && !upcomingExpanded && i === 0 && upcoming[0] === record;
        const markedNext = upcoming[0] === record && !filterText;
        tbody.appendChild(makeRow(record, markedNext));
      });

      // Render past
      pastToShow.forEach(record => tbody.appendChild(makeRow(record, false)));
    }

    filterInput.addEventListener('input', () => {
      filterText = filterInput.value.trim();
      if (filterText) upcomingExpanded = false; // let filter take over
      render();
    });

    render();
    container.replaceWith(widget);
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  function init(selector) {
    selector = selector || '#meetings-table';
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
      const url = container.dataset.url;
      if (!url) {
        container.textContent = '[meetings.js] Missing data-url attribute.';
        return;
      }
      const showPast = (container.dataset.past || '').toLowerCase() === 'show';

      injectStyles();

      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => buildWidget(container, data, showPast))
        .catch(err => { container.textContent = `[meetings.js] Failed to load data: ${err.message}`; });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // Expose for manual init or custom selectors
  window.MeetingsTable = { init };
})();

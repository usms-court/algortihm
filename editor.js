(function () {
    'use strict';

    const state = {
        nodes: [],
        edges: [],
        zoom: 1,
        minZoom: 0.15,
        maxZoom: 2.5,
        offsetX: 0,
        offsetY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        activeNodeId: null,
        dragNode: null,
        dragOffset: { x: 0, y: 0 },
        isDraggingNode: false
    };

    const SIZES = {
        process:  { w: 220, h: 72 },
        decision: { w: 280, h: 130 },
        terminal: { w: 200, h: 60 },
        data:     { w: 220, h: 72 }
    };

    const STORAGE_KEY = 'usms_algo_editor_draft_v1';

    let stage, canvas, panel, svgEl, viewportG;

    // ============================================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================================
    function loadData() {
        let data = null;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length) {
                    data = parsed;
                }
            }
        } catch (e) { /* ignore */ }

        if (!data) {
            const src = window.USMS_ALGO_DATA || window.USMS_ALGO || {};
            const srcNodes = src.ALGO_NODES || src.nodes || [];
            const srcEdges = src.ALGO_EDGES || src.edges || [];
            data = {
                nodes: JSON.parse(JSON.stringify(srcNodes)),
                edges: JSON.parse(JSON.stringify(srcEdges))
            };
        }

        state.nodes = data.nodes.map(n => ({
            id: n.id,
            type: n.type || 'process',
            x: n.x,
            y: n.y,
            label: n.label || '',
            tooltip: Object.assign({ title: '', description: '', macro: '', template: '', tab: '' }, n.tooltip || {})
        }));

        state.edges = data.edges.map(e => ({
            from: e.from,
            to: e.to,
            label: e.label || ''
        }));
    }

    function saveDraft() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                nodes: state.nodes,
                edges: state.edges
            }));
        } catch (e) { /* ignore */ }
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    function init() {
        stage = document.getElementById('algoStage');
        canvas = document.getElementById('algoCanvas');
        panel = document.getElementById('editorPanel');
        if (!stage || !canvas || !panel) return;

        loadData();
        buildSvg();
        bindZoom();
        bindPan();
        bindControls();
        bindHeader();

        setTimeout(() => centerView(), 30);
    }

    // ============================================================
    // SVG
    // ============================================================
    function buildSvg() {
        const NS = 'http://www.w3.org/2000/svg';

        const maxX = Math.max(1200, ...state.nodes.map(n => n.x)) + 400;
        const maxY = Math.max(1000, ...state.nodes.map(n => n.y)) + 300;

        canvas.style.width = maxX + 'px';
        canvas.style.height = maxY + 'px';
        canvas.innerHTML = '';

        svgEl = document.createElementNS(NS, 'svg');
        svgEl.setAttribute('width', maxX);
        svgEl.setAttribute('height', maxY);
        svgEl.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
        svgEl.classList.add('editor-svg');

        const defs = document.createElementNS(NS, 'defs');
        const marker = document.createElementNS(NS, 'marker');
        marker.setAttribute('id', 'editorArrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const arrowPath = document.createElementNS(NS, 'path');
        arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowPath.setAttribute('fill', 'rgba(139, 176, 204, 0.55)');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        svgEl.appendChild(defs);

        viewportG = document.createElementNS(NS, 'g');
        viewportG.setAttribute('id', 'editorViewport');
        svgEl.appendChild(viewportG);

        state.edges.forEach(edge => viewportG.appendChild(buildEdge(edge)));
        state.nodes.forEach(node => viewportG.appendChild(buildNode(node)));

        canvas.appendChild(svgEl);
    }

    function getSize(type) {
        return SIZES[type] || SIZES.process;
    }

    function buildNode(node) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', `editor-node editor-node--${node.type}`);
        g.setAttribute('data-node-id', node.id);
        g.style.cursor = 'pointer';

        const { w, h } = getSize(node.type);
        const isDecision = node.type === 'decision';
        const isTerminal = node.type === 'terminal';

        let shape;
        if (isDecision) {
            const points = [
                `${node.x},${node.y - h / 2}`,
                `${node.x + w / 2},${node.y}`,
                `${node.x},${node.y + h / 2}`,
                `${node.x - w / 2},${node.y}`
            ].join(' ');
            shape = document.createElementNS(NS, 'polygon');
            shape.setAttribute('points', points);
        } else {
            shape = document.createElementNS(NS, 'rect');
            shape.setAttribute('x', node.x - w / 2);
            shape.setAttribute('y', node.y - h / 2);
            shape.setAttribute('width', w);
            shape.setAttribute('height', h);
            if (isTerminal) {
                shape.setAttribute('rx', h / 2);
                shape.setAttribute('ry', h / 2);
            } else {
                shape.setAttribute('rx', 14);
                shape.setAttribute('ry', 14);
            }
        }
        shape.setAttribute('class', 'editor-node__shape');
        g.appendChild(shape);

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'editor-node__text');

        const maxChars = isDecision ? 22 : 26;
        const lines = wrapText(node.label || '', maxChars);
        const lineHeight = 16;
        const startDy = -((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', node.x);
            tspan.setAttribute('dy', idx === 0 ? startDy : lineHeight);
            if (idx === 0) tspan.setAttribute('y', node.y);
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        g.appendChild(text);

        g.addEventListener('mousedown', (e) => startNodeDrag(e, node));
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.isDraggingNode) selectNode(node.id);
        });

        return g;
    }

    function wrapText(text, maxChars) {
        const words = String(text).split(/\s+/);
        const lines = [];
        let current = '';
        words.forEach(word => {
            const test = current ? current + ' ' + word : word;
            if (test.length > maxChars && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [''];
    }

    function buildEdge(edge) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'editor-edge');

        const from = state.nodes.find(n => n.id === edge.from);
        const to = state.nodes.find(n => n.id === edge.to);
        if (!from || !to) return g;

        const fromSize = getSize(from.type);
        const toSize = getSize(to.type);

        const x1 = from.x;
        const y1 = from.y + fromSize.h / 2;
        const x2 = to.x;
        const y2 = to.y - toSize.h / 2;

        let d;
        if (Math.abs(x2 - x1) < 5) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else {
            const midY = y1 + (y2 - y1) / 2;
            d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        }

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'editor-edge__line');
        path.setAttribute('marker-end', 'url(#editorArrow)');
        g.appendChild(path);

        if (edge.label) {
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const labelW = Math.max(40, edge.label.length * 7 + 12);

            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', mx - labelW / 2);
            rect.setAttribute('y', my - 10);
            rect.setAttribute('width', labelW);
            rect.setAttribute('height', 20);
            rect.setAttribute('rx', 6);
            rect.setAttribute('class', 'editor-edge__label-bg');
            g.appendChild(rect);

            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('x', mx);
            lbl.setAttribute('y', my + 4);
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('class', 'editor-edge__label');
            lbl.textContent = edge.label;
            g.appendChild(lbl);
        }

        return g;
    }

    // ============================================================
    // DRAG УЗЛА
    // ============================================================
    function startNodeDrag(e, node) {
        if (e.button !== 0) return;
        state.dragNode = node;
        state.dragOffset = { x: e.clientX, y: e.clientY };
        state.isDraggingNode = false;

        window.addEventListener('mousemove', onNodeDragMove);
        window.addEventListener('mouseup', onNodeDragEnd);
    }

    function onNodeDragMove(e) {
        if (!state.dragNode) return;

        const dx = e.clientX - state.dragOffset.x;
        const dy = e.clientY - state.dragOffset.y;

        if (!state.isDraggingNode) {
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            state.isDraggingNode = true;
            stage.style.cursor = 'grabbing';
        }

        const realDx = dx / state.zoom;
        const realDy = dy / state.zoom;

        state.dragNode.x += realDx;
        state.dragNode.y += realDy;

        state.dragOffset = { x: e.clientX, y: e.clientY };

        redraw();
    }

    function onNodeDragEnd() {
        if (state.dragNode) {
            saveDraft();
            if (state.isDraggingNode) {
                renderPanel(state.dragNode);
            }
        }
        state.dragNode = null;
        state.isDraggingNode = false;
        stage.style.cursor = '';
        window.removeEventListener('mousemove', onNodeDragMove);
        window.removeEventListener('mouseup', onNodeDragEnd);
    }

    function redraw() {
        // Пересобираем только позиции — для производительности
        state.nodes.forEach(node => {
            const g = viewportG.querySelector(`[data-node-id="${node.id}"]`);
            if (!g) return;
            const { w, h } = getSize(node.type);
            const isDecision = node.type === 'decision';

            const shape = g.querySelector('.editor-node__shape');
            if (isDecision) {
                const points = [
                    `${node.x},${node.y - h / 2}`,
                    `${node.x + w / 2},${node.y}`,
                    `${node.x},${node.y + h / 2}`,
                    `${node.x - w / 2},${node.y}`
                ].join(' ');
                shape.setAttribute('points', points);
            } else {
                shape.setAttribute('x', node.x - w / 2);
                shape.setAttribute('y', node.y - h / 2);
            }

            const text = g.querySelector('.editor-node__text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.querySelectorAll('tspan').forEach((tspan, idx, arr) => {
                tspan.setAttribute('x', node.x);
                if (idx === 0) tspan.setAttribute('y', node.y);
            });
        });

        // Перерисовываем стрелки (они зависят от позиций)
        viewportG.querySelectorAll('.editor-edge').forEach(g => g.remove());
        state.edges.forEach(edge => {
            const g = buildEdge(edge);
            viewportG.insertBefore(g, viewportG.firstChild);
        });
    }

    // ============================================================
    // ПАНОРАМА
    // ============================================================
    function bindPan() {
        let raf = null;
        let pendingX = 0, pendingY = 0;

        stage.addEventListener('mousedown', (e) => {
            if (e.target.closest('.editor-node')) return;
            state.isPanning = true;
            state.panStart = { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY };
            stage.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!state.isPanning) return;
            pendingX = e.clientX - state.panStart.x;
            pendingY = e.clientY - state.panStart.y;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                state.offsetX = pendingX;
                state.offsetY = pendingY;
                applyTransform();
            });
        });

        window.addEventListener('mouseup', () => {
            if (state.isPanning) {
                state.isPanning = false;
                stage.style.cursor = '';
            }
        });

        stage.addEventListener('click', (e) => {
            if (e.target.closest('.editor-node')) return;
            deselect();
        });
    }

    // ============================================================
    // ЗУМ
    // ============================================================
    function bindZoom() {
        let raf = null;
        let pendingZoom = 1;
        let pendingX = 0, pendingY = 0;

        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            const factor = delta > 0 ? 1.12 : 0.89;
            pendingZoom = clamp(state.zoom * factor, state.minZoom, state.maxZoom);

            const rect = stage.getBoundingClientRect();
            pendingX = e.clientX - rect.left;
            pendingY = e.clientY - rect.top;

            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                const newZoom = pendingZoom;
                if (newZoom === state.zoom) return;
                state.offsetX = pendingX - (pendingX - state.offsetX) * (newZoom / state.zoom);
                state.offsetY = pendingY - (pendingY - state.offsetY) * (newZoom / state.zoom);
                state.zoom = newZoom;
                applyTransform();
            });
        }, { passive: false });
    }

    function applyTransform() {
        canvas.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
    }

    function bindControls() {
        document.getElementById('btnZoomIn')?.addEventListener('click', () => {
            state.zoom = clamp(state.zoom * 1.2, state.minZoom, state.maxZoom);
            applyTransform();
        });
        document.getElementById('btnZoomOut')?.addEventListener('click', () => {
            state.zoom = clamp(state.zoom * 0.83, state.minZoom, state.maxZoom);
            applyTransform();
        });
        document.getElementById('btnZoomReset')?.addEventListener('click', () => {
            state.zoom = 1;
            state.offsetX = 0;
            state.offsetY = 0;
            applyTransform();
            centerView();
        });
    }

    function centerView() {
        if (!stage || !canvas) return;
        const stageRect = stage.getBoundingClientRect();
        const canvasW = parseFloat(canvas.style.width) || 1200;
        const canvasH = parseFloat(canvas.style.height) || 1800;

        const scaleX = (stageRect.width - 40) / canvasW;
        const scaleY = (stageRect.height - 40) / canvasH;
        state.zoom = clamp(Math.min(scaleX, scaleY), state.minZoom, 1);
        state.offsetX = (stageRect.width - canvasW * state.zoom) / 2;
        state.offsetY = (stageRect.height - canvasH * state.zoom) / 2;
        applyTransform();
    }

    // ============================================================
    // ПАНЕЛЬ РЕДАКТИРОВАНИЯ
    // ============================================================
    function selectNode(id) {
        const node = state.nodes.find(n => n.id === id);
        if (!node) return;
        state.activeNodeId = id;
        document.querySelectorAll('.editor-node').forEach(el => el.classList.remove('editor-node--active'));
        document.querySelector(`[data-node-id="${id}"]`)?.classList.add('editor-node--active');
        renderPanel(node);
    }

    function deselect() {
        state.activeNodeId = null;
        document.querySelectorAll('.editor-node').forEach(el => el.classList.remove('editor-node--active'));
        panel.innerHTML = `
            <div class="editor-panel__empty">
                <div class="editor-panel__empty-icon">📋</div>
                <div class="editor-panel__empty-text">Кликните по блоку, чтобы отредактировать</div>
            </div>
        `;
    }

    function renderPanel(node) {
        const typeLabels = {
            process:  'Действие',
            decision: 'Условие',
            terminal: 'Терминатор',
            data:     'Данные'
        };

        panel.innerHTML = `
            <div class="editor-panel__header">
                <div class="editor-panel__badge editor-panel__badge--${node.type}">${typeLabels[node.type] || ''}</div>
                <h3 class="editor-panel__title">Редактирование блока</h3>
            </div>

            <div class="editor-panel__body">
                <label class="efield">
                    <span class="efield__label">Текст блока</span>
                    <textarea class="efield__input" id="fLabel" rows="3">${escapeHtml(node.label)}</textarea>
                </label>

                <label class="efield">
                    <span class="efield__label">Тип блока</span>
                    <select class="efield__input" id="fType">
                        <option value="process" ${node.type === 'process' ? 'selected' : ''}>Действие (прямоугольник)</option>
                        <option value="decision" ${node.type === 'decision' ? 'selected' : ''}>Условие (ромб)</option>
                        <option value="terminal" ${node.type === 'terminal' ? 'selected' : ''}>Терминатор (пилюля)</option>
                    </select>
                </label>

                <div class="editor-panel__divider">Пояснение в панели</div>

                <label class="efield">
                    <span class="efield__label">Заголовок</span>
                    <input class="efield__input" id="fTitle" type="text" value="${escapeAttr(node.tooltip.title)}" placeholder="Оставьте пустым — покажется текст блока">
                </label>

                <label class="efield">
                    <span class="efield__label">Описание</span>
                    <textarea class="efield__input" id="fDescription" rows="4" placeholder="Что нужно сделать на этом шаге...">${escapeHtml(node.tooltip.description)}</textarea>
                </label>

                <label class="efield">
                    <span class="efield__label">🎮 Макрос</span>
                    <input class="efield__input" id="fMacro" type="text" value="${escapeAttr(node.tooltip.macro)}" placeholder="Название макроса">
                </label>

                <label class="efield">
                    <span class="efield__label">📨 Шаблон</span>
                    <input class="efield__input" id="fTemplate" type="text" value="${escapeAttr(node.tooltip.template)}" placeholder="Тип шаблона">
                </label>

                <label class="efield">
                    <span class="efield__label">📂 Вкладка генератора</span>
                    <select class="efield__input" id="fTab">
                        <option value="" ${!node.tooltip.tab ? 'selected' : ''}>— Не открывать —</option>
                        <option value="decree" ${node.tooltip.tab === 'decree' ? 'selected' : ''}>📜 Постановление</option>
                        <option value="wanted" ${node.tooltip.tab === 'wanted' ? 'selected' : ''}>🔍 Розыск</option>
                        <option value="final" ${node.tooltip.tab === 'final' ? 'selected' : ''}>📋 Итоговое</option>
                        <option value="templates" ${node.tooltip.tab === 'templates' ? 'selected' : ''}>📨 Шаблоны</option>
                    </select>
                </label>
            </div>

            <div class="editor-panel__footer">
                <div class="editor-panel__coords">X: ${Math.round(node.x)} · Y: ${Math.round(node.y)} · ID: <code>${escapeHtml(node.id)}</code></div>
            </div>
        `;

        bindPanelInputs(node);
    }

    function bindPanelInputs(node) {
        const fLabel = document.getElementById('fLabel');
        const fType = document.getElementById('fType');
        const fTitle = document.getElementById('fTitle');
        const fDescription = document.getElementById('fDescription');
        const fMacro = document.getElementById('fMacro');
        const fTemplate = document.getElementById('fTemplate');
        const fTab = document.getElementById('fTab');

        fLabel.addEventListener('input', () => {
            node.label = fLabel.value;
            updateNodeVisual(node);
            saveDraft();
        });

        fType.addEventListener('change', () => {
            node.type = fType.value;
            rebuildNodeVisual(node);
            renderPanel(node);
            saveDraft();
        });

        fTitle.addEventListener('input', () => { node.tooltip.title = fTitle.value; saveDraft(); });
        fDescription.addEventListener('input', () => { node.tooltip.description = fDescription.value; saveDraft(); });
        fMacro.addEventListener('input', () => { node.tooltip.macro = fMacro.value; saveDraft(); });
        fTemplate.addEventListener('input', () => { node.tooltip.template = fTemplate.value; saveDraft(); });
        fTab.addEventListener('change', () => { node.tooltip.tab = fTab.value; saveDraft(); });
    }

    function updateNodeVisual(node) {
        const g = viewportG.querySelector(`[data-node-id="${node.id}"]`);
        if (!g) return;

        const text = g.querySelector('.editor-node__text');
        const isDecision = node.type === 'decision';
        const maxChars = isDecision ? 22 : 26;
        const lines = wrapText(node.label || '', maxChars);
        const lineHeight = 16;
        const startDy = -((lines.length - 1) * lineHeight) / 2;

        text.innerHTML = '';
        lines.forEach((line, idx) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', node.x);
            tspan.setAttribute('dy', idx === 0 ? startDy : lineHeight);
            if (idx === 0) tspan.setAttribute('y', node.y);
            tspan.textContent = line;
            text.appendChild(tspan);
        });
    }

    function rebuildNodeVisual(node) {
        const old = viewportG.querySelector(`[data-node-id="${node.id}"]`);
        if (old) old.remove();
        const newG = buildNode(node);
        viewportG.appendChild(newG);
        if (state.activeNodeId === node.id) newG.classList.add('editor-node--active');
        redraw();
    }

    // ============================================================
    // ЭКСПОРТ
    // ============================================================
    function bindHeader() {
        document.getElementById('btnDownload').addEventListener('click', downloadAlgorithmJs);
        document.getElementById('btnResetAll').addEventListener('click', resetAll);
    }

    function downloadAlgorithmJs() {
        const nodesJs = state.nodes.map(n => {
            return `        { id: ${JSON.stringify(n.id)}, type: ${JSON.stringify(n.type)}, x: ${Math.round(n.x)}, y: ${Math.round(n.y)},\n          label: ${JSON.stringify(n.label)},\n          tooltip: { title: ${JSON.stringify(n.tooltip.title)}, description: ${JSON.stringify(n.tooltip.description)}, macro: ${JSON.stringify(n.tooltip.macro)}, template: ${JSON.stringify(n.tooltip.template)}, tab: ${JSON.stringify(n.tooltip.tab)} } }`;
        }).join(',\n\n');

        const edgesJs = state.edges.map(e => {
            const parts = [`from: ${JSON.stringify(e.from)}`, `to: ${JSON.stringify(e.to)}`];
            if (e.label) parts.push(`label: ${JSON.stringify(e.label)}`);
            return `        { ${parts.join(', ')} }`;
        }).join(',\n');

        const content =
`window.USMS_ALGO = (function () {
    'use strict';

    const NODE_W = 220;
    const NODE_H = 72;
    const DECISION_W = 280;
    const DECISION_H = 130;
    const TERMINAL_W = 200;
    const TERMINAL_H = 60;

    const ALGO_NODES = [

${nodesJs}

    ];

    const ALGO_EDGES = [

${edgesJs}

    ];

    const state = {
        zoom: 1,
        minZoom: 0.15,
        maxZoom: 2.5,
        offsetX: 0,
        offsetY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        activeNodeId: null
    };

    let stage, canvas, panel, svgEl, viewportG;

    function init() {
        stage = document.getElementById('algoStage');
        canvas = document.getElementById('algoCanvas');
        panel = document.getElementById('algoPanel');
        if (!stage || !canvas || !panel) return;
        buildSvg();
        bindZoom();
        bindPan();
        bindControls();
        setTimeout(() => centerView(), 30);
    }

    function buildSvg() {
        const NS = 'http://www.w3.org/2000/svg';
        const maxX = Math.max(...ALGO_NODES.map(n => n.x)) + 400;
        const maxY = Math.max(...ALGO_NODES.map(n => n.y)) + 300;
        canvas.style.width = maxX + 'px';
        canvas.style.height = maxY + 'px';
        svgEl = document.createElementNS(NS, 'svg');
        svgEl.setAttribute('width', maxX);
        svgEl.setAttribute('height', maxY);
        svgEl.setAttribute('viewBox', '0 0 ' + maxX + ' ' + maxY);
        svgEl.classList.add('algo-svg');
        const defs = document.createElementNS(NS, 'defs');
        const marker = document.createElementNS(NS, 'marker');
        marker.setAttribute('id', 'algoArrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const arrowPath = document.createElementNS(NS, 'path');
        arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowPath.setAttribute('fill', 'rgba(139, 176, 204, 0.55)');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        svgEl.appendChild(defs);
        viewportG = document.createElementNS(NS, 'g');
        viewportG.setAttribute('id', 'algoViewport');
        svgEl.appendChild(viewportG);
        ALGO_EDGES.forEach(edge => viewportG.appendChild(buildEdge(edge)));
        ALGO_NODES.forEach(node => viewportG.appendChild(buildNode(node)));
        canvas.appendChild(svgEl);
    }

    function getNodeSize(node) {
        if (node.type === 'decision') return { w: DECISION_W, h: DECISION_H };
        if (node.type === 'terminal') return { w: TERMINAL_W, h: TERMINAL_H };
        return { w: NODE_W, h: NODE_H };
    }

    function buildNode(node) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'algo-node algo-node--' + node.type);
        g.setAttribute('data-node-id', node.id);
        g.style.cursor = 'pointer';
        const { w, h } = getNodeSize(node);
        const isDecision = node.type === 'decision';
        const isTerminal = node.type === 'terminal';
        let shape;
        if (isDecision) {
            const points = [
                node.x + ',' + (node.y - h / 2),
                (node.x + w / 2) + ',' + node.y,
                node.x + ',' + (node.y + h / 2),
                (node.x - w / 2) + ',' + node.y
            ].join(' ');
            shape = document.createElementNS(NS, 'polygon');
            shape.setAttribute('points', points);
        } else {
            shape = document.createElementNS(NS, 'rect');
            shape.setAttribute('x', node.x - w / 2);
            shape.setAttribute('y', node.y - h / 2);
            shape.setAttribute('width', w);
            shape.setAttribute('height', h);
            shape.setAttribute('rx', isTerminal ? h / 2 : 14);
            shape.setAttribute('ry', isTerminal ? h / 2 : 14);
        }
        shape.setAttribute('class', 'algo-node__shape');
        g.appendChild(shape);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'algo-node__text');
        const maxChars = isDecision ? 22 : 26;
        const lines = wrapText(node.label, maxChars);
        const lineHeight = 16;
        const startDy = -((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', node.x);
            tspan.setAttribute('dy', idx === 0 ? startDy : lineHeight);
            if (idx === 0) tspan.setAttribute('y', node.y);
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        g.appendChild(text);
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(node.id);
        });
        return g;
    }

    function wrapText(text, maxChars) {
        const words = String(text).split(/\\s+/);
        const lines = [];
        let current = '';
        words.forEach(word => {
            const test = current ? current + ' ' + word : word;
            if (test.length > maxChars && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [''];
    }

    function buildEdge(edge) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'algo-edge');
        const from = ALGO_NODES.find(n => n.id === edge.from);
        const to = ALGO_NODES.find(n => n.id === edge.to);
        if (!from || !to) return g;
        const fromSize = getNodeSize(from);
        const toSize = getNodeSize(to);
        const x1 = from.x;
        const y1 = from.y + fromSize.h / 2;
        const x2 = to.x;
        const y2 = to.y - toSize.h / 2;
        let d;
        if (Math.abs(x2 - x1) < 5) {
            d = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
        } else {
            const midY = y1 + (y2 - y1) / 2;
            d = 'M ' + x1 + ' ' + y1 + ' L ' + x1 + ' ' + midY + ' L ' + x2 + ' ' + midY + ' L ' + x2 + ' ' + y2;
        }
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'algo-edge__line');
        path.setAttribute('marker-end', 'url(#algoArrow)');
        g.appendChild(path);
        if (edge.label) {
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const labelW = Math.max(40, edge.label.length * 7 + 12);
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', mx - labelW / 2);
            rect.setAttribute('y', my - 10);
            rect.setAttribute('width', labelW);
            rect.setAttribute('height', 20);
            rect.setAttribute('rx', 6);
            rect.setAttribute('class', 'algo-edge__label-bg');
            g.appendChild(rect);
            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('x', mx);
            lbl.setAttribute('y', my + 4);
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('class', 'algo-edge__label');
            lbl.textContent = edge.label;
            g.appendChild(lbl);
        }
        return g;
    }

    function bindZoom() {
        let raf = null;
        let pendingZoom = 1;
        let pendingX = 0, pendingY = 0;
        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            const factor = delta > 0 ? 1.12 : 0.89;
            pendingZoom = clamp(state.zoom * factor, state.minZoom, state.maxZoom);
            const rect = stage.getBoundingClientRect();
            pendingX = e.clientX - rect.left;
            pendingY = e.clientY - rect.top;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                const newZoom = pendingZoom;
                if (newZoom === state.zoom) return;
                state.offsetX = pendingX - (pendingX - state.offsetX) * (newZoom / state.zoom);
                state.offsetY = pendingY - (pendingY - state.offsetY) * (newZoom / state.zoom);
                state.zoom = newZoom;
                applyTransform();
            });
        }, { passive: false });
    }

    function applyTransform() {
        canvas.style.transform = 'translate(' + state.offsetX + 'px, ' + state.offsetY + 'px) scale(' + state.zoom + ')';
        canvas.style.transformOrigin = '0 0';
    }

    function bindControls() {
        document.getElementById('algoZoomIn')?.addEventListener('click', () => {
            state.zoom = clamp(state.zoom * 1.2, state.minZoom, state.maxZoom);
            applyTransform();
        });
        document.getElementById('algoZoomOut')?.addEventListener('click', () => {
            state.zoom = clamp(state.zoom * 0.83, state.minZoom, state.maxZoom);
            applyTransform();
        });
        document.getElementById('algoZoomReset')?.addEventListener('click', () => {
            state.zoom = 1;
            state.offsetX = 0;
            state.offsetY = 0;
            applyTransform();
            centerView();
        });
    }

    function bindPan() {
        let raf = null;
        let pendingX = 0, pendingY = 0;
        stage.addEventListener('mousedown', (e) => {
            if (e.target.closest('.algo-node')) return;
            state.isPanning = true;
            state.panStart = { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY };
            stage.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!state.isPanning) return;
            pendingX = e.clientX - state.panStart.x;
            pendingY = e.clientY - state.panStart.y;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                state.offsetX = pendingX;
                state.offsetY = pendingY;
                applyTransform();
            });
        });
        window.addEventListener('mouseup', () => {
            if (state.isPanning) {
                state.isPanning = false;
                stage.style.cursor = '';
            }
        });
        stage.addEventListener('click', (e) => {
            if (e.target.closest('.algo-node')) return;
            deselectNode();
        });
    }

    function centerView() {
        if (!stage || !canvas) return;
        const stageRect = stage.getBoundingClientRect();
        const canvasW = parseFloat(canvas.style.width) || 1200;
        const canvasH = parseFloat(canvas.style.height) || 1800;
        const scaleX = (stageRect.width - 40) / canvasW;
        const scaleY = (stageRect.height - 40) / canvasH;
        const fitZoom = clamp(Math.min(scaleX, scaleY), state.minZoom, 1);
        state.zoom = fitZoom;
        state.offsetX = (stageRect.width - canvasW * state.zoom) / 2;
        state.offsetY = (stageRect.height - canvasH * state.zoom) / 2;
        applyTransform();
    }

    function selectNode(nodeId) {
        const node = ALGO_NODES.find(n => n.id === nodeId);
        if (!node) return;
        state.activeNodeId = nodeId;
        document.querySelectorAll('.algo-node').forEach(el => el.classList.remove('algo-node--active'));
        document.querySelector('[data-node-id="' + nodeId + '"]')?.classList.add('algo-node--active');
        renderPanel(node);
    }

    function deselectNode() {
        state.activeNodeId = null;
        document.querySelectorAll('.algo-node').forEach(el => el.classList.remove('algo-node--active'));
        panel.innerHTML = '<div class="algo-panel__empty"><div class="algo-panel__empty-icon">📋</div><div class="algo-panel__empty-text">Кликните по блоку схемы, чтобы увидеть пояснение</div></div>';
    }

    function renderPanel(node) {
        const t = node.tooltip || {};
        const badge = {
            terminal: 'Терминатор',
            process:  'Действие',
            decision: 'Условие',
            data:     'Данные'
        }[node.type] || '';
        let extras = '';
        if (t.macro) {
            extras += '<div class="algo-panel__row"><div class="algo-panel__row-label">🎮 Макрос</div><div class="algo-panel__row-value">' + escapeHtml(t.macro) + '</div></div>';
        }
        if (t.template) {
            extras += '<div class="algo-panel__row"><div class="algo-panel__row-label">📨 Шаблон</div><div class="algo-panel__row-value">' + escapeHtml(t.template) + '</div></div>';
        }
        if (t.tab) {
            const tabLabel = {
                decree: '📜 Постановление',
                wanted: '🔍 Розыск',
                final: '📋 Итоговое',
                templates: '📨 Шаблоны'
            }[t.tab] || t.tab;
            extras += '<div class="algo-panel__row"><div class="algo-panel__row-label">📂 Вкладка</div><div class="algo-panel__row-value">' + tabLabel + '</div></div>';
        }
        panel.innerHTML =
            '<div class="algo-panel__header"><div class="algo-panel__badge algo-panel__badge--' + node.type + '">' + badge + '</div><h3 class="algo-panel__title">' + escapeHtml(t.title || node.label) + '</h3></div>' +
            '<div class="algo-panel__body"><p class="algo-panel__desc">' + escapeHtml(t.description || 'Описание не задано.') + '</p>' + extras + '</div>' +
            '<div class="algo-panel__footer"><button class="btn btn--primary btn--block" id="algoGotoBtn" ' + (t.tab ? '' : 'disabled') + '>➡️ Открыть в генераторе</button></div>';
        const gotoBtn = document.getElementById('algoGotoBtn');
        if (gotoBtn && t.tab) {
            gotoBtn.addEventListener('click', () => {
                const tabBtn = document.querySelector('.tabs__btn[data-tab="' + t.tab + '"]');
                if (tabBtn) tabBtn.click();
            });
        }
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    return { init, selectNode, deselectNode };
})();
`;

        const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'algorithm.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showSaveToast();
    }

    function showSaveToast() {
        const t = document.createElement('div');
        t.className = 'editor-toast';
        t.innerHTML = '✅ <b>algorithm.js</b> скачан. Замените файл в проекте на новый.';
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('editor-toast--show'));
        setTimeout(() => {
            t.classList.remove('editor-toast--show');
            setTimeout(() => t.remove(), 300);
        }, 3500);
    }

    function resetAll() {
        if (!confirm('Удалить все внесённые изменения и загрузить исходную схему?')) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        location.reload();
    }

    // ============================================================
    // ХЕЛПЕРЫ
    // ============================================================
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    init();
})();

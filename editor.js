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
        isDraggingNode: false,
        linkMode: false,
        linkFrom: null,
        selectedEdgeIndex: -1
    };

    const MIN_W = 120;
    const MAX_W = 400;
    const PAD_X = 28;
    const PAD_Y = 20;
    const LINE_H = 18;
    const MIN_H = 50;
    const CHAR_W = 7.5;

    const STORAGE_KEY = 'usms_algo_editor_draft_v2';

    let stage, canvas, panel, svgEl, viewportG, linkHint;

    // ============================================================
    // ЗАГРУЗКА / СОХРАНЕНИЕ
    // ============================================================
    function loadData() {
        let data = null;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length) data = parsed;
            }
        } catch (e) {}

        if (!data) {
            const src = window.USMS_ALGO || {};
            const srcNodes = src.ALGO_NODES || [];
            const srcEdges = src.ALGO_EDGES || [];
            if (!srcNodes.length) {
                console.warn('USMS_ALGO пустой. Проверьте, что algorithm.js экспортирует ALGO_NODES / ALGO_EDGES.');
            }
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: state.nodes, edges: state.edges }));
        } catch (e) {}
    }

    // ============================================================
    // ВЫЧИСЛЕНИЕ РАЗМЕРА ПО ТЕКСТУ
    // ============================================================
    function computeNodeSize(node) {
        const label = node.label || '';
        const isDecision = node.type === 'decision';

        // Подбираем ширину от MIN_W до MAX_W
        let width = MIN_W;
        const words = label.split(/\s+/);
        let longest = 0;
        words.forEach(w => { if (w.length > longest) longest = w.length; });

        // Не даём словам быть шире, чем MAX_W - PAD_X*2
        const minWidthForLongest = longest * CHAR_W + PAD_X * 2;
        width = Math.max(MIN_W, Math.min(MAX_W, Math.max(minWidthForLongest, label.length * CHAR_W * 0.5 + PAD_X * 2)));

        // Рассчитываем, сколько строк влезет
        const maxCharsPerLine = Math.floor((width - PAD_X * 2) / CHAR_W);
        const lines = wrapText(label, maxCharsPerLine);
        let height = lines.length * LINE_H + PAD_Y * 2;
        height = Math.max(MIN_H, height);

        // Ромб — должен быть крупнее
        if (isDecision) {
            width = Math.max(width * 1.15, 200);
            height = Math.max(height * 1.6, 100);
        }

        return { w: Math.round(width), h: Math.round(height), lines, maxCharsPerLine };
    }

    function wrapText(text, maxChars) {
        if (maxChars < 4) maxChars = 4;
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

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    function init() {
        stage = document.getElementById('algoStage');
        canvas = document.getElementById('algoCanvas');
        panel = document.getElementById('editorPanel');
        if (!stage || !canvas || !panel) {
            console.error('Не найдены базовые элементы');
            return;
        }

        loadData();
        buildToolbar();
        buildSvg();
        bindZoom();
        bindPan();
        bindControls();
        bindHeader();
        bindHotkeys();
        setTimeout(() => centerView(), 30);
    }

    // ============================================================
    // ТУЛБАР
    // ============================================================
    function buildToolbar() {
        const header = document.querySelector('.editor-header__actions');
        if (!header) return;

        const addBtn = document.createElement('button');
        addBtn.className = 'ebtn ebtn--primary';
        addBtn.id = 'btnAddNode';
        addBtn.textContent = '➕ Добавить блок';
        header.insertBefore(addBtn, header.firstChild);

        const linkBtn = document.createElement('button');
        linkBtn.className = 'ebtn';
        linkBtn.id = 'btnLinkMode';
        linkBtn.textContent = '🔗 Связь';
        header.insertBefore(linkBtn, addBtn.nextSibling);

        addBtn.addEventListener('click', () => {
            const id = 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const newNode = {
                id,
                type: 'process',
                x: 400 + Math.random() * 200,
                y: 400 + Math.random() * 200,
                label: 'Новый блок',
                tooltip: { title: '', description: '', macro: '', template: '', tab: '' }
            };
            state.nodes.push(newNode);
            rebuildAll();
            selectNode(id);
            saveDraft();
        });

        linkBtn.addEventListener('click', () => toggleLinkMode());
    }

    // ============================================================
    // РЕЖИМ СВЯЗИ
    // ============================================================
    function toggleLinkMode(force) {
        state.linkMode = typeof force === 'boolean' ? force : !state.linkMode;
        state.linkFrom = null;
        const btn = document.getElementById('btnLinkMode');
        if (btn) btn.classList.toggle('ebtn--active', state.linkMode);

        if (state.linkMode) {
            showLinkHint('🔗 Кликните по блоку-источнику');
        } else {
            hideLinkHint();
        }
        rebuildAll();
    }

    function showLinkHint(text) {
        if (!linkHint) {
            linkHint = document.createElement('div');
            linkHint.className = 'editor-link-hint';
            stage.appendChild(linkHint);
        }
        linkHint.textContent = text;
        linkHint.style.display = 'block';
    }

    function hideLinkHint() {
        if (linkHint) linkHint.style.display = 'none';
    }

    function handleLinkClick(nodeId) {
        if (!state.linkMode) return false;

        if (!state.linkFrom) {
            state.linkFrom = nodeId;
            showLinkHint('🔗 Источник выбран. Кликните по целевому блоку');
            rebuildAll();
            return true;
        }

        if (state.linkFrom === nodeId) {
            state.linkFrom = null;
            showLinkHint('🔗 Кликните по блоку-источнику');
            rebuildAll();
            return true;
        }

        const exists = state.edges.some(e => e.from === state.linkFrom && e.to === nodeId);
        if (!exists) {
            state.edges.push({ from: state.linkFrom, to: nodeId, label: '' });
            saveDraft();
        }

        state.linkFrom = null;
        showLinkHint('✅ Связь создана. Кликните по новому источнику или выключите режим');
        rebuildAll();
        return true;
    }

    // ============================================================
    // SVG
    // ============================================================
    function buildSvg() {
        const NS = 'http://www.w3.org/2000/svg';
        const maxX = Math.max(1200, ...state.nodes.map(n => n.x + 300)) + 400;
        const maxY = Math.max(1000, ...state.nodes.map(n => n.y + 200)) + 300;

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

        state.edges.forEach((edge, idx) => viewportG.appendChild(buildEdge(edge, idx)));
        state.nodes.forEach(node => viewportG.appendChild(buildNode(node)));

        canvas.appendChild(svgEl);
    }

    function rebuildAll() {
        buildSvg();
        applyTransform();
    }

    function buildNode(node) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', `editor-node editor-node--${node.type}`);
        g.setAttribute('data-node-id', node.id);
        g.style.cursor = 'pointer';

        if (state.linkFrom === node.id) g.classList.add('editor-node--link-source');
        if (state.activeNodeId === node.id) g.classList.add('editor-node--active');

        const { w, h, lines } = computeNodeSize(node);
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
            shape.setAttribute('rx', isTerminal ? h / 2 : 14);
            shape.setAttribute('ry', isTerminal ? h / 2 : 14);
        }
        shape.setAttribute('class', 'editor-node__shape');
        g.appendChild(shape);

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('class', 'editor-node__text');

        const startDy = -((lines.length - 1) * LINE_H) / 2;
        lines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', node.x);
            tspan.setAttribute('dy', idx === 0 ? startDy + 4 : LINE_H);
            if (idx === 0) tspan.setAttribute('y', node.y);
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        g.appendChild(text);

        g.addEventListener('mousedown', (e) => startNodeDrag(e, node));
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.isDraggingNode) return;

            if (state.linkMode && handleLinkClick(node.id)) return;

            selectNode(node.id);
        });

        return g;
    }

    function buildEdge(edge, idx) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'editor-edge' + (state.selectedEdgeIndex === idx ? ' editor-edge--selected' : ''));
        g.setAttribute('data-edge-index', idx);
        g.style.cursor = 'pointer';

        const from = state.nodes.find(n => n.id === edge.from);
        const to = state.nodes.find(n => n.id === edge.to);
        if (!from || !to) return g;

        const fromSize = computeNodeSize(from);
        const toSize = computeNodeSize(to);

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

        const hitArea = document.createElementNS(NS, 'path');
        hitArea.setAttribute('d', d);
        hitArea.setAttribute('stroke', 'transparent');
        hitArea.setAttribute('stroke-width', '14');
        hitArea.setAttribute('fill', 'none');
        hitArea.style.pointerEvents = 'stroke';
        g.appendChild(hitArea);

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

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selectedEdgeIndex = idx;
            state.activeNodeId = null;
            document.querySelectorAll('.editor-node').forEach(el => el.classList.remove('editor-node--active'));
            renderEdgePanel(edge, idx);
            rebuildAll();
        });

        return g;
    }

    // ============================================================
    // DRAG УЗЛА
    // ============================================================
    function startNodeDrag(e, node) {
        if (e.button !== 0) return;
        if (state.linkMode) return;
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
        state.dragNode.x += dx / state.zoom;
        state.dragNode.y += dy / state.zoom;
        state.dragOffset = { x: e.clientX, y: e.clientY };
        redraw();
    }

    function onNodeDragEnd() {
        if (state.dragNode) {
            saveDraft();
            if (state.isDraggingNode) renderPanel(state.dragNode);
        }
        state.dragNode = null;
        state.isDraggingNode = false;
        stage.style.cursor = '';
        window.removeEventListener('mousemove', onNodeDragMove);
        window.removeEventListener('mouseup', onNodeDragEnd);
    }

    function redraw() {
        // Перетаскиваем все узлы и стрелки — пересобираем всё заново, но быстро
        const activeId = state.activeNodeId;
        const linkFrom = state.linkFrom;

        // Обновляем позиции в существующих нодах (без полного пересоздания)
        state.nodes.forEach(node => {
            const g = viewportG.querySelector(`[data-node-id="${node.id}"]`);
            if (!g) return;
            const { w, h } = computeNodeSize(node);
            const isDecision = node.type === 'decision';
            const shape = g.querySelector('.editor-node__shape');
            if (isDecision) {
                shape.setAttribute('points', [
                    `${node.x},${node.y - h / 2}`,
                    `${node.x + w / 2},${node.y}`,
                    `${node.x},${node.y + h / 2}`,
                    `${node.x - w / 2},${node.y}`
                ].join(' '));
            } else {
                shape.setAttribute('x', node.x - w / 2);
                shape.setAttribute('y', node.y - h / 2);
                shape.setAttribute('width', w);
                shape.setAttribute('height', h);
            }
            const text = g.querySelector('.editor-node__text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.querySelectorAll('tspan').forEach(tspan => tspan.setAttribute('x', node.x));
        });

        // Стрелки — удаляем и пересобираем (они дешёвые)
        viewportG.querySelectorAll('.editor-edge').forEach(g => g.remove());
        state.edges.forEach((edge, idx) => {
            const g = buildEdge(edge, idx);
            viewportG.insertBefore(g, viewportG.firstChild);
        });
    }

    // ============================================================
    // ПАНОРАМА / ЗУМ
    // ============================================================
    function bindPan() {
        let raf = null, px = 0, py = 0;
        stage.addEventListener('mousedown', (e) => {
            if (e.target.closest('.editor-node')) return;
            if (e.target.closest('.editor-edge')) return;
            state.isPanning = true;
            state.panStart = { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY };
            stage.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!state.isPanning) return;
            px = e.clientX - state.panStart.x;
            py = e.clientY - state.panStart.y;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                state.offsetX = px;
                state.offsetY = py;
                applyTransform();
            });
        });
        window.addEventListener('mouseup', () => {
            if (state.isPanning) { state.isPanning = false; stage.style.cursor = ''; }
        });
        stage.addEventListener('click', (e) => {
            if (e.target.closest('.editor-node')) return;
            if (e.target.closest('.editor-edge')) return;
            deselect();
        });
    }

    function bindZoom() {
        let raf = null, pz = 1, px = 0, py = 0;
        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            const factor = delta > 0 ? 1.12 : 0.89;
            pz = clamp(state.zoom * factor, state.minZoom, state.maxZoom);
            const rect = stage.getBoundingClientRect();
            px = e.clientX - rect.left;
            py = e.clientY - rect.top;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                const newZoom = pz;
                if (newZoom === state.zoom) return;
                state.offsetX = px - (px - state.offsetX) * (newZoom / state.zoom);
                state.offsetY = py - (py - state.offsetY) * (newZoom / state.zoom);
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
            state.zoom = clamp(state.zoom * 1.2, state.minZoom, state.maxZoom); applyTransform();
        });
        document.getElementById('btnZoomOut')?.addEventListener('click', () => {
            state.zoom = clamp(state.zoom * 0.83, state.minZoom, state.maxZoom); applyTransform();
        });
        document.getElementById('btnZoomReset')?.addEventListener('click', () => {
            state.zoom = 1; state.offsetX = 0; state.offsetY = 0;
            applyTransform(); centerView();
        });
    }

    function centerView() {
        if (!stage || !canvas) return;
        const stageRect = stage.getBoundingClientRect();
        const canvasW = parseFloat(canvas.style.width) || 1200;
        const canvasH = parseFloat(canvas.style.height) || 1800;
        state.zoom = clamp(Math.min((stageRect.width - 40) / canvasW, (stageRect.height - 40) / canvasH), state.minZoom, 1);
        state.offsetX = (stageRect.width - canvasW * state.zoom) / 2;
        state.offsetY = (stageRect.height - canvasH * state.zoom) / 2;
        applyTransform();
    }

    // ============================================================
    // ПАНЕЛЬ УЗЛА
    // ============================================================
    function selectNode(id) {
        const node = state.nodes.find(n => n.id === id);
        if (!node) return;
        state.activeNodeId = id;
        state.selectedEdgeIndex = -1;
        document.querySelectorAll('.editor-node').forEach(el => el.classList.remove('editor-node--active'));
        document.querySelector(`[data-node-id="${id}"]`)?.classList.add('editor-node--active');
        renderPanel(node);
    }

    function deselect() {
        state.activeNodeId = null;
        state.selectedEdgeIndex = -1;
        document.querySelectorAll('.editor-node').forEach(el => el.classList.remove('editor-node--active'));
        panel.innerHTML = `
            <div class="editor-panel__empty">
                <div class="editor-panel__empty-icon">📋</div>
                <div class="editor-panel__empty-text">Кликните по блоку, чтобы отредактировать</div>
            </div>
        `;
    }

    function renderPanel(node) {
        const typeLabels = { process: 'Действие', decision: 'Условие', terminal: 'Терминатор', data: 'Данные' };
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
                <div class="editor-panel__divider">Действия</div>
                <button class="ebtn ebtn--block" id="btnLinkFrom">🔗 Создать связь из этого блока</button>
                <button class="ebtn ebtn--block ebtn--danger" id="btnDeleteNode">🗑 Удалить блок</button>
            </div>
            <div class="editor-panel__footer">
                <div class="editor-panel__coords">X: ${Math.round(node.x)} · Y: ${Math.round(node.y)} · ID: <code>${escapeHtml(node.id)}</code></div>
            </div>
        `;
        bindPanelInputs(node);

        document.getElementById('btnLinkFrom').addEventListener('click', () => {
            toggleLinkMode(true);
            state.linkFrom = node.id;
            showLinkHint('🔗 Источник выбран. Кликните по целевому блоку');
            rebuildAll();
        });
        document.getElementById('btnDeleteNode').addEventListener('click', () => deleteNode(node.id));
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
            // Полная перерисовка — размер блока может измениться
            rebuildAll();
            selectNode(node.id);
            saveDraft();
        });
        fType.addEventListener('change', () => { node.type = fType.value; rebuildAll(); selectNode(node.id); saveDraft(); });
        fTitle.addEventListener('input', () => { node.tooltip.title = fTitle.value; saveDraft(); });
        fDescription.addEventListener('input', () => { node.tooltip.description = fDescription.value; saveDraft(); });
        fMacro.addEventListener('input', () => { node.tooltip.macro = fMacro.value; saveDraft(); });
        fTemplate.addEventListener('input', () => { node.tooltip.template = fTemplate.value; saveDraft(); });
        fTab.addEventListener('change', () => { node.tooltip.tab = fTab.value; saveDraft(); });
    }

    function deleteNode(id) {
        if (!confirm('Удалить этот блок и все его связи?')) return;
        state.nodes = state.nodes.filter(n => n.id !== id);
        state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
        state.activeNodeId = null;
        rebuildAll();
        deselect();
        saveDraft();
    }

    // ============================================================
    // ПАНЕЛЬ СВЯЗИ
    // ============================================================
    function renderEdgePanel(edge, idx) {
        const from = state.nodes.find(n => n.id === edge.from);
        const to = state.nodes.find(n => n.id === edge.to);
        panel.innerHTML = `
            <div class="editor-panel__header">
                <div class="editor-panel__badge">Связь</div>
                <h3 class="editor-panel__title">Редактирование стрелки</h3>
            </div>
            <div class="editor-panel__body">
                <div class="efield">
                    <span class="efield__label">Из</span>
                    <div style="padding:8px 12px;background:rgba(11,22,34,0.4);border-radius:12px;font-size:0.85rem;">${escapeHtml(from?.label || edge.from)}</div>
                </div>
                <div class="efield">
                    <span class="efield__label">В</span>
                    <div style="padding:8px 12px;background:rgba(11,22,34,0.4);border-radius:12px;font-size:0.85rem;">${escapeHtml(to?.label || edge.to)}</div>
                </div>
                <label class="efield">
                    <span class="efield__label">Подпись (Да / Нет / и т.п.)</span>
                    <input class="efield__input" id="fEdgeLabel" type="text" value="${escapeAttr(edge.label)}" placeholder="Пусто — без подписи">
                </label>
                <div class="editor-panel__divider">Действия</div>
                <button class="ebtn ebtn--block ebtn--danger" id="btnDeleteEdge">🗑 Удалить связь</button>
            </div>
        `;
        document.getElementById('fEdgeLabel').addEventListener('input', (e) => {
            edge.label = e.target.value;
            saveDraft();
            redraw();
        });
        document.getElementById('btnDeleteEdge').addEventListener('click', () => {
            if (!confirm('Удалить эту связь?')) return;
            state.edges.splice(idx, 1);
            state.selectedEdgeIndex = -1;
            rebuildAll();
            deselect();
            saveDraft();
        });
    }

    // ============================================================
    // ЭКСПОРТ
    // ============================================================
    function bindHeader() {
        document.getElementById('btnDownload')?.addEventListener('click', downloadAlgorithmJs);
        document.getElementById('btnResetAll')?.addEventListener('click', resetAll);
    }

    function downloadAlgorithmJs() {
        const nodesJs = state.nodes.map(n =>
            `        { id: ${JSON.stringify(n.id)}, type: ${JSON.stringify(n.type)}, x: ${Math.round(n.x)}, y: ${Math.round(n.y)},\n          label: ${JSON.stringify(n.label)},\n          tooltip: { title: ${JSON.stringify(n.tooltip.title)}, description: ${JSON.stringify(n.tooltip.description)}, macro: ${JSON.stringify(n.tooltip.macro)}, template: ${JSON.stringify(n.tooltip.template)}, tab: ${JSON.stringify(n.tooltip.tab)} } }`
        ).join(',\n\n');

        const edgesJs = state.edges.map(e => {
            const parts = [`from: ${JSON.stringify(e.from)}`, `to: ${JSON.stringify(e.to)}`];
            if (e.label) parts.push(`label: ${JSON.stringify(e.label)}`);
            return `        { ${parts.join(', ')} }`;
        }).join(',\n');

        const content =
`window.USMS_ALGO = (function () {
    'use strict';

    const NODE_W = 220, NODE_H = 72, DECISION_W = 280, DECISION_H = 130, TERMINAL_W = 200, TERMINAL_H = 60;

    const ALGO_NODES = [

${nodesJs}

    ];

    const ALGO_EDGES = [

${edgesJs}

    ];

    const state = { zoom: 1, minZoom: 0.15, maxZoom: 2.5, offsetX: 0, offsetY: 0, isPanning: false, panStart: { x: 0, y: 0 }, activeNodeId: null };
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
        const maxX = Math.max(...ALGO_NODES.map(n => n.x + 300)) + 400;
        const maxY = Math.max(...ALGO_NODES.map(n => n.y + 200)) + 300;
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
        const ap = document.createElementNS(NS, 'path');
        ap.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        ap.setAttribute('fill', 'rgba(139, 176, 204, 0.55)');
        marker.appendChild(ap);
        defs.appendChild(marker);
        svgEl.appendChild(defs);
        viewportG = document.createElementNS(NS, 'g');
        svgEl.appendChild(viewportG);
        ALGO_EDGES.forEach(edge => viewportG.appendChild(buildEdge(edge)));
        ALGO_NODES.forEach(node => viewportG.appendChild(buildNode(node)));
        canvas.appendChild(svgEl);
    }

    function computeSize(node) {
        const label = node.label || '';
        const isD = node.type === 'decision';
        const MIN_W = 120, MAX_W = 400, PAD_X = 28, PAD_Y = 20, LINE_H = 18, MIN_H = 50, CHAR_W = 7.5;
        const words = label.split(/\\s+/);
        let longest = 0;
        words.forEach(w => { if (w.length > longest) longest = w.length; });
        let width = Math.max(MIN_W, Math.min(MAX_W, Math.max(longest * CHAR_W + PAD_X * 2, label.length * CHAR_W * 0.5 + PAD_X * 2)));
        const maxChars = Math.floor((width - PAD_X * 2) / CHAR_W);
        const lines = wrapText(label, maxChars);
        let height = Math.max(MIN_H, lines.length * LINE_H + PAD_Y * 2);
        if (isD) { width = Math.max(width * 1.15, 200); height = Math.max(height * 1.6, 100); }
        return { w: Math.round(width), h: Math.round(height), lines };
    }

    function wrapText(text, maxChars) {
        if (maxChars < 4) maxChars = 4;
        const words = String(text).split(/\\s+/);
        const lines = [];
        let cur = '';
        words.forEach(w => {
            const t = cur ? cur + ' ' + w : w;
            if (t.length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = t; }
        });
        if (cur) lines.push(cur);
        return lines.length ? lines : [''];
    }

    function buildNode(node) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'algo-node algo-node--' + node.type);
        g.setAttribute('data-node-id', node.id);
        g.style.cursor = 'pointer';
        const { w, h, lines } = computeSize(node);
        const isD = node.type === 'decision';
        const isT = node.type === 'terminal';
        let shape;
        if (isD) {
            shape = document.createElementNS(NS, 'polygon');
            shape.setAttribute('points', [node.x + ',' + (node.y - h/2), (node.x + w/2) + ',' + node.y, node.x + ',' + (node.y + h/2), (node.x - w/2) + ',' + node.y].join(' '));
        } else {
            shape = document.createElementNS(NS, 'rect');
            shape.setAttribute('x', node.x - w/2);
            shape.setAttribute('y', node.y - h/2);
            shape.setAttribute('width', w);
            shape.setAttribute('height', h);
            shape.setAttribute('rx', isT ? h/2 : 14);
            shape.setAttribute('ry', isT ? h/2 : 14);
        }
        shape.setAttribute('class', 'algo-node__shape');
        g.appendChild(shape);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('class', 'algo-node__text');
        const startDy = -((lines.length - 1) * 18) / 2;
        lines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', node.x);
            tspan.setAttribute('dy', idx === 0 ? startDy + 4 : 18);
            if (idx === 0) tspan.setAttribute('y', node.y);
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        g.appendChild(text);
        g.addEventListener('click', e => { e.stopPropagation(); selectNode(node.id); });
        return g;
    }

    function buildEdge(edge) {
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'algo-edge');
        const from = ALGO_NODES.find(n => n.id === edge.from);
        const to = ALGO_NODES.find(n => n.id === edge.to);
        if (!from || !to) return g;
        const fs = computeSize(from);
        const ts = computeSize(to);
        const x1 = from.x, y1 = from.y + fs.h/2, x2 = to.x, y2 = to.y - ts.h/2;
        let d;
        if (Math.abs(x2 - x1) < 5) { d = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2; }
        else { const my = y1 + (y2 - y1)/2; d = 'M ' + x1 + ' ' + y1 + ' L ' + x1 + ' ' + my + ' L ' + x2 + ' ' + my + ' L ' + x2 + ' ' + y2; }
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'algo-edge__line');
        p.setAttribute('marker-end', 'url(#algoArrow)');
        g.appendChild(p);
        if (edge.label) {
            const mx = (x1+x2)/2, my = (y1+y2)/2;
            const lw = Math.max(40, edge.label.length * 7 + 12);
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x', mx - lw/2);
            r.setAttribute('y', my - 10);
            r.setAttribute('width', lw);
            r.setAttribute('height', 20);
            r.setAttribute('rx', 6);
            r.setAttribute('class', 'algo-edge__label-bg');
            g.appendChild(r);
            const lb = document.createElementNS(NS, 'text');
            lb.setAttribute('x', mx);
            lb.setAttribute('y', my + 4);
            lb.setAttribute('text-anchor', 'middle');
            lb.setAttribute('class', 'algo-edge__label');
            lb.textContent = edge.label;
            g.appendChild(lb);
        }
        return g;
    }

    function bindZoom() {
        let raf = null, pz = 1, px = 0, py = 0;
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            const d = -Math.sign(e.deltaY);
            const f = d > 0 ? 1.12 : 0.89;
            pz = clamp(state.zoom * f, state.minZoom, state.maxZoom);
            const r = stage.getBoundingClientRect();
            px = e.clientX - r.left;
            py = e.clientY - r.top;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                const nz = pz;
                if (nz === state.zoom) return;
                state.offsetX = px - (px - state.offsetX) * (nz / state.zoom);
                state.offsetY = py - (py - state.offsetY) * (nz / state.zoom);
                state.zoom = nz;
                applyTransform();
            });
        }, { passive: false });
    }

    function applyTransform() {
        canvas.style.transform = 'translate(' + state.offsetX + 'px, ' + state.offsetY + 'px) scale(' + state.zoom + ')';
        canvas.style.transformOrigin = '0 0';
    }

    function bindControls() {
        document.getElementById('algoZoomIn')?.addEventListener('click', () => { state.zoom = clamp(state.zoom * 1.2, state.minZoom, state.maxZoom); applyTransform(); });
        document.getElementById('algoZoomOut')?.addEventListener('click', () => { state.zoom = clamp(state.zoom * 0.83, state.minZoom, state.maxZoom); applyTransform(); });
        document.getElementById('algoZoomReset')?.addEventListener('click', () => { state.zoom = 1; state.offsetX = 0; state.offsetY = 0; applyTransform(); centerView(); });
    }

    function bindPan() {
        let raf = null, px = 0, py = 0;
        stage.addEventListener('mousedown', e => {
            if (e.target.closest('.algo-node')) return;
            state.isPanning = true;
            state.panStart = { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY };
            stage.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!state.isPanning) return;
            px = e.clientX - state.panStart.x;
            py = e.clientY - state.panStart.y;
            if (raf) return;
            raf = requestAnimationFrame(() => { raf = null; state.offsetX = px; state.offsetY = py; applyTransform(); });
        });
        window.addEventListener('mouseup', () => { if (state.isPanning) { state.isPanning = false; stage.style.cursor = ''; } });
        stage.addEventListener('click', e => { if (e.target.closest('.algo-node')) return; deselectNode(); });
    }

    function centerView() {
        if (!stage || !canvas) return;
        const sr = stage.getBoundingClientRect();
        const cw = parseFloat(canvas.style.width) || 1200;
        const ch = parseFloat(canvas.style.height) || 1800;
        state.zoom = clamp(Math.min((sr.width - 40) / cw, (sr.height - 40) / ch), state.minZoom, 1);
        state.offsetX = (sr.width - cw * state.zoom) / 2;
        state.offsetY = (sr.height - ch * state.zoom) / 2;
        applyTransform();
    }

    function selectNode(id) {
        const node = ALGO_NODES.find(n => n.id === id);
        if (!node) return;
        state.activeNodeId = id;
        document.querySelectorAll('.algo-node').forEach(el => el.classList.remove('algo-node--active'));
        document.querySelector('[data-node-id="' + id + '"]')?.classList.add('algo-node--active');
        renderPanel(node);
    }

    function deselectNode() {
        state.activeNodeId = null;
        document.querySelectorAll('.algo-node').forEach(el => el.classList.remove('algo-node--active'));
        panel.innerHTML = '<div class="algo-panel__empty"><div class="algo-panel__empty-icon">📋</div><div class="algo-panel__empty-text">Кликните по блоку схемы, чтобы увидеть пояснение</div></div>';
    }

    function renderPanel(node) {
        const t = node.tooltip || {};
        const badge = { terminal: 'Терминатор', process: 'Действие', decision: 'Условие', data: 'Данные' }[node.type] || '';
        let ex = '';
        if (t.macro) ex += '<div class="algo-panel__row"><div class="algo-panel__row-label">🎮 Макрос</div><div class="algo-panel__row-value">' + escapeHtml(t.macro) + '</div></div>';
        if (t.template) ex += '<div class="algo-panel__row"><div class="algo-panel__row-label">📨 Шаблон</div><div class="algo-panel__row-value">' + escapeHtml(t.template) + '</div></div>';
        if (t.tab) { const tl = { decree: '📜 Постановление', wanted: '🔍 Розыск', final: '📋 Итоговое', templates: '📨 Шаблоны' }[t.tab] || t.tab; ex += '<div class="algo-panel__row"><div class="algo-panel__row-label">📂 Вкладка</div><div class="algo-panel__row-value">' + tl + '</div></div>'; }
        panel.innerHTML = '<div class="algo-panel__header"><div class="algo-panel__badge algo-panel__badge--' + node.type + '">' + badge + '</div><h3 class="algo-panel__title">' + escapeHtml(t.title || node.label) + '</h3></div><div class="algo-panel__body"><p class="algo-panel__desc">' + escapeHtml(t.description || 'Описание не задано.') + '</p>' + ex + '</div><div class="algo-panel__footer"><button class="btn btn--primary btn--block" id="algoGotoBtn" ' + (t.tab ? '' : 'disabled') + '>➡️ Открыть в генераторе</button></div>';
        const gb = document.getElementById('algoGotoBtn');
        if (gb && t.tab) { gb.addEventListener('click', () => { const tb = document.querySelector('.tabs__btn[data-tab="' + t.tab + '"]'); if (tb) tb.click(); }); }
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    return { init, selectNode, deselectNode, ALGO_NODES, ALGO_EDGES };
})();
`;

        const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'algorithm.js';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSaveToast();
    }

    function showSaveToast() {
        const t = document.createElement('div');
        t.className = 'editor-toast';
        t.innerHTML = '✅ <b>algorithm.js</b> скачан. Замените файл в проекте на новый.';
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('editor-toast--show'));
        setTimeout(() => { t.classList.remove('editor-toast--show'); setTimeout(() => t.remove(), 300); }, 3500);
    }

    function resetAll() {
        if (!confirm('Удалить все внесённые изменения и загрузить исходную схему?')) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        location.reload();
    }

    function bindHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (state.linkFrom) { state.linkFrom = null; showLinkHint('🔗 Кликните по блоку-источнику'); rebuildAll(); }
                else if (state.linkMode) { toggleLinkMode(false); }
                else deselect();
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && state.activeNodeId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                deleteNode(state.activeNodeId);
            }
        });
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function escapeAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    init();
})();

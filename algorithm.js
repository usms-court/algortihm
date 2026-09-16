window.USMS_ALGO = (function () {
    'use strict';

    const NODE_W = 220;
    const NODE_H = 72;
    const DECISION_W = 280;
    const DECISION_H = 130;
    const TERMINAL_W = 200;
    const TERMINAL_H = 60;

    const ALGO_NODES = [

        { id: 'start', type: 'terminal', x: 950, y: 40,
          label: 'Начало',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'step1_take', type: 'process', x: 300, y: 180,
          label: '1. Принять жалобу и оформить документы',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'step2_juris', type: 'process', x: 560, y: 180,
          label: '2. Проверить на подсудность суда',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'step3_folder', type: 'process', x: 820, y: 180,
          label: '3. Создать папку в папке прокурора (Дискорд)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'step4_notify', type: 'process', x: 1080, y: 180,
          label: '4. Оповестить прокурора и истца (Дискорд)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'pre_check', type: 'process', x: 950, y: 320,
          label: 'Досудебная проверка',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_has_defendant', type: 'decision', x: 250, y: 500,
          label: 'В постановлении ответчик указан?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_call_channel', type: 'process', x: 250, y: 700,
          label: 'Позвать в канал',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_dialog_started', type: 'decision', x: 250, y: 860,
          label: 'Начался диалог?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_notify_dept', type: 'process', x: 250, y: 1060,
          label: 'Оповестить в канале департамента',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_wait_response', type: 'process', x: 250, y: 1200,
          label: 'Ожидать ответа в канале департамента (30 д.)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_macro_id', type: 'process', x: 250, y: 1340,
          label: 'Макрос «Опознание + ЛД + КВ»',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_request_chat', type: 'process', x: 250, y: 1480,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'a_ident_end', type: 'terminal', x: 250, y: 1640,
          label: 'IDENT_END',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_has_fio', type: 'decision', x: 620, y: 500,
          label: 'В постановлении указано ФИО и должность?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_notify_def', type: 'process', x: 620, y: 700,
          label: 'Оповестить ответчика',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_dialog_goes', type: 'decision', x: 620, y: 860,
          label: 'Идёт диалог с ответчиком?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_has_in_dept', type: 'decision', x: 620, y: 1060,
          label: 'Есть ответчик в департаменте?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_macro_id', type: 'process', x: 400, y: 1280,
          label: 'Макрос «Опознание + ЛД + КВ»',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_paid_fine', type: 'decision', x: 840, y: 1280,
          label: 'Оплатил ли штраф?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_macro_cams', type: 'process', x: 700, y: 1500,
          label: 'Макрос «Запрос камер» / «Видеорегистратор»',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_remove_oos', type: 'process', x: 700, y: 1650,
          label: 'Снять меры ООС',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_request_chat', type: 'process', x: 700, y: 1790,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_ident_end', type: 'terminal', x: 700, y: 1940,
          label: 'IDENT_END',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_reg_post', type: 'process', x: 960, y: 1500,
          label: '✗ РЕГИСТРАЦИЯ ПОСТАНОВЛЕНИЯ',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'b_legal_end', type: 'terminal', x: 960, y: 1650,
          label: 'LEGAL_END',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_notify', type: 'process', x: 1400, y: 500,
          label: 'Уведомление: начали диалог / отказались / заявили требование',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_cancel_ban', type: 'process', x: 1200, y: 660,
          label: 'Снять запрет на увольнение',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_start_dialog', type: 'process', x: 1400, y: 660,
          label: 'Начать диалог с истцом',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_request_order', type: 'process', x: 1650, y: 660,
          label: 'Запрос на постановление: допрос свидетеля',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_interrog', type: 'decision', x: 1400, y: 820,
          label: 'Допрос был давно?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_notify_after', type: 'process', x: 1200, y: 1000,
          label: 'Уведомить ответчика (после допроса)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_doc_done', type: 'process', x: 1200, y: 1140,
          label: 'Запросить сведения о готовности к допросу',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_attach_proto', type: 'process', x: 1200, y: 1280,
          label: 'Приложить протокол',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_request_marshal_1', type: 'process', x: 1200, y: 1420,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_witness_talk', type: 'process', x: 1650, y: 1000,
          label: 'Опрос свидетеля: какие показания дал',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_witness_ban', type: 'process', x: 1650, y: 1140,
          label: 'Выдать запрет на посещение свидетеля',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_request_marshal_2', type: 'process', x: 1650, y: 1280,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_collect_evidence', type: 'process', x: 1400, y: 1500,
          label: 'Собрать имеющиеся доказательства',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_request_final', type: 'process', x: 1400, y: 1640,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'c_final_order', type: 'terminal', x: 1400, y: 1800,
          label: 'Финальное постановление',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_read', type: 'process', x: 950, y: 2000,
          label: '5. Ознакомиться с решением суда',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_type', type: 'decision', x: 950, y: 2160,
          label: 'Решение состязательного суда?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_closed_1', type: 'process', x: 620, y: 2360,
          label: 'Снять постановление MSFS',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_closed_2', type: 'process', x: 620, y: 2500,
          label: 'Выдать о запрете',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_closed_3', type: 'process', x: 620, y: 2640,
          label: 'Внести в реестр 3 месяца',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_closed_4', type: 'process', x: 620, y: 2780,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_won_1', type: 'process', x: 1280, y: 2360,
          label: 'Взыскать штрафы по решению суда',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_won_2', type: 'process', x: 1280, y: 2500,
          label: 'Выдать ордер',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_won_3', type: 'process', x: 1280, y: 2640,
          label: 'Взыскать штраф',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_won_4', type: 'process', x: 1280, y: 2780,
          label: 'Снять меры ООС',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_won_5', type: 'process', x: 1280, y: 2920,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_1', type: 'process', x: 950, y: 2360,
          label: 'Уведомить ответчика о снятии запрета',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_2', type: 'process', x: 950, y: 2500,
          label: 'Компенсация истцу',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_3', type: 'decision', x: 950, y: 2640,
          label: 'Начать диалог?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_4', type: 'decision', x: 950, y: 2840,
          label: 'Какие показания дал?',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_5', type: 'process', x: 780, y: 3020,
          label: 'Взыскать штраф по ТК/ГК (личный интерес)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_6', type: 'process', x: 1120, y: 3020,
          label: 'Взыскать штраф по ТК/ГК (интерес СМИ)',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_7', type: 'process', x: 950, y: 3180,
          label: 'Взыскать 3 месяца штрафа',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_8', type: 'process', x: 950, y: 3320,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_judges', type: 'process', x: 950, y: 3460,
          label: 'Д СУДЕЙ',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_open_request', type: 'process', x: 950, y: 3600,
          label: 'Запросить в чате у маршала',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } },

        { id: 'court_end', type: 'terminal', x: 950, y: 3760,
          label: 'Конец',
          tooltip: { title: '', description: '', macro: '', template: '', tab: '' } }
    ];

    const ALGO_EDGES = [
        { from: 'start', to: 'step1_take' },
        { from: 'step1_take', to: 'step2_juris' },
        { from: 'step2_juris', to: 'step3_folder' },
        { from: 'step3_folder', to: 'step4_notify' },
        { from: 'step4_notify', to: 'pre_check' },

        { from: 'pre_check', to: 'a_has_defendant' },
        { from: 'pre_check', to: 'b_has_fio' },
        { from: 'pre_check', to: 'c_notify' },

        { from: 'a_has_defendant', to: 'a_call_channel', label: 'Да' },
        { from: 'a_has_defendant', to: 'a_ident_end', label: 'Нет' },
        { from: 'a_call_channel', to: 'a_dialog_started' },
        { from: 'a_dialog_started', to: 'a_ident_end', label: 'Да' },
        { from: 'a_dialog_started', to: 'a_notify_dept', label: 'Нет' },
        { from: 'a_notify_dept', to: 'a_wait_response' },
        { from: 'a_wait_response', to: 'a_macro_id' },
        { from: 'a_macro_id', to: 'a_request_chat' },
        { from: 'a_request_chat', to: 'a_ident_end' },

        { from: 'b_has_fio', to: 'b_notify_def', label: 'Нет' },
        { from: 'b_has_fio', to: 'b_notify_def', label: 'Да' },
        { from: 'b_notify_def', to: 'b_dialog_goes' },
        { from: 'b_dialog_goes', to: 'b_ident_end', label: 'Да' },
        { from: 'b_dialog_goes', to: 'b_has_in_dept', label: 'Нет' },
        { from: 'b_has_in_dept', to: 'b_macro_id', label: 'Нет' },
        { from: 'b_has_in_dept', to: 'b_paid_fine', label: 'Да' },
        { from: 'b_macro_id', to: 'b_remove_oos' },
        { from: 'b_remove_oos', to: 'b_request_chat' },
        { from: 'b_request_chat', to: 'b_ident_end' },
        { from: 'b_paid_fine', to: 'b_macro_cams', label: 'Да' },
        { from: 'b_paid_fine', to: 'b_reg_post', label: 'Нет' },
        { from: 'b_macro_cams', to: 'b_remove_oos' },
        { from: 'b_reg_post', to: 'b_legal_end' },

        { from: 'c_notify', to: 'c_cancel_ban' },
        { from: 'c_notify', to: 'c_start_dialog' },
        { from: 'c_notify', to: 'c_request_order' },
        { from: 'c_cancel_ban', to: 'c_start_dialog' },
        { from: 'c_start_dialog', to: 'c_interrog' },
        { from: 'c_request_order', to: 'c_interrog' },
        { from: 'c_interrog', to: 'c_notify_after', label: 'Да' },
        { from: 'c_interrog', to: 'c_witness_talk', label: 'Нет' },
        { from: 'c_notify_after', to: 'c_doc_done' },
        { from: 'c_doc_done', to: 'c_attach_proto' },
        { from: 'c_attach_proto', to: 'c_request_marshal_1' },
        { from: 'c_request_marshal_1', to: 'c_collect_evidence' },
        { from: 'c_witness_talk', to: 'c_witness_ban' },
        { from: 'c_witness_ban', to: 'c_request_marshal_2' },
        { from: 'c_request_marshal_2', to: 'c_collect_evidence' },
        { from: 'c_collect_evidence', to: 'c_request_final' },
        { from: 'c_request_final', to: 'c_final_order' },
        { from: 'c_final_order', to: 'court_read' },

        { from: 'court_read', to: 'court_type' },
        { from: 'court_type', to: 'court_closed_1', label: 'ЗАКРЫТО' },
        { from: 'court_type', to: 'court_open_1', label: 'ОТКРЫТО' },
        { from: 'court_type', to: 'court_won_1', label: 'ВЫИГРАНО' },

        { from: 'court_closed_1', to: 'court_closed_2' },
        { from: 'court_closed_2', to: 'court_closed_3' },
        { from: 'court_closed_3', to: 'court_closed_4' },
        { from: 'court_closed_4', to: 'court_end' },

        { from: 'court_won_1', to: 'court_won_2' },
        { from: 'court_won_2', to: 'court_won_3' },
        { from: 'court_won_3', to: 'court_won_4' },
        { from: 'court_won_4', to: 'court_won_5' },
        { from: 'court_won_5', to: 'court_end' },

        { from: 'court_open_1', to: 'court_open_2' },
        { from: 'court_open_2', to: 'court_open_3' },
        { from: 'court_open_3', to: 'court_open_judges', label: 'Нет' },
        { from: 'court_open_3', to: 'court_open_4', label: 'Да' },
        { from: 'court_open_4', to: 'court_open_5', label: 'ЛИЧНЫЙ ИНТЕРЕС' },
        { from: 'court_open_4', to: 'court_open_6', label: 'ИНТЕРЕС СМИ' },
        { from: 'court_open_5', to: 'court_open_7' },
        { from: 'court_open_6', to: 'court_open_7' },
        { from: 'court_open_7', to: 'court_open_8' },
        { from: 'court_open_judges', to: 'court_open_request' },
        { from: 'court_open_request', to: 'court_end' },
        { from: 'court_open_8', to: 'court_end' }
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
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    return { init, selectNode, deselectNode, ALGO_NODES, ALGO_EDGES };
})();

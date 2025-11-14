// Network generation with emphasis on silos
function generateOrganicNetwork(nodeCount, centerX, centerY, radius) {
    const nodes = [];
    const connections = [];
    const patterns = [
        createCentralHub,
        createChain,
        createHierarchy,
        createCluster
    ];

    const minPatternDiversity = Math.min(patterns.length, Math.max(2, Math.floor(nodeCount / 12)));
    const requiredPatterns = shuffleArray([...patterns]).slice(0, minPatternDiversity);
    let lastPattern = null;
    let repeatCount = 0;

    const pickPattern = () => {
        if (requiredPatterns.length > 0) {
            const next = requiredPatterns.shift();
            lastPattern = next;
            repeatCount = 1;
            return next;
        }

        let candidate = patterns[Math.floor(Math.random() * patterns.length)];
        if (candidate === lastPattern) {
            repeatCount += 1;
            if (repeatCount > 2) {
                const alternatives = patterns.filter(fn => fn !== lastPattern);
                if (alternatives.length > 0) {
                    candidate = alternatives[Math.floor(Math.random() * alternatives.length)];
                    repeatCount = 1;
                }
            }
        } else {
            repeatCount = 1;
        }

        lastPattern = candidate;
        return candidate;
    };

    let currentIndex = 0;
    let siloIndex = 0;
    let attempts = 0;
    const maxAttempts = 60;

    while (currentIndex < nodeCount && attempts < maxAttempts) {
        const pattern = pickPattern();
        const groupSize = Math.min(3 + Math.floor(Math.random() * 5), nodeCount - currentIndex);
        const normalizedIndex = attempts / Math.max(1, Math.ceil(nodeCount / 3));
        const angle = normalizedIndex * Math.PI * 2 + Math.random() * 0.3;
        const distance = radius * (0.35 + Math.random() * 0.35);
        const groupX = centerX + Math.cos(angle) * distance;
        const groupY = centerY + Math.sin(angle) * distance;

        const group = pattern(groupSize, groupX, groupY, 60);

        group.nodes.forEach(node => {
            nodes.push({
                ...node,
                id: currentIndex++,
                activated: false,
                activationTime: null,
                silo: siloIndex,
                isManager: Math.random() < 0.15
            });
        });

        group.connections.forEach(conn => {
            connections.push({
                from: nodes.length - group.nodes.length + conn.from,
                to: nodes.length - group.nodes.length + conn.to,
                active: true,
                isDynamic: false
            });
        });

        // Very rarely connect groups (creates isolated silos)
        if (nodes.length > groupSize && Math.random() > 0.8) {
            const prevGroupNode = Math.floor(Math.random() * (nodes.length - groupSize));
            const currentGroupNode = nodes.length - groupSize + Math.floor(Math.random() * groupSize);
            connections.push({
                from: prevGroupNode,
                to: currentGroupNode,
                active: true,
                isDynamic: false
            });
        }

        siloIndex++;
        attempts++;
    }

    applyNodeSpacing(nodes, 32, 2);
    keepNodesInBounds(nodes, centerX, centerY, radius * 0.95);

    return { nodes: nodes.slice(0, nodeCount), connections, dynamicConnections: [] };
}

function createCentralHub(count, x, y, size) {
    const nodes = [{ x, y }];
    const connections = [];
    for (let i = 1; i < count; i++) {
        const angle = (i / (count - 1)) * Math.PI * 2;
        nodes.push({
            x: x + Math.cos(angle) * size,
            y: y + Math.sin(angle) * size
        });
        connections.push({ from: 0, to: i });
    }
    return { nodes, connections };
}

function createChain(count, x, y, size) {
    const nodes = [];
    const connections = [];
    const angleOffset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
        const progress = i / Math.max(1, count - 1);
        nodes.push({
            x: x + Math.cos(angleOffset) * (progress - 0.5) * size * 2,
            y: y + Math.sin(angleOffset) * (progress - 0.5) * size * 2
        });
        if (i > 0) {
            connections.push({ from: i - 1, to: i });
        }
    }
    return { nodes, connections };
}

function createHierarchy(count, x, y, size) {
    const nodes = [];
    const connections = [];
    const levels = Math.ceil(Math.log2(count + 1));
    let nodeIndex = 0;
    for (let level = 0; level < levels && nodeIndex < count; level++) {
        const nodesInLevel = Math.min(Math.pow(2, level), count - nodeIndex);
        for (let i = 0; i < nodesInLevel; i++) {
            const offsetX = (i - (nodesInLevel - 1) / 2) * (size / nodesInLevel);
            nodes.push({
                x: x + offsetX,
                y: y + (level - levels / 2) * (size / 1.5)
            });
            if (level > 0) {
                const parentIndex = Math.floor((nodeIndex - Math.pow(2, level - 1)) / 2);
                if (parentIndex >= 0 && parentIndex < nodes.length - nodesInLevel) {
                    connections.push({ from: parentIndex, to: nodeIndex });
                }
            }
            nodeIndex++;
        }
    }
    return { nodes, connections };
}

function createCluster(count, x, y, size) {
    const nodes = [];
    const connections = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * size * 0.8;
        nodes.push({
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance
        });
        if (i > 0) {
            const connectCount = Math.min(1 + Math.floor(Math.random() * 2), i);
            for (let j = 0; j < connectCount; j++) {
                const targetIndex = Math.floor(Math.random() * i);
                if (!connections.find(c =>
                    (c.from === targetIndex && c.to === i) ||
                    (c.from === i && c.to === targetIndex)
                )) {
                    connections.push({ from: targetIndex, to: i });
                }
            }
        }
    }
    return { nodes, connections };
}

function applyNodeSpacing(nodes, minDistance = 30, iterations = 3) {
    if (nodes.length === 0) return;

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                let dx = nodeB.x - nodeA.x;
                let dy = nodeB.y - nodeA.y;
                const distance = Math.hypot(dx, dy) || 0.0001;

                if (distance < minDistance) {
                    const overlap = (minDistance - distance) / 2;
                    dx /= distance;
                    dy /= distance;

                    nodeA.x -= dx * overlap;
                    nodeA.y -= dy * overlap;
                    nodeB.x += dx * overlap;
                    nodeB.y += dy * overlap;
                }
            }
        }
    }
}

function keepNodesInBounds(nodes, centerX, centerY, radius) {
    if (nodes.length === 0) return;

    nodes.forEach(node => {
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) {
            const scale = radius / distance;
            node.x = centerX + dx * scale;
            node.y = centerY + dy * scale;
        }
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Test utility helpers (temporary diagnostic harness)
function normalizeTestNetwork(rawNodes, rawConnections, options = {}) {
    const siloAssignments = options.siloAssignments || [];
    const nodes = rawNodes.map((node, idx) => ({
        x: node.x ?? 0,
        y: node.y ?? 0,
        id: idx,
        activated: false,
        activationTime: null,
        silo: siloAssignments[idx] ?? 0,
        isManager: node.isManager ?? false
    }));

    const connections = rawConnections.map(conn => ({
        from: conn.from,
        to: conn.to,
        active: conn.active !== false,
        formationTime: null
    }));

    return { nodes, connections, dynamicConnections: options.dynamicConnections || [] };
}

function buildPatternTestNetwork(patternFn, count, options = {}) {
    const { centerX = 0, centerY = 0, size = 80 } = options;
    const pattern = patternFn(count, centerX, centerY, size);
    return normalizeTestNetwork(pattern.nodes, pattern.connections, options);
}

function buildManualNetwork(nodeCount, edges, options = {}) {
    const nodes = Array.from({ length: nodeCount }, () => ({ x: 0, y: 0 }));
    return normalizeTestNetwork(nodes, edges, options);
}

function simulatePropagation(network, sourceIndex, extraConnections = []) {
    const nodeCount = network.nodes.length;
    const connections = [
        ...network.connections,
        ...((network.dynamicConnections || []).filter(conn => conn.active)),
        ...extraConnections
    ].filter(conn => conn && typeof conn.from === 'number' && typeof conn.to === 'number');

    const adjacency = Array.from({ length: nodeCount }, () => new Set());
    connections.forEach(conn => {
        adjacency[conn.from]?.add(conn.to);
        adjacency[conn.to]?.add(conn.from);
    });

    const visited = new Set([sourceIndex]);
    const queue = [sourceIndex];
    const waves = [[sourceIndex]];

    while (queue.length) {
        const levelSize = queue.length;
        const wave = [];

        for (let i = 0; i < levelSize; i++) {
            const current = queue.shift();
            if (!adjacency[current]) continue;

            adjacency[current].forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                    wave.push(neighbor);
                }
            });
        }

        if (wave.length) {
            waves.push(wave);
        }
    }

    const unreachable = [];
    for (let i = 0; i < nodeCount; i++) {
        if (!visited.has(i)) {
            unreachable.push(i);
        }
    }

    return {
        totalNodes: nodeCount,
        activatedCount: visited.size,
        waves,
        unreachable
    };
}

function formatWaveDetails(waves) {
    return waves
        .map((wave, idx) => `Tick ${idx}: [${wave.join(', ')}]`)
        .join(' \u2192 ');
}

function createParallelTestNetwork() {
    const edges = [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 0, to: 3 },
        { from: 1, to: 4 },
        { from: 2, to: 5 },
        { from: 3, to: 6 }
    ];
    return buildManualNetwork(7, edges);
}

function createDualClusterTestNetwork() {
    const edges = [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 4, to: 5 }
    ];
    return buildManualNetwork(6, edges);
}

// Visual scenario builders for deterministic animations
function createChainVisualNetwork(options = {}) {
    const count = options.count ?? 20;
    const spacing = options.spacing ?? 30;
    const amplitude = options.amplitude ?? 20;
    const nodes = [];
    for (let i = 0; i < count; i++) {
        nodes.push({
            x: 40 + i * spacing,
            y: 110 + Math.sin(i * 0.45) * amplitude
        });
    }
    const edges = nodes.slice(0, nodes.length - 1).map((_, idx) => ({ from: idx, to: idx + 1 }));
    return normalizeTestNetwork(nodes, edges);
}

function createHubVisualNetwork(options = {}) {
    const spokes = options.spokes ?? 12;
    const radius = options.radius ?? Math.max(90, spokes * 9);
    const center = { x: 180, y: 120 };
    const nodes = [center];
    const edges = [];
    for (let i = 0; i < spokes; i++) {
        const angle = (i / spokes) * Math.PI * 2;
        nodes.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        });
        edges.push({ from: 0, to: i + 1 });
    }
    return normalizeTestNetwork(nodes, edges);
}

function createParallelVisualNetwork(options = {}) {
    const level1 = options.level1 ?? 4;
    const level2Per = options.level2Per ?? 4;
    const branchRadius = options.branchRadius ?? 70;
    const nodes = [];
    const root = { x: 200, y: 40 };
    nodes.push(root);

    const level1Nodes = [];
    for (let i = 0; i < level1; i++) {
        const x = 80 + i * (320 / Math.max(1, level1 - 1));
        const y = 140 + (i % 2 === 0 ? -10 : 10);
        nodes.push({ x, y });
        level1Nodes.push(nodes.length - 1);
    }

    const edges = [];
    level1Nodes.forEach(idx => edges.push({ from: 0, to: idx }));

    level1Nodes.forEach((parentIdx, i) => {
        for (let j = 0; j < level2Per; j++) {
            const angle = (j / level2Per) * Math.PI + (i % 2 === 0 ? 0 : 0.3);
            const x = nodes[parentIdx].x + Math.cos(angle) * branchRadius;
            const y = nodes[parentIdx].y + Math.sin(angle) * branchRadius;
            nodes.push({ x, y });
            edges.push({ from: parentIdx, to: nodes.length - 1 });
        }
    });
    return normalizeTestNetwork(nodes, edges);
}

function createBridgeVisualNetwork(options = {}) {
    const clusterSize = options.clusterSize ?? 6;
    const clusterRadius = options.clusterRadius ?? 50;
    const separation = options.separation ?? 280;
    const leftCluster = [];
    const rightCluster = [];
    for (let i = 0; i < clusterSize; i++) {
        leftCluster.push({
            x: 60 + Math.cos((i / clusterSize) * Math.PI * 2) * clusterRadius,
            y: 120 + Math.sin((i / clusterSize) * Math.PI * 2) * (clusterRadius - 5)
        });
        rightCluster.push({
            x: 60 + separation + Math.cos((i / clusterSize) * Math.PI * 2) * clusterRadius,
            y: 120 + Math.sin((i / clusterSize) * Math.PI * 2) * (clusterRadius - 5)
        });
    }
    const nodes = [...leftCluster, ...rightCluster];
    const edges = [];
    for (let i = 1; i < leftCluster.length; i++) edges.push({ from: 0, to: i });
    for (let i = 1; i < rightCluster.length; i++) edges.push({ from: leftCluster.length, to: leftCluster.length + i });
    const siloAssignments = nodes.map((_, idx) => (idx < leftCluster.length ? 0 : 1));
    return normalizeTestNetwork(nodes, edges, { siloAssignments });
}

function focusArrivalHandler(viz, particle) {
    particle.blockAttempts = (particle.blockAttempts || 0) + 1;
    if (particle.blockAttempts < 3) {
        viz.scheduleRetry(particle.fromIndex, particle.targetIndex, particle.color, 1200);
        return false;
    }
    return true;
}

function trustArrivalHandler(viz, particle) {
    const neighbors = viz.getNeighbors(particle.targetIndex);
    const activeNeighbors = neighbors.filter(idx => viz.network.nodes[idx].activated).length;
    if (activeNeighbors < 2) {
        viz.scheduleRetry(particle.fromIndex, particle.targetIndex, particle.color, 1200);
        return false;
    }
    return true;
}

function verifyArrivalHandler(viz, particle) {
    if (!particle.verifyCleared) {
        particle.verifyCleared = true;
        viz.scheduleRetry(particle.fromIndex, particle.targetIndex, particle.color, 2000);
        return false;
    }
    return true;
}

function positionNetworkNodes(nodes, offsetX, offsetY) {
    if (!nodes.length) return [];
    const avgX = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
    const avgY = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
    return nodes.map(node => ({
        ...node,
        x: node.x - avgX + offsetX,
        y: node.y - avgY + offsetY
    }));
}

function generateShowcaseNetwork(centerX, centerY) {
    const randomChoice = arr => arr[Math.floor(Math.random() * arr.length)];
    const basePatterns = [
        {
            type: 'chain',
            builder: createChainVisualNetwork,
            siloOffset: 0,
            variants: [
                { count: 6, spacing: 42, amplitude: 8 },
                { count: 10, spacing: 36, amplitude: 14 },
                { count: 16, spacing: 30, amplitude: 22 }
            ],
            managerPredicate: (idx, node, total) => idx === Math.floor(total / 2)
        },
        {
            type: 'hub',
            builder: createHubVisualNetwork,
            siloOffset: 10,
            variants: [
                { spokes: 4, radius: 110 },
                { spokes: 8, radius: 140 },
                { spokes: 12, radius: 170 }
            ],
            managerPredicate: (idx) => idx === 0
        },
        {
            type: 'parallel',
            builder: createParallelVisualNetwork,
            siloOffset: 20,
            variants: [
                { level1: 3, level2Per: 3, branchRadius: 60 },
                { level1: 4, level2Per: 4, branchRadius: 75 },
                { level1: 5, level2Per: 4, branchRadius: 90 }
            ],
            managerPredicate: (idx) => idx === 0
        },
        {
            type: 'bridge',
            builder: createBridgeVisualNetwork,
            siloOffset: 30,
            variants: [
                { clusterSize: 4, clusterRadius: 40, separation: 260 },
                { clusterSize: 6, clusterRadius: 55, separation: 320 },
                { clusterSize: 8, clusterRadius: 70, separation: 360 }
            ],
            managerPredicate: null
        }
    ];

    // Ensure each archetype appears at least once, then add a couple of random extras
    const targetCount = 5 + Math.floor(Math.random() * 2); // 5-6 segments
    const selectedTypes = basePatterns.map(p => p.type);
    while (selectedTypes.length < targetCount) {
        selectedTypes.push(randomChoice(basePatterns).type);
    }
    const shuffledTypes = selectedTypes.sort(() => Math.random() - 0.5);

    const nodes = [];
    const connections = [];
    const segments = [];

    shuffledTypes.forEach((type, idx) => {
        const config = basePatterns.find(p => p.type === type);
        const variant = randomChoice(config.variants);
        const base = config.builder(variant);
        const radius = 220 + Math.random() * 140;
        const angle = (idx / shuffledTypes.length) * Math.PI * 2 + Math.random() * 0.4;
        const offsetX = centerX + Math.cos(angle) * radius;
        const offsetY = centerY + Math.sin(angle) * radius;
        const positioned = positionNetworkNodes(base.nodes, offsetX, offsetY);
        const startIndex = nodes.length;

        positioned.forEach((node, localIndex) => {
            nodes.push({
                x: node.x,
                y: node.y,
                id: startIndex + localIndex,
                activated: false,
                activationTime: null,
                silo: config.siloOffset + (node.silo ?? 0) + idx,
                isManager: config.managerPredicate
                    ? config.managerPredicate(localIndex, node, positioned.length)
                    : (node.isManager ?? (localIndex === 0))
            });
        });

        base.connections.forEach(conn => {
            connections.push({
                from: startIndex + conn.from,
                to: startIndex + conn.to,
                active: true,
                isDynamic: false
            });
        });

        segments.push({
            type,
            startIndex,
            nodeCount: positioned.length
        });
    });

    // Connect segments together to ensure the network is navigable
    for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        const next = segments[(i + 1) % segments.length];
        const fromIndex = current.startIndex + Math.floor(Math.random() * current.nodeCount);
        const toIndex = next.startIndex + Math.floor(Math.random() * next.nodeCount);
        connections.push({
            from: fromIndex,
            to: toIndex,
            active: true,
            isDynamic: false
        });
    }

    // Add a couple of random long bridges to mimic opportunistic relationships
    const extraBridges = 2;
    for (let i = 0; i < extraBridges; i++) {
        const a = segments[Math.floor(Math.random() * segments.length)];
        const b = segments[Math.floor(Math.random() * segments.length)];
        if (!a || !b || a === b) continue;
        connections.push({
            from: a.startIndex + Math.floor(Math.random() * a.nodeCount),
            to: b.startIndex + Math.floor(Math.random() * b.nodeCount),
            active: true,
            isDynamic: false
        });
    }

    return { nodes, connections, dynamicConnections: [] };
}

class MiniPropagationVisualization {
    constructor(config) {
        this.canvas = document.getElementById(config.canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.networkBuilder = config.networkBuilder;
        this.sourceIndex = config.sourceIndex ?? 0;
        this.tickInterval = config.tickInterval ?? 900;
        this.onWaveComplete = config.onWaveComplete || null;
        this.createState = config.createState || (() => ({}));
        this.state = {};
        this.queue = [];
        this.pendingActivations = new Set();
        this.particles = [];
        this.animationFrame = null;
        this.autoCycle = !!config.autoCycle;
        this.autoCyclePause = config.autoCyclePause ?? 2000;
        this.arrivalHandler = config.arrivalHandler || null;
        this.cycleTimer = null;
        this.reset();
    }

    reset(manualTrigger = false) {
        this.stop(true);
        this.network = this.networkBuilder();
        this.queue = [];
        this.pendingActivations = new Set();
        this.particles = [];
        this.wave = 0;
        this.lastTick = 0;
        this.startTime = 0;
        this.prevFrameTime = Date.now();
        this.state = this.createState();
        this.draw();
    }

    start(manualTrigger = false) {
        this.reset(true);
        if (!this.network.nodes[this.sourceIndex]) return;
        clearTimeout(this.cycleTimer);
        this.running = true;
        this.startTime = Date.now();
        this.lastTick = this.startTime - this.tickInterval;
        this.prevFrameTime = this.startTime;
        this.queue = [this.sourceIndex];
        const sourceNode = this.network.nodes[this.sourceIndex];
        sourceNode.activated = true;
        sourceNode.activationTime = 0;
        sourceNode.discoveryAnimation = true;
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    stop(manualTrigger = false) {
        this.running = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.autoCycle && !manualTrigger) {
            clearTimeout(this.cycleTimer);
            this.cycleTimer = setTimeout(() => this.start(), this.autoCyclePause);
        }
    }

    getNeighbors(index) {
        const neighbors = [];
        const allConnections = [
            ...this.network.connections,
            ...((this.network.dynamicConnections || []).filter(conn => conn.active))
        ];
        allConnections.forEach(conn => {
            if (conn.from === index) neighbors.push(conn.to);
            else if (conn.to === index) neighbors.push(conn.from);
        });
        return neighbors;
    }

    addDynamicConnection(from, to) {
        if (!this.network.dynamicConnections) {
            this.network.dynamicConnections = [];
        }
        this.network.dynamicConnections.push({
            from,
            to,
            active: true,
            formationTime: Date.now(),
            lifetime: Infinity
        });
    }

    launchParticle(fromIndex, toIndex, color = colors.particle) {
        const from = this.network.nodes[fromIndex];
        const to = this.network.nodes[toIndex];
        if (!from || !to) return;
        if (this.network.nodes[toIndex].activated || this.pendingActivations.has(toIndex)) return;

        this.pendingActivations.add(toIndex);
        this.particles.push({
            originX: from.x,
            originY: from.y,
            x: from.x,
            y: from.y,
            targetX: to.x,
            targetY: to.y,
            targetIndex: toIndex,
            fromIndex,
            progress: 0,
            startTime: Date.now(),
            duration: 1500,
            size: 5,
            trail: [],
            color
        });
    }

    updateParticles() {
        if (!this.particles.length) return;
        this.particles = this.particles.filter(particle => {
            const now = Date.now();
            const linearProgress = Math.min((now - particle.startTime) / particle.duration, 1);
            particle.progress = 1 - Math.pow(1 - linearProgress, 3);

            const prevX = particle.x;
            const prevY = particle.y;

            particle.x = particle.originX + (particle.targetX - particle.originX) * particle.progress;
            particle.y = particle.originY + (particle.targetY - particle.originY) * particle.progress;

            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 6) particle.trail.shift();

            if (linearProgress >= 1) {
                if (this.arrivalHandler) {
                    const allow = this.arrivalHandler(this, particle);
                    if (!allow) {
                        this.pendingActivations.delete(particle.targetIndex);
                        return false;
                    }
                }

                const targetNode = this.network.nodes[particle.targetIndex];
                if (!targetNode.activated) {
                    targetNode.activated = true;
                    targetNode.activationTime = Date.now() - this.startTime;
                }
                this.pendingActivations.delete(particle.targetIndex);
                this.queue.push(particle.targetIndex);
                return false;
            }

            return true;
        });
    }

    animate() {
        const now = Date.now();
        this.prevFrameTime = now;

        if (this.running) {
            this.updateParticles();

            if (now - this.lastTick >= this.tickInterval) {
                this.processWave();
                this.lastTick = now;
            }
        }

        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    scheduleRetry(fromIndex, toIndex, color, delay = 1200) {
        setTimeout(() => {
            this.launchParticle(fromIndex, toIndex, color);
        }, delay);
    }

    processWave() {
        if (this.queue.length === 0) {
            if (this.pendingActivations.size === 0 && this.particles.length === 0) {
                this.stop();
            }
            return;
        }

        const currentWave = Array.from(new Set(this.queue));
        this.queue = [];

        currentWave.forEach(nodeIndex => {
            const node = this.network.nodes[nodeIndex];
            if (!node.activated) {
                node.activated = true;
                node.activationTime = Date.now() - this.startTime;
            }
            this.getNeighbors(nodeIndex).forEach(neighbor => {
                this.launchParticle(nodeIndex, neighbor);
            });
        });

        this.wave += 1;

        if (this.onWaveComplete) {
            this.onWaveComplete(this, { wave: this.wave, processed: currentWave });
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        drawNetwork(this.ctx, this.network, this.sourceIndex, true, Date.now());
        drawParticles(this.ctx, this.particles);
    }
}

function setupVisualTestScenarios() {
    const scenarios = [
        {
            canvasId: 'viz-chain',
            startBtn: 'btn-chain-start',
            resetBtn: 'btn-chain-reset',
            networkBuilder: createChainVisualNetwork,
            sourceIndex: 0,
            autoCycle: true
        },
        {
            canvasId: 'viz-hub-spoke',
            startBtn: 'btn-hub-spoke-start',
            resetBtn: 'btn-hub-spoke-reset',
            networkBuilder: createHubVisualNetwork,
            sourceIndex: 2,
            autoCycle: true
        },
        {
            canvasId: 'viz-hub-center',
            startBtn: 'btn-hub-center-start',
            resetBtn: 'btn-hub-center-reset',
            networkBuilder: createHubVisualNetwork,
            sourceIndex: 0,
            autoCycle: true
        },
        {
            canvasId: 'viz-parallel',
            startBtn: 'btn-parallel-start',
            resetBtn: 'btn-parallel-reset',
            networkBuilder: createParallelVisualNetwork,
            sourceIndex: 0,
            autoCycle: true
        },
        {
            canvasId: 'viz-bridge',
            startBtn: 'btn-bridge-start',
            resetBtn: 'btn-bridge-reset',
            networkBuilder: createBridgeVisualNetwork,
            sourceIndex: 0,
            createState: () => ({ bridgeAdded: false }),
            onWaveComplete: (viz) => {
                if (!viz.state.bridgeAdded && viz.wave >= 2) {
                    viz.state.bridgeAdded = true;
                    viz.addDynamicConnection(2, 3);
                    viz.launchParticle(2, 3, colors.dynamicConnection);
                }
            },
            autoCycle: true
        },
        {
            canvasId: 'viz-focus',
            startBtn: 'btn-focus-start',
            resetBtn: 'btn-focus-reset',
            networkBuilder: () => createChainVisualNetwork({ count: 8, spacing: 36, amplitude: 12 }),
            sourceIndex: 0,
            arrivalHandler: focusArrivalHandler,
            autoCycle: true
        },
        {
            canvasId: 'viz-trust',
            startBtn: 'btn-trust-start',
            resetBtn: 'btn-trust-reset',
            networkBuilder: () => createHubVisualNetwork({ spokes: 6, radius: 120 }),
            sourceIndex: 0,
            arrivalHandler: trustArrivalHandler,
            autoCycle: true
        },
        {
            canvasId: 'viz-verify',
            startBtn: 'btn-verify-start',
            resetBtn: 'btn-verify-reset',
            networkBuilder: () => createBridgeVisualNetwork({ clusterSize: 4, separation: 240 }),
            sourceIndex: 0,
            arrivalHandler: verifyArrivalHandler,
            autoCycle: true
        }
    ];

    scenarios.forEach(config => {
        const viz = new MiniPropagationVisualization(config);
        document.getElementById(config.startBtn)?.addEventListener('click', () => viz.start(true));
        document.getElementById(config.resetBtn)?.addEventListener('click', () => viz.reset(true));
        if (config.autoCycle) {
            requestAnimationFrame(() => viz.start());
        }
    });
}

// Drawing utilities
const colors = {
    connection: '#E5E7EB',
    dynamicConnection: '#F59E0B',
    inactive: '#D1D5DB',
    active: '#7CB342',
    insight: '#F59E0B',
    particle: '#7CB342',
    particleTrail: 'rgba(124, 179, 66, 0.3)',
    natura: '#3B82F6',
    naturaConnection: '#3B82F6'
};

const blockerColors = {
    focus: 'rgba(251, 191, 36, 0.85)',
    trust: 'rgba(147, 51, 234, 0.85)',
    verify: 'rgba(59, 130, 246, 0.85)'
};

function drawNetwork(ctx, network, sourceNodeId, hasInsight, currentTime) {
    const { nodes, connections, dynamicConnections } = network;

    // Draw all connections
    const allConnections = [...connections];
    if (dynamicConnections) {
        allConnections.push(...dynamicConnections.filter(c => c.active));
    }

    allConnections.forEach(conn => {
        const from = nodes[conn.from];
        const to = nodes[conn.to];
        if (!from || !to) return;

        const isDynamic = dynamicConnections && dynamicConnections.includes(conn);

        ctx.strokeStyle = isDynamic ? colors.dynamicConnection : colors.connection;
        ctx.globalAlpha = 1;
        ctx.lineWidth = isDynamic ? 3 : 2;

        if (isDynamic) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Draw nodes
    nodes.forEach((node, index) => {
        let radius = 10;
        let extraGlow = 0;

        // Insight node animation (only if insight has appeared)
        if (index === sourceNodeId && hasInsight) {
            const pulseProgress = (currentTime % 1000) / 1000;
            const pulse = Math.sin(pulseProgress * Math.PI * 4) * 3;
            radius = 14 + pulse;
            extraGlow = Math.sin(pulseProgress * Math.PI * 2) * 8;
        }

        if (node.isManager && index !== sourceNodeId) {
            radius = 12;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        if (index === sourceNodeId && hasInsight) {
            ctx.fillStyle = colors.insight;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
            ctx.shadowBlur = 12 + extraGlow;
        } else if (node.activated) {
            ctx.fillStyle = colors.active;
            ctx.shadowColor = 'rgba(124, 179, 66, 0.3)';
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = colors.inactive;
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        if (!node.activated && node.blocker && !node.blockerResolved) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = blockerColors[node.blocker] || '#F97316';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Outer ring for activated nodes
        if (node.activated && index !== sourceNodeId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = colors.active;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Manager indicator
        if (node.isManager && !node.activated && index !== sourceNodeId && !hasInsight) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#6B7280';
            ctx.fill();
        }
    });
}

function drawParticles(ctx, particles) {
    particles.forEach(particle => {
        // Trail
        if (particle.trail && particle.trail.length > 1) {
            ctx.strokeStyle = colors.particleTrail;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
            particle.trail.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }

        // Particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color || colors.particle;
        ctx.shadowColor = particle.color === colors.natura ? 'rgba(59, 130, 246, 0.5)' : 'rgba(124, 179, 66, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function drawNYQSTNatura(ctx, x, y, size, currentTime, active = false) {
    const pulseProgress = (currentTime % 2000) / 2000;
    const pulse = Math.sin(pulseProgress * Math.PI * 2) * 4;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, size + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = colors.natura;
    ctx.lineWidth = 3;
    ctx.globalAlpha = active ? 1 : 0.5;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Inner core
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = colors.natura;
    ctx.shadowColor = active ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)';
    ctx.shadowBlur = active ? 20 : 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rotating indicator
    if (active) {
        const rotation = (currentTime / 50) % 360;
        for (let i = 0; i < 3; i++) {
            const angle = (rotation + i * 120) * Math.PI / 180;
            const dotX = x + Math.cos(angle) * size;
            const dotY = y + Math.sin(angle) * size;

            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = colors.natura;
            ctx.fill();
        }
    }
}

function drawNYQSTNaturaConnection(ctx, fromX, fromY, toX, toY, progress) {
    if (progress <= 0) return;

    const currentX = fromX + (toX - fromX) * Math.min(progress, 1);
    const currentY = fromY + (toY - fromY) * Math.min(progress, 1);

    ctx.strokeStyle = colors.naturaConnection;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([8, 4]);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
}

// Main Visualization Class - COMPLETELY REWRITTEN PROPAGATION
class InsightPropagationVisualization {
    constructor(canvasNatural, canvasInstant) {
        this.canvasNatural = canvasNatural;
        this.canvasInstant = canvasInstant;
        this.ctxNatural = canvasNatural.getContext('2d');
        this.ctxInstant = canvasInstant.getContext('2d');

        this.setupCanvas();
        this.metricsEl = {
            natural: document.getElementById('metric-natural'),
            instant: document.getElementById('metric-instant'),
            delta: document.getElementById('metric-delta'),
            avgNatural: document.getElementById('metric-avg-natural'),
            avgInstant: document.getElementById('metric-avg-instant'),
            time: document.getElementById('metric-time')
        };
        this.blockerEls = {
            focus: document.getElementById('blocker-focus-list'),
            trust: document.getElementById('blocker-trust-list'),
            verify: document.getElementById('blocker-verify-list')
        };
        this.reset();
    }

    setupCanvas() {
        [this.ctxNatural, this.ctxInstant].forEach(ctx => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        });
    }

    reset() {
        const width = this.canvasNatural.width;
        const height = this.canvasNatural.height;

        // Generate deterministic showcase network so combined view matches proofs
        this.networkNatural = generateShowcaseNetwork(width / 2, height / 2 - 20);
        this.networkNatural.dynamicConnections = [];
        this.networkInstant = JSON.parse(JSON.stringify(this.networkNatural));
        this.networkInstant.dynamicConnections = [];

        // Pick source node
        this.sourceNode = Math.floor(Math.random() * this.networkNatural.nodes.length);
        this.assignNaturalBlockers();

        // State
        this.animating = false;
        this.startTime = null;
        this.insightAppearTime = null;
        this.hasInsightAppeared = false;

        // Natural propagation state
        this.particlesNatural = [];
        this.lastDynamicConnectionTime = 0;
        this.lastManagerPropagationTime = 0;

        // Instant propagation state
        this.particlesInstant = [];
        this.naturaConnectionProgress = 0;
        this.naturaActivated = false;
        this.instantBroadcastStarted = false;

        // NYQST Natura position
        this.naturaX = width / 2;
        this.naturaY = height - 40;

        this.globalNaturalOutput = 0;
        this.globalInstantOutput = 0;
        this.networkNatural.nodes.forEach(node => {
            node.outputCounter = 0;
            node.outputRateInactive = 1 + Math.random() * 0.5;
            node.outputRateActive = node.outputRateInactive * 2;
        });
        this.networkInstant.nodes.forEach(node => {
            node.outputCounter = 0;
            node.outputRateInactive = 1 + Math.random() * 0.5;
            node.outputRateActive = node.outputRateInactive * 2;
        });

        this.metricTickCounter = 0;
        this.updateMetrics(0);
        this.updateBlockerCards();

        this.draw();
    }

    assignNaturalBlockers() {
        const blockerWeights = [
            { type: 'focus', threshold: 0.35 },
            { type: 'trust', threshold: 0.55 },
            { type: 'verify', threshold: 0.7 }
        ];

        this.networkNatural.nodes.forEach((node, index) => {
            node.blocker = null;
            node.blockerResolved = true;
            node.blockerHits = 0;
            node.blockerResolveTime = null;
            node.blockerNextAttempt = 0;
            if (index === this.sourceNode) return;

            const roll = Math.random();
            const match = blockerWeights.find(weight => roll < weight.threshold);
            if (match) {
                node.blocker = match.type;
                node.blockerResolved = false;
            }
        });
    }

    start() {
        if (this.animating) return;

        this.animating = true;
        this.startTime = Date.now();
        this.insightAppearTime = this.startTime + 2000; // Insight appears after 2 seconds
        this.lastDynamicConnectionTime = this.startTime;
        this.lastManagerPropagationTime = this.startTime;

        this.animate();
    }

    // Find all nodes directly connected to a given node
    getConnectedNodes(nodeIndex) {
        const connected = new Set(); // Use Set to avoid duplicates
        const allConnections = [
            ...this.networkNatural.connections,
            ...this.networkNatural.dynamicConnections.filter(c => c.active)
        ];

        allConnections.forEach(conn => {
            if (conn.from === nodeIndex) {
                connected.add(conn.to);
            } else if (conn.to === nodeIndex) {
                connected.add(conn.from);
            }
        });

        return Array.from(connected);
    }

    canReceiveInsight(nodeIndex) {
        const node = this.networkNatural.nodes[nodeIndex];
        if (!node) return false;
        if (node.activated) return false;
        if (!node.blocker || node.blockerResolved) return true;
        const nextWindow = node.blockerNextAttempt || 0;
        return Date.now() >= nextWindow;
    }

    applyBlockerOnArrival(nodeIndex) {
        const node = this.networkNatural.nodes[nodeIndex];
        if (!node || !node.blocker || node.blockerResolved) return false;

        const now = Date.now();
        if (node.blocker === 'focus') {
            if (!node.blockerResolveTime) {
                node.blockerResolveTime = now + 3500 + Math.random() * 2500; // waiting for attention
            }
            if (now >= node.blockerResolveTime) {
                node.blockerResolved = true;
                return false;
            }
            node.blockerNextAttempt = node.blockerResolveTime;
            return true;
        }

        if (node.blocker === 'trust') {
            node.blockerHits = (node.blockerHits || 0) + 1;
            if (node.blockerHits >= 3) {
                node.blockerResolved = true;
                return false;
            }
            node.blockerNextAttempt = now + 1200; // wait for another confirmation
            return true;
        }

        if (node.blocker === 'verify') {
            if (!node.blockerResolveTime) {
                node.blockerResolveTime = now + 4200 + Math.random() * 3000; // validation cycle
            }
            if (now >= node.blockerResolveTime) {
                node.blockerResolved = true;
                return false;
            }
            node.blockerNextAttempt = node.blockerResolveTime;
            return true;
        }

        return false;
    }

    // Create a particle from one node to another
    createParticle(fromIndex, toIndex) {
        const from = this.networkNatural.nodes[fromIndex];
        const to = this.networkNatural.nodes[toIndex];

        // Only create particle if:
        // 1. Source is green (activated)
        // 2. Target is not green yet
        // 3. No particle already heading there
        if (!from.activated) {
            return; // Source must be green
        }
        if (to.activated || !this.canReceiveInsight(toIndex)) {
            return; // Target already green
        }

        const alreadyGoing = this.particlesNatural.some(p => p.targetIndex === toIndex);
        if (alreadyGoing) {
            return; // Particle already heading there
        }

        this.particlesNatural.push({
            originX: from.x,
            originY: from.y,
            x: from.x,
            y: from.y,
            targetX: to.x,
            targetY: to.y,
            targetIndex: toIndex,
            progress: 0,
            startTime: Date.now(),
            duration: 5200,
            size: 5,
            trail: [],
            color: colors.particle
        });
    }

    ensurePropagationFromActiveNodes() {
        const nodes = this.networkNatural.nodes;
        const allConnections = [
            ...this.networkNatural.connections,
            ...this.networkNatural.dynamicConnections.filter(c => c.active)
        ];

        allConnections.forEach(conn => {
            const from = nodes[conn.from];
            const to = nodes[conn.to];

            if (from.activated && !to.activated) {
                this.createParticle(conn.from, conn.to);
            } else if (to.activated && !from.activated) {
                this.createParticle(conn.to, conn.from);
            }
        });
    }

    // When insight first appears, spread to immediate neighbors
    initiateSpread() {
        // FIRST: Mark source node as activated (green) - it has the insight!
        const sourceNode = this.networkNatural.nodes[this.sourceNode];
        sourceNode.activated = true;
        sourceNode.blockerResolved = true;

        // THEN: Get all nodes connected to source
        const neighbors = this.getConnectedNodes(this.sourceNode);
        console.log(`Source ${this.sourceNode} activated with ${neighbors.length} neighbors`);

        // NOW: Create particles to each neighbor (source is green now)
        neighbors.forEach(neighborIndex => {
            this.createParticle(this.sourceNode, neighborIndex);
        });
    }

    createDynamicConnection() {
        const nodes = this.networkNatural.nodes;

        // Find activated (green) nodes
        const greenNodes = [];
        nodes.forEach((node, index) => {
            if (node.activated) greenNodes.push(index);
        });

        // Find non-activated nodes
        const grayNodes = [];
        nodes.forEach((node, index) => {
            if (!node.activated) grayNodes.push(index);
        });

        if (greenNodes.length === 0 || grayNodes.length === 0) return;

        const fromIndex = greenNodes[Math.floor(Math.random() * greenNodes.length)];
        const toIndex = grayNodes[Math.floor(Math.random() * grayNodes.length)];

        const fromNode = nodes[fromIndex];
        const toNode = nodes[toIndex];

        // Only create connection between different silos
        if (fromNode.silo !== toNode.silo) {
            const newConn = {
                from: fromIndex,
                to: toIndex,
                active: true,
                isDynamic: true,
                formationTime: Date.now(),
                lifetime: 4000 + Math.random() * 3000
            };

            this.networkNatural.dynamicConnections.push(newConn);

            // Immediately create particle along this connection
            this.createParticle(fromIndex, toIndex);
        }
    }

    managerPropagation() {
        const nodes = this.networkNatural.nodes;

        // Find green managers
        const greenManagers = [];
        nodes.forEach((node, index) => {
            if (node.isManager && node.activated) {
                greenManagers.push(index);
            }
        });

        // Find gray managers in different silos
        const grayManagers = [];
        nodes.forEach((node, index) => {
            if (node.isManager && !node.activated) {
                grayManagers.push(index);
            }
        });

        if (greenManagers.length > 0 && grayManagers.length > 0) {
            const from = greenManagers[Math.floor(Math.random() * greenManagers.length)];
            const to = grayManagers[Math.floor(Math.random() * grayManagers.length)];

            const fromNode = nodes[from];
            const toNode = nodes[to];

            // Only connect managers from different silos
            if (fromNode.silo !== toNode.silo) {
                // Create a temporary connection (like dynamic connections)
                const managerConn = {
                    from: from,
                    to: to,
                    active: true,
                    isDynamic: true,
                    formationTime: Date.now(),
                    lifetime: 5000 // Manager connections last longer
                };

                this.networkNatural.dynamicConnections.push(managerConn);

                // Create particle along this new connection
                this.createParticle(from, to);
            }
        }
    }

    animate() {
        if (!this.animating) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.startTime;

        // Check if insight should appear
        if (!this.hasInsightAppeared && currentTime >= this.insightAppearTime) {
            this.hasInsightAppeared = true;
            this.initiateSpread();
            this.naturaConnectionProgress = 0;
        }

        // ===== NATURAL SIDE =====
        if (this.hasInsightAppeared) {
            // Dynamic connections
            if (currentTime - this.lastDynamicConnectionTime > 5000) {
                this.createDynamicConnection();
                this.lastDynamicConnectionTime = currentTime;
            }

            // Remove expired dynamic connections
            this.networkNatural.dynamicConnections = this.networkNatural.dynamicConnections.filter(conn => {
                return !(conn.formationTime && currentTime - conn.formationTime > conn.lifetime);
            });

            // Manager propagation
            if (currentTime - this.lastManagerPropagationTime > 7000) {
                this.managerPropagation();
                this.lastManagerPropagationTime = currentTime;
            }

            // Update particles
            this.updateNaturalParticles();

            // Ensure any active connection keeps attempting to propagate
            this.ensurePropagationFromActiveNodes();
        }

        // ===== INSTANT SIDE =====
        if (this.hasInsightAppeared) {
            // Animate connection line from insight to NYQST Natura
            if (this.naturaConnectionProgress < 1) {
                this.naturaConnectionProgress += 0.009;

                // Create particle traveling to NYQST Natura
                if (this.naturaConnectionProgress > 0.05 && this.particlesInstant.length === 0) {
                    const sourceNode = this.networkInstant.nodes[this.sourceNode];
                    this.particlesInstant.push({
                        originX: sourceNode.x,
                        originY: sourceNode.y,
                        x: sourceNode.x,
                        y: sourceNode.y,
                        targetX: this.naturaX,
                        targetY: this.naturaY,
                        targetIndex: -1, // NYQST Natura
                        progress: 0,
                        startTime: Date.now(),
                        duration: 4200,
                        size: 6,
                        trail: [],
                        color: colors.natura
                    });
                }
            } else if (!this.naturaActivated) {
                // NYQST Natura received the insight
                this.naturaActivated = true;
            }

            // Start broadcast after NYQST Natura activation
            if (this.naturaActivated && !this.instantBroadcastStarted) {
                const timeSinceActivation = elapsed - (this.insightAppearTime - this.startTime + 2000);
                if (timeSinceActivation > 500) {
                    this.instantBroadcastStarted = true;
                    this.startInstantBroadcast();
                }
            }

            // Update instant particles
            this.updateInstantParticles();
        }

        this.draw();
        this.tickProductivity(elapsed);
        this.updateBlockerCards();

        if (this.animating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    startInstantBroadcast() {
        const nodes = this.networkInstant.nodes;

        nodes.forEach((node, index) => {
            if (index !== this.sourceNode) {
                this.particlesInstant.push({
                    originX: this.naturaX,
                    originY: this.naturaY,
                    x: this.naturaX,
                    y: this.naturaY,
                    targetX: node.x,
                    targetY: node.y,
                    targetIndex: index,
                    progress: 0,
                    startTime: Date.now(),
                    duration: 4200,
                    size: 5,
                    trail: [],
                    color: colors.particle
                });
            }
        });
    }

    updateNaturalParticles() {
        // Process each particle
        this.particlesNatural = this.particlesNatural.filter(particle => {
            const now = Date.now();
            const linearProgress = Math.min((now - particle.startTime) / particle.duration, 1);
            particle.progress = 1 - Math.pow(1 - linearProgress, 3); // ease-out

            const prevX = particle.x;
            const prevY = particle.y;
            particle.x = particle.originX + (particle.targetX - particle.originX) * particle.progress;
            particle.y = particle.originY + (particle.targetY - particle.originY) * particle.progress;

            // Update trail
            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 10) particle.trail.shift();

            if (linearProgress >= 1) {
                if (this.applyBlockerOnArrival(particle.targetIndex)) {
                    return false;
                }

                const targetNode = this.networkNatural.nodes[particle.targetIndex];

                if (!targetNode.activated) {
                    targetNode.activated = true;
                    targetNode.activationTime = Date.now() - this.startTime;
                    targetNode.blockerResolved = true;

                    const neighbors = this.getConnectedNodes(particle.targetIndex);
                    neighbors.forEach(neighborIndex => {
                        this.createParticle(particle.targetIndex, neighborIndex);
                    });
                }

                return false;
            }

            return true; // Keep this particle
        });
    }

    updateInstantParticles() {
        this.particlesInstant = this.particlesInstant.filter(particle => {
            const now = Date.now();
            const linearProgress = Math.min((now - particle.startTime) / particle.duration, 1);
            particle.progress = 1 - Math.pow(1 - linearProgress, 3);

            const prevX = particle.x;
            const prevY = particle.y;

            particle.x = particle.originX + (particle.targetX - particle.originX) * particle.progress;
            particle.y = particle.originY + (particle.targetY - particle.originY) * particle.progress;

            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 8) particle.trail.shift();

            if (linearProgress >= 1) {
                if (particle.targetIndex >= 0) {
                    this.networkInstant.nodes[particle.targetIndex].activated = true;
                }
                return false;
            }

            return true;
        });
    }

    draw() {
        const currentTime = Date.now();

        this.ctxNatural.clearRect(0, 0, this.canvasNatural.width, this.canvasNatural.height);
        this.ctxInstant.clearRect(0, 0, this.canvasInstant.width, this.canvasInstant.height);

        // Draw natural side
        drawNetwork(this.ctxNatural, this.networkNatural, this.sourceNode, this.hasInsightAppeared, currentTime);
        drawParticles(this.ctxNatural, this.particlesNatural);

        // Draw instant side
        drawNetwork(this.ctxInstant, this.networkInstant, this.sourceNode, this.hasInsightAppeared, currentTime);
        drawNYQSTNatura(this.ctxInstant, this.naturaX, this.naturaY, 30, currentTime, this.naturaActivated);

        // Draw connection line from insight to NYQST Natura
        if (this.hasInsightAppeared && this.naturaConnectionProgress > 0) {
            const sourceNode = this.networkInstant.nodes[this.sourceNode];
            drawNYQSTNaturaConnection(
                this.ctxInstant,
                sourceNode.x,
                sourceNode.y,
                this.naturaX,
                this.naturaY,
                this.naturaConnectionProgress
            );
        }

        drawParticles(this.ctxInstant, this.particlesInstant);
    }

    tickProductivity(elapsed) {
        const deltaSeconds = 0.016;
        this.metricTickCounter = (this.metricTickCounter || 0) + 1;
        this.networkNatural.nodes.forEach(node => {
            const rate = node.activated ? node.outputRateActive : node.outputRateInactive;
            node.outputCounter += rate * deltaSeconds;
        });
        this.networkInstant.nodes.forEach(node => {
            const rate = node.activated ? node.outputRateActive : node.outputRateInactive;
            node.outputCounter += rate * deltaSeconds;
        });

        this.globalNaturalOutput = this.networkNatural.nodes.reduce((sum, node) => sum + node.outputCounter, 0);
        this.globalInstantOutput = this.networkInstant.nodes.reduce((sum, node) => sum + node.outputCounter, 0);

        if (this.metricTickCounter % 10 === 0) {
            this.updateMetrics(elapsed);
        }
    }

    updateMetrics(elapsed) {
        if (!this.metricsEl) return;
        if (this.metricsEl.natural) {
            this.metricsEl.natural.textContent = Math.round(this.globalNaturalOutput).toString();
        }
        if (this.metricsEl.instant) {
            this.metricsEl.instant.textContent = Math.round(this.globalInstantOutput).toString();
        }
        if (this.metricsEl.delta) {
            this.metricsEl.delta.textContent = Math.round(this.globalInstantOutput - this.globalNaturalOutput).toString();
        }
        if (this.metricsEl.avgNatural) {
            this.metricsEl.avgNatural.textContent = Math.round(this.globalNaturalOutput / Math.max(1, this.cycleCount || 1)).toString();
        }
        if (this.metricsEl.avgInstant) {
            this.metricsEl.avgInstant.textContent = Math.round(this.globalInstantOutput / Math.max(1, this.cycleCount || 1)).toString();
        }
        if (this.metricsEl.time) {
            const cycle = Math.max(0, Math.floor(elapsed / 1500));
            this.cycleCount = cycle + 1;
            this.metricsEl.time.textContent = `Cycle ${cycle + 1}`;
        }
    }

    updateBlockerCards() {
        if (!this.blockerEls) return;
        const lists = {
            focus: [],
            trust: [],
            verify: []
        };
        this.networkNatural.nodes.forEach((node, idx) => {
            if (node.blocker && !node.blockerResolved) {
                const label = `#${idx}`;
                lists[node.blocker].push(label);
            }
        });

        Object.entries(lists).forEach(([type, nodes]) => {
            const container = this.blockerEls[type];
            if (!container) return;
            container.innerHTML = '';
            if (nodes.length === 0) {
                const badge = document.createElement('span');
                badge.className = 'blocker-node empty';
                badge.textContent = 'Clear';
                container.appendChild(badge);
            } else {
                nodes.forEach(label => {
                    const badge = document.createElement('span');
                    badge.className = 'blocker-node';
                    badge.textContent = label;
                    container.appendChild(badge);
                });
            }
        });
    }
}

// Initialize
const viz = new InsightPropagationVisualization(
    document.getElementById('canvas-natural'),
    document.getElementById('canvas-instant')
);

document.getElementById('btn-start').addEventListener('click', () => viz.start());
document.getElementById('btn-reset').addEventListener('click', () => viz.reset());

setupVisualTestScenarios();

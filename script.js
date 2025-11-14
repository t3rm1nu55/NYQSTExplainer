// Network generation utilities with silos
function generateOrganicNetwork(nodeCount, centerX, centerY, radius) {
    const nodes = [];
    const connections = [];
    const silos = []; // Track which nodes belong to which silo

    // Create different organizational patterns
    const patterns = [
        createCentralHub,
        createChain,
        createHierarchy,
        createCluster
    ];

    let currentIndex = 0;
    let siloIndex = 0;
    let attempts = 0;
    const maxAttempts = 50;

    while (currentIndex < nodeCount && attempts < maxAttempts) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const groupSize = Math.min(3 + Math.floor(Math.random() * 5), nodeCount - currentIndex);
        const angle = (currentIndex / nodeCount) * Math.PI * 2;
        const distance = radius * (0.3 + Math.random() * 0.5);
        const groupX = centerX + Math.cos(angle) * distance;
        const groupY = centerY + Math.sin(angle) * distance;

        const group = pattern(groupSize, groupX, groupY, 60);

        // Add nodes with IDs and silo membership
        group.nodes.forEach(node => {
            nodes.push({
                ...node,
                id: currentIndex++,
                activated: false,
                activationTime: null,
                silo: siloIndex,
                isManager: Math.random() < 0.15 // 15% chance to be a manager node
            });
        });

        // Add connections within group
        group.connections.forEach(conn => {
            connections.push({
                from: nodes.length - group.nodes.length + conn.from,
                to: nodes.length - group.nodes.length + conn.to,
                active: true,
                formationTime: null
            });
        });

        // Rarely connect groups (create silos)
        if (nodes.length > groupSize && Math.random() > 0.75) { // Reduced from 0.6 to create more silos
            const prevGroupNode = Math.floor(Math.random() * (nodes.length - groupSize));
            const currentGroupNode = nodes.length - groupSize + Math.floor(Math.random() * groupSize);
            connections.push({
                from: prevGroupNode,
                to: currentGroupNode,
                active: true,
                formationTime: null
            });
        }

        siloIndex++;
        attempts++;
    }

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

        // Connect to 1-2 random nearby nodes
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

// Drawing utilities
function drawNetwork(ctx, network, colors, sourceNodeId = null, currentTime = 0) {
    const { nodes, connections, dynamicConnections } = network;

    // Draw all connections (static + dynamic)
    const allConnections = [...connections];
    if (dynamicConnections) {
        allConnections.push(...dynamicConnections.filter(c => c.active));
    }

    allConnections.forEach(conn => {
        const from = nodes[conn.from];
        const to = nodes[conn.to];
        if (!from || !to) return;

        // Check if this is a newly formed connection
        const isDynamic = dynamicConnections && dynamicConnections.includes(conn);
        let opacity = 1;

        if (isDynamic && conn.formationTime !== null) {
            const age = currentTime - conn.formationTime;
            opacity = Math.min(age / 500, 1); // Fade in over 500ms
        }

        ctx.strokeStyle = isDynamic ? colors.dynamicConnection : colors.connection;
        ctx.globalAlpha = opacity;
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
        // Insight discovery animation (bouncing/pulsing)
        let radius = 10;
        let extraGlow = 0;

        if (index === sourceNodeId && node.discoveryAnimation) {
            const pulseProgress = (currentTime % 1000) / 1000;
            const pulse = Math.sin(pulseProgress * Math.PI * 4) * 3;
            radius = 14 + pulse;
            extraGlow = Math.sin(pulseProgress * Math.PI * 2) * 8;
        } else if (index === sourceNodeId) {
            radius = 14;
        }

        // Manager nodes are slightly larger
        if (node.isManager && index !== sourceNodeId) {
            radius = 12;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        if (index === sourceNodeId) {
            ctx.fillStyle = colors.source;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
            ctx.shadowBlur = 12 + extraGlow;
        } else if (node.activated) {
            const progress = node.activationProgress || 1;
            ctx.fillStyle = colors.active;
            ctx.shadowColor = `rgba(124, 179, 66, ${0.3 * progress})`;
            ctx.shadowBlur = 10 * progress;
        } else {
            ctx.fillStyle = colors.inactive;
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        // Outer ring for activated nodes
        if (node.activated && index !== sourceNodeId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = colors.active;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Manager indicator (small dot inside)
        if (node.isManager && !node.activated && index !== sourceNodeId) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#6B7280';
            ctx.fill();
        }
    });
}

function drawParticles(ctx, particles, colors) {
    particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = colors.particle;
        ctx.shadowColor = 'rgba(124, 179, 66, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Trail effect
        if (particle.trail && particle.trail.length > 0) {
            ctx.strokeStyle = colors.particleTrail;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
            particle.trail.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }
    });
}

function drawSystemHub(ctx, x, y, size, currentTime, colors) {
    // Central hub representing the system
    const pulseProgress = (currentTime % 2000) / 2000;
    const pulse = Math.sin(pulseProgress * Math.PI * 2) * 4;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, size + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = colors.system;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner hub
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = colors.system;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rotating indicator
    const rotation = (currentTime / 50) % 360;
    for (let i = 0; i < 3; i++) {
        const angle = (rotation + i * 120) * Math.PI / 180;
        const dotX = x + Math.cos(angle) * size;
        const dotY = y + Math.sin(angle) * size;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = colors.system;
        ctx.fill();
    }
}

// Color scheme
const colors = {
    connection: '#E5E7EB',
    dynamicConnection: '#F59E0B',
    inactive: '#D1D5DB',
    active: '#7CB342',
    source: '#F59E0B',
    particle: '#7CB342',
    particleTrail: 'rgba(124, 179, 66, 0.3)',
    system: '#3B82F6'
};

// Visualization 1: Side-by-Side Comparison
class ComparisonVisualization {
    constructor(canvasNatural, canvasInstant) {
        this.canvasNatural = canvasNatural;
        this.canvasInstant = canvasInstant;
        this.ctxNatural = canvasNatural.getContext('2d');
        this.ctxInstant = canvasInstant.getContext('2d');

        this.setupCanvas();
        this.reset();
    }

    setupCanvas() {
        const setupCtx = (ctx) => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        setupCtx(this.ctxNatural);
        setupCtx(this.ctxInstant);
    }

    reset() {
        const width = this.canvasNatural.width;
        const height = this.canvasNatural.height;

        this.networkNatural = generateOrganicNetwork(35, width / 2, height / 2, 220);
        this.networkNatural.dynamicConnections = [];
        this.networkInstant = JSON.parse(JSON.stringify(this.networkNatural));
        this.networkInstant.dynamicConnections = [];

        this.sourceNode = Math.floor(Math.random() * this.networkNatural.nodes.length);
        this.animating = false;
        this.startTime = null;
        this.lastDynamicConnectionTime = 0;
        this.lastManagerPropagationTime = 0;

        this.draw();
    }

    start() {
        if (this.animating) return;

        this.animating = true;
        this.startTime = Date.now();
        this.naturalQueue = [this.sourceNode];
        this.naturalActivated = new Set([this.sourceNode]);
        this.instantStartTime = null;
        this.lastDynamicConnectionTime = this.startTime;
        this.lastManagerPropagationTime = this.startTime;

        this.networkNatural.nodes[this.sourceNode].activated = true;
        this.networkNatural.nodes[this.sourceNode].activationTime = 0;
        this.networkNatural.nodes[this.sourceNode].discoveryAnimation = true;

        // Also set discovery animation on instant side
        this.networkInstant.nodes[this.sourceNode].discoveryAnimation = true;

        this.animate();
    }

    createDynamicConnection() {
        const nodes = this.networkNatural.nodes;
        const activated = Array.from(this.naturalActivated);
        const notActivated = nodes
            .map((n, i) => i)
            .filter(i => !this.naturalActivated.has(i));

        if (activated.length === 0 || notActivated.length === 0) return;

        // Random connection between activated and non-activated silos
        const fromIndex = activated[Math.floor(Math.random() * activated.length)];
        const toIndex = notActivated[Math.floor(Math.random() * notActivated.length)];

        const fromNode = nodes[fromIndex];
        const toNode = nodes[toIndex];

        // Only create if different silos
        if (fromNode.silo !== toNode.silo) {
            this.networkNatural.dynamicConnections.push({
                from: fromIndex,
                to: toIndex,
                active: true,
                formationTime: Date.now(),
                lifetime: 3000 + Math.random() * 2000 // Lives for 3-5 seconds
            });

            // Add to queue if not already activated
            if (!this.naturalActivated.has(toIndex)) {
                this.naturalActivated.add(toIndex);
                this.naturalQueue.push(toIndex);
            }
        }
    }

    managerPropagation() {
        const nodes = this.networkNatural.nodes;

        // Find activated managers
        const activatedManagers = nodes.filter((n, i) =>
            n.isManager && this.naturalActivated.has(i)
        );

        if (activatedManagers.length === 0) return;

        // Managers can propagate to other managers (top-down)
        const inactiveManagers = nodes
            .map((n, i) => ({ node: n, index: i }))
            .filter(({ node, index }) => node.isManager && !this.naturalActivated.has(index));

        if (inactiveManagers.length > 0) {
            const target = inactiveManagers[Math.floor(Math.random() * inactiveManagers.length)];

            if (!this.naturalActivated.has(target.index)) {
                this.naturalActivated.add(target.index);
                this.naturalQueue.push(target.index);
            }
        }
    }

    animate() {
        if (!this.animating) return;

        const elapsed = Date.now() - this.startTime;
        const currentTime = Date.now();

        // Manage dynamic connections (form and dissolve)
        if (currentTime - this.lastDynamicConnectionTime > 4000) { // Every 4 seconds
            this.createDynamicConnection();
            this.lastDynamicConnectionTime = currentTime;
        }

        // Remove expired dynamic connections
        this.networkNatural.dynamicConnections = this.networkNatural.dynamicConnections.filter(conn => {
            if (conn.formationTime && currentTime - conn.formationTime > conn.lifetime) {
                return false;
            }
            return true;
        });

        // Manager propagation (top-down)
        if (currentTime - this.lastManagerPropagationTime > 6000) { // Every 6 seconds
            this.managerPropagation();
            this.lastManagerPropagationTime = currentTime;
        }

        // Natural propagation - MUCH SLOWER - continues until all nodes reached
        if (elapsed % 1500 < 16) { // Every 1.5 seconds
            // Process propagation if there are nodes in queue
            if (this.naturalQueue.length > 0) {
                const currentNode = this.naturalQueue.shift();
                const currentNodeData = this.networkNatural.nodes[currentNode];

                if (!currentNodeData.activated) {
                    currentNodeData.activated = true;
                    currentNodeData.activationTime = elapsed;
                    this.naturalActivated.add(currentNode);
                }

                // Find connected nodes (including dynamic connections)
                const allConnections = [
                    ...this.networkNatural.connections,
                    ...this.networkNatural.dynamicConnections.filter(c => c.active)
                ];

                allConnections.forEach(conn => {
                    let nextNode = null;
                    const fromActivated = this.networkNatural.nodes[conn.from].activated;

                    // Only propagate if source is activated (green)
                    if (conn.from === currentNode && fromActivated && !this.naturalActivated.has(conn.to)) {
                        nextNode = conn.to;
                    } else if (conn.to === currentNode && fromActivated && !this.naturalActivated.has(conn.from)) {
                        nextNode = conn.from;
                    }

                    if (nextNode !== null && !this.naturalActivated.has(nextNode)) {
                        this.naturalActivated.add(nextNode);
                        this.naturalQueue.push(nextNode);
                    }
                });
            } else {
                // If queue is empty but not all nodes activated, check for newly connected nodes
                const allConnections = [
                    ...this.networkNatural.connections,
                    ...this.networkNatural.dynamicConnections.filter(c => c.active)
                ];

                allConnections.forEach(conn => {
                    const fromActivated = this.networkNatural.nodes[conn.from].activated;
                    const toActivated = this.networkNatural.nodes[conn.to].activated;

                    // If one side is green and other isn't, propagate
                    if (fromActivated && !toActivated && !this.naturalActivated.has(conn.to)) {
                        this.naturalActivated.add(conn.to);
                        this.naturalQueue.push(conn.to);
                    } else if (toActivated && !fromActivated && !this.naturalActivated.has(conn.from)) {
                        this.naturalActivated.add(conn.from);
                        this.naturalQueue.push(conn.from);
                    }
                });
            }
        }

        // Check if all nodes activated naturally (let it complete fully)
        const allActivated = this.networkNatural.nodes.every(n => n.activated);

        // Start instant propagation only after ALL nodes are activated naturally OR after 60 seconds
        if ((allActivated || elapsed > 60000) && !this.instantStartTime) {
            this.instantStartTime = Date.now();
        }

        // Instant propagation with system hub
        if (this.instantStartTime) {
            const instantElapsed = Date.now() - this.instantStartTime;
            if (instantElapsed > 1500) { // Longer delay before instant activation
                this.networkInstant.nodes.forEach((node, index) => {
                    if (!node.activated) {
                        node.activated = true;
                        node.activationTime = instantElapsed;
                    }
                });

                // Check if animation complete
                if (instantElapsed > 2500) {
                    this.animating = false;
                }
            }
        }

        // Update activation progress for smooth transitions
        this.updateActivationProgress(this.networkNatural, elapsed);
        this.updateActivationProgress(this.networkInstant, this.instantStartTime ? Date.now() - this.instantStartTime : 0);

        this.draw();

        if (this.animating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    updateActivationProgress(network, elapsed) {
        network.nodes.forEach(node => {
            if (node.activated && node.activationTime !== null) {
                const timeSinceActivation = elapsed - node.activationTime;
                node.activationProgress = Math.min(timeSinceActivation / 800, 1); // Slower transition
            }
        });
    }

    draw() {
        const currentTime = Date.now();

        this.ctxNatural.clearRect(0, 0, this.canvasNatural.width, this.canvasNatural.height);
        this.ctxInstant.clearRect(0, 0, this.canvasInstant.width, this.canvasInstant.height);

        drawNetwork(this.ctxNatural, this.networkNatural, colors, this.sourceNode, currentTime);
        drawNetwork(this.ctxInstant, this.networkInstant, colors, this.sourceNode, currentTime);

        // Draw system hub on instant side if active
        if (this.instantStartTime) {
            const width = this.canvasInstant.width;
            const height = this.canvasInstant.height;
            drawSystemHub(this.ctxInstant, width / 2, height - 60, 30, currentTime, colors);
        }
    }
}

// Visualization 2: Sequential Propagation
class SequentialVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.reset();
    }

    reset() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.network = generateOrganicNetwork(35, width / 2, height / 2, 260);
        this.network.dynamicConnections = [];
        this.sourceNode = Math.floor(Math.random() * this.network.nodes.length);
        this.stage = 0; // 0: before, 1: natural, 2: instant
        this.animating = false;
        this.stageStartTime = null;
        this.lastDynamicConnectionTime = 0;
        this.lastManagerPropagationTime = 0;

        this.draw();
    }

    start() {
        if (this.animating) return;

        this.animating = true;
        this.stage = 0;
        this.stageStartTime = Date.now();
        this.sourceNode = Math.floor(Math.random() * this.network.nodes.length);
        this.animate();
    }

    createDynamicConnection() {
        const nodes = this.network.nodes;
        const activated = Array.from(this.naturalActivated);
        const notActivated = nodes
            .map((n, i) => i)
            .filter(i => !this.naturalActivated.has(i));

        if (activated.length === 0 || notActivated.length === 0) return;

        const fromIndex = activated[Math.floor(Math.random() * activated.length)];
        const toIndex = notActivated[Math.floor(Math.random() * notActivated.length)];

        const fromNode = nodes[fromIndex];
        const toNode = nodes[toIndex];

        if (fromNode.silo !== toNode.silo) {
            this.network.dynamicConnections.push({
                from: fromIndex,
                to: toIndex,
                active: true,
                formationTime: Date.now(),
                lifetime: 3000 + Math.random() * 2000
            });

            if (!this.naturalActivated.has(toIndex)) {
                this.naturalActivated.add(toIndex);
                this.naturalQueue.push(toIndex);
            }
        }
    }

    managerPropagation() {
        const nodes = this.network.nodes;
        const activatedManagers = nodes.filter((n, i) =>
            n.isManager && this.naturalActivated.has(i)
        );

        if (activatedManagers.length === 0) return;

        const inactiveManagers = nodes
            .map((n, i) => ({ node: n, index: i }))
            .filter(({ node, index }) => node.isManager && !this.naturalActivated.has(index));

        if (inactiveManagers.length > 0) {
            const target = inactiveManagers[Math.floor(Math.random() * inactiveManagers.length)];

            if (!this.naturalActivated.has(target.index)) {
                this.naturalActivated.add(target.index);
                this.naturalQueue.push(target.index);
            }
        }
    }

    animate() {
        if (!this.animating) return;

        const elapsed = Date.now() - this.stageStartTime;
        const currentTime = Date.now();

        if (this.stage === 0) {
            // Initial pause to show network
            if (elapsed > 2500) { // Longer pause
                this.stage = 1;
                this.stageStartTime = Date.now();
                this.naturalQueue = [this.sourceNode];
                this.naturalActivated = new Set([this.sourceNode]);
                this.network.nodes[this.sourceNode].activated = true;
                this.network.nodes[this.sourceNode].activationTime = 0;
                this.network.nodes[this.sourceNode].discoveryAnimation = true;
                this.lastDynamicConnectionTime = currentTime;
                this.lastManagerPropagationTime = currentTime;
            }
        } else if (this.stage === 1) {
            // Dynamic connections
            if (currentTime - this.lastDynamicConnectionTime > 4000) {
                this.createDynamicConnection();
                this.lastDynamicConnectionTime = currentTime;
            }

            this.network.dynamicConnections = this.network.dynamicConnections.filter(conn => {
                if (conn.formationTime && currentTime - conn.formationTime > conn.lifetime) {
                    return false;
                }
                return true;
            });

            // Manager propagation
            if (currentTime - this.lastManagerPropagationTime > 6000) {
                this.managerPropagation();
                this.lastManagerPropagationTime = currentTime;
            }

            // Natural propagation - continues until all nodes reached
            if (elapsed % 1200 < 16) {
                if (this.naturalQueue.length > 0) {
                    const currentNode = this.naturalQueue.shift();
                    const currentNodeData = this.network.nodes[currentNode];

                    if (!currentNodeData.activated) {
                        currentNodeData.activated = true;
                        currentNodeData.activationTime = elapsed;
                    }

                    const allConnections = [
                        ...this.network.connections,
                        ...this.network.dynamicConnections.filter(c => c.active)
                    ];

                    allConnections.forEach(conn => {
                        let nextNode = null;
                        const fromActivated = this.network.nodes[conn.from].activated;

                        if (conn.from === currentNode && fromActivated && !this.naturalActivated.has(conn.to)) {
                            nextNode = conn.to;
                        } else if (conn.to === currentNode && fromActivated && !this.naturalActivated.has(conn.from)) {
                            nextNode = conn.from;
                        }

                        if (nextNode !== null && !this.naturalActivated.has(nextNode)) {
                            this.naturalActivated.add(nextNode);
                            this.naturalQueue.push(nextNode);
                        }
                    });
                } else {
                    // Check for newly connected nodes via dynamic connections
                    const allConnections = [
                        ...this.network.connections,
                        ...this.network.dynamicConnections.filter(c => c.active)
                    ];

                    allConnections.forEach(conn => {
                        const fromActivated = this.network.nodes[conn.from].activated;
                        const toActivated = this.network.nodes[conn.to].activated;

                        if (fromActivated && !toActivated && !this.naturalActivated.has(conn.to)) {
                            this.naturalActivated.add(conn.to);
                            this.naturalQueue.push(conn.to);
                        } else if (toActivated && !fromActivated && !this.naturalActivated.has(conn.from)) {
                            this.naturalActivated.add(conn.from);
                            this.naturalQueue.push(conn.from);
                        }
                    });
                }
            }

            // Check if all nodes activated
            const allActivated = this.network.nodes.every(n => n.activated);

            if (allActivated && elapsed > 2000) {
                // Reset and move to instant
                this.network.nodes.forEach(node => {
                    node.activated = false;
                    node.activationTime = null;
                    node.activationProgress = 0;
                    node.discoveryAnimation = false;
                });
                this.network.dynamicConnections = [];
                this.stage = 2;
                this.stageStartTime = Date.now();
            }
        } else if (this.stage === 2) {
            // Instant propagation - keep discovery animation on source node
            if (elapsed === 0 || (elapsed < 100 && !this.network.nodes[this.sourceNode].discoveryAnimation)) {
                this.network.nodes[this.sourceNode].discoveryAnimation = true;
            }

            if (elapsed > 1500) {
                this.network.nodes.forEach((node, index) => {
                    if (!node.activated) {
                        node.activated = true;
                        node.activationTime = elapsed;
                    }
                });

                if (elapsed > 3000) {
                    this.animating = false;
                }
            }
        }

        this.updateActivationProgress(elapsed);
        this.draw();

        if (this.animating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    updateActivationProgress(elapsed) {
        this.network.nodes.forEach(node => {
            if (node.activated && node.activationTime !== null) {
                const timeSinceActivation = elapsed - node.activationTime;
                node.activationProgress = Math.min(timeSinceActivation / 800, 1);
            }
        });
    }

    draw() {
        const currentTime = Date.now();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stage label
        const labels = [
            'Organization Network at Rest',
            'Natural Propagation Through Relationships',
            'Instant System-Enabled Distribution'
        ];
        this.ctx.font = '600 18px "DM Sans"';
        this.ctx.fillStyle = '#2C3333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(labels[this.stage], this.canvas.width / 2, 40);

        drawNetwork(this.ctx, this.network, colors, this.stage > 0 ? this.sourceNode : null, currentTime);

        // Draw system hub in stage 2
        if (this.stage === 2) {
            drawSystemHub(this.ctx, this.canvas.width / 2, this.canvas.height - 60, 30, currentTime, colors);
        }
    }
}

// Visualization 3: Particle-based Propagation
class ParticleVisualization {
    constructor(canvasNatural, canvasInstant) {
        this.canvasNatural = canvasNatural;
        this.canvasInstant = canvasInstant;
        this.ctxNatural = canvasNatural.getContext('2d');
        this.ctxInstant = canvasInstant.getContext('2d');

        this.setupCanvas();
        this.reset();
    }

    setupCanvas() {
        const setupCtx = (ctx) => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        setupCtx(this.ctxNatural);
        setupCtx(this.ctxInstant);
    }

    reset() {
        const width = this.canvasNatural.width;
        const height = this.canvasNatural.height;

        this.networkNatural = generateOrganicNetwork(30, width / 2, height / 2, 220);
        this.networkNatural.dynamicConnections = [];
        this.networkInstant = JSON.parse(JSON.stringify(this.networkNatural));
        this.networkInstant.dynamicConnections = [];

        this.sourceNode = Math.floor(Math.random() * this.networkNatural.nodes.length);
        this.particlesNatural = [];
        this.particlesInstant = [];
        this.animating = false;

        this.draw();
    }

    start() {
        if (this.animating) return;

        this.animating = true;
        this.startTime = Date.now();
        this.naturalActivated = new Set([this.sourceNode]);
        this.instantActivated = new Set();

        this.networkNatural.nodes[this.sourceNode].activated = true;
        this.networkNatural.nodes[this.sourceNode].discoveryAnimation = true;

        // Start natural propagation
        this.createNaturalParticles();

        // Delayed instant propagation
        setTimeout(() => {
            this.createInstantParticles();
        }, 3000);

        this.animate();
    }

    createNaturalParticles() {
        const source = this.networkNatural.nodes[this.sourceNode];

        const allConnections = [
            ...this.networkNatural.connections,
            ...this.networkNatural.dynamicConnections.filter(c => c.active)
        ];

        allConnections.forEach(conn => {
            let targetIndex = null;
            if (conn.from === this.sourceNode) targetIndex = conn.to;
            if (conn.to === this.sourceNode) targetIndex = conn.from;

            if (targetIndex !== null && !this.naturalActivated.has(targetIndex)) {
                const target = this.networkNatural.nodes[targetIndex];
                this.particlesNatural.push({
                    x: source.x,
                    y: source.y,
                    targetX: target.x,
                    targetY: target.y,
                    targetIndex: targetIndex,
                    progress: 0,
                    speed: 0.008 + Math.random() * 0.005, // Much slower
                    size: 5,
                    trail: []
                });
                this.naturalActivated.add(targetIndex);
            }
        });
    }

    createInstantParticles() {
        const source = this.networkInstant.nodes[this.sourceNode];

        this.networkInstant.nodes.forEach((node, index) => {
            if (index !== this.sourceNode) {
                this.particlesInstant.push({
                    x: source.x,
                    y: source.y,
                    targetX: node.x,
                    targetY: node.y,
                    targetIndex: index,
                    progress: 0,
                    speed: 0.03, // Slower instant too
                    size: 5,
                    trail: []
                });
            }
        });

        this.networkInstant.nodes[this.sourceNode].activated = true;
        this.networkInstant.nodes[this.sourceNode].discoveryAnimation = true;
    }

    animate() {
        if (!this.animating) return;

        const currentTime = Date.now();

        // Update natural particles
        this.particlesNatural = this.particlesNatural.filter(particle => {
            particle.progress += particle.speed;

            const prevX = particle.x;
            const prevY = particle.y;

            particle.x = particle.x + (particle.targetX - particle.x) * particle.speed;
            particle.y = particle.y + (particle.targetY - particle.y) * particle.speed;

            // Add to trail
            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 12) particle.trail.shift();

            if (particle.progress >= 1) {
                const targetNode = this.networkNatural.nodes[particle.targetIndex];
                targetNode.activated = true;

                // Create new particles from this node (only to connected green nodes)
                const allConnections = [
                    ...this.networkNatural.connections,
                    ...this.networkNatural.dynamicConnections.filter(c => c.active)
                ];

                allConnections.forEach(conn => {
                    let nextIndex = null;
                    if (conn.from === particle.targetIndex) nextIndex = conn.to;
                    if (conn.to === particle.targetIndex) nextIndex = conn.from;

                    if (nextIndex !== null && !this.naturalActivated.has(nextIndex)) {
                        const nextTarget = this.networkNatural.nodes[nextIndex];
                        this.particlesNatural.push({
                            x: targetNode.x,
                            y: targetNode.y,
                            targetX: nextTarget.x,
                            targetY: nextTarget.y,
                            targetIndex: nextIndex,
                            progress: 0,
                            speed: 0.008 + Math.random() * 0.005,
                            size: 5,
                            trail: []
                        });
                        this.naturalActivated.add(nextIndex);
                    }
                });

                return false; // Remove particle
            }

            return true;
        });

        // Update instant particles
        this.particlesInstant = this.particlesInstant.filter(particle => {
            particle.progress += particle.speed;

            const prevX = particle.x;
            const prevY = particle.y;

            particle.x = particle.x + (particle.targetX - particle.x) * particle.speed;
            particle.y = particle.y + (particle.targetY - particle.y) * particle.speed;

            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 8) particle.trail.shift();

            if (particle.progress >= 1) {
                this.networkInstant.nodes[particle.targetIndex].activated = true;
                return false;
            }

            return true;
        });

        // Check if animation complete
        if (this.particlesNatural.length === 0 && this.particlesInstant.length === 0 && Date.now() - this.startTime > 10000) {
            this.animating = false;
        }

        this.draw();

        if (this.animating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    draw() {
        const currentTime = Date.now();

        this.ctxNatural.clearRect(0, 0, this.canvasNatural.width, this.canvasNatural.height);
        this.ctxInstant.clearRect(0, 0, this.canvasInstant.width, this.canvasInstant.height);

        drawNetwork(this.ctxNatural, this.networkNatural, colors, this.sourceNode, currentTime);
        drawNetwork(this.ctxInstant, this.networkInstant, colors, this.sourceNode, currentTime);

        drawParticles(this.ctxNatural, this.particlesNatural, colors);
        drawParticles(this.ctxInstant, this.particlesInstant, colors);

        // Draw system hub on instant side if particles exist
        if (this.particlesInstant.length > 0 || this.networkInstant.nodes.some(n => n.activated)) {
            const width = this.canvasInstant.width;
            const height = this.canvasInstant.height;
            drawSystemHub(this.ctxInstant, width / 2, height - 60, 30, currentTime, colors);
        }
    }
}

// Initialize visualizations
const comparisonViz = new ComparisonVisualization(
    document.getElementById('canvas-natural'),
    document.getElementById('canvas-instant')
);

const sequentialViz = new SequentialVisualization(
    document.getElementById('canvas-sequential')
);

const particleViz = new ParticleVisualization(
    document.getElementById('canvas-particle-natural'),
    document.getElementById('canvas-particle-instant')
);

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update active states
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.visualization-container').forEach(container => {
            container.classList.remove('active');
        });
        document.getElementById(targetTab).classList.add('active');
    });
});

// Button handlers
document.getElementById('btn-start-comparison').addEventListener('click', () => {
    comparisonViz.start();
});

document.getElementById('btn-reset-comparison').addEventListener('click', () => {
    comparisonViz.reset();
});

document.getElementById('btn-start-sequential').addEventListener('click', () => {
    sequentialViz.start();
});

document.getElementById('btn-reset-sequential').addEventListener('click', () => {
    sequentialViz.reset();
});

document.getElementById('btn-start-particle').addEventListener('click', () => {
    particleViz.start();
});

document.getElementById('btn-reset-particle').addEventListener('click', () => {
    particleViz.reset();
});

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

// Drawing utilities
const colors = {
    connection: '#E5E7EB',
    dynamicConnection: '#F59E0B',
    inactive: '#D1D5DB',
    active: '#7CB342',
    insight: '#F59E0B',
    particle: '#7CB342',
    particleTrail: 'rgba(124, 179, 66, 0.3)',
    system: '#3B82F6',
    systemConnection: '#3B82F6'
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
        ctx.shadowColor = particle.color === colors.system ? 'rgba(59, 130, 246, 0.5)' : 'rgba(124, 179, 66, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function drawSystemHub(ctx, x, y, size, currentTime, active = false) {
    const pulseProgress = (currentTime % 2000) / 2000;
    const pulse = Math.sin(pulseProgress * Math.PI * 2) * 4;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, size + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = colors.system;
    ctx.lineWidth = 3;
    ctx.globalAlpha = active ? 1 : 0.5;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Inner hub
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = colors.system;
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
            ctx.fillStyle = colors.system;
            ctx.fill();
        }
    }
}

function drawSystemConnectionLine(ctx, fromX, fromY, toX, toY, progress) {
    if (progress <= 0) return;

    const currentX = fromX + (toX - fromX) * Math.min(progress, 1);
    const currentY = fromY + (toY - fromY) * Math.min(progress, 1);

    ctx.strokeStyle = colors.systemConnection;
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
class EnergyFlowVisualization {
    constructor(canvasNatural, canvasInstant) {
        this.canvasNatural = canvasNatural;
        this.canvasInstant = canvasInstant;
        this.ctxNatural = canvasNatural.getContext('2d');
        this.ctxInstant = canvasInstant.getContext('2d');

        this.setupCanvas();
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

        // Generate network
        this.networkNatural = generateOrganicNetwork(30, width / 2, height / 2 - 20, 220);
        this.networkNatural.dynamicConnections = [];
        this.networkInstant = JSON.parse(JSON.stringify(this.networkNatural));
        this.networkInstant.dynamicConnections = [];

        // Pick source node
        this.sourceNode = Math.floor(Math.random() * this.networkNatural.nodes.length);

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
        this.systemConnectionProgress = 0;
        this.systemActivated = false;
        this.instantBroadcastStarted = false;

        // System hub position
        this.systemHubX = width / 2;
        this.systemHubY = height - 40;

        this.draw();
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
        if (to.activated) {
            return; // Target already green
        }

        const alreadyGoing = this.particlesNatural.some(p => p.targetIndex === toIndex);
        if (alreadyGoing) {
            return; // Particle already heading there
        }

        this.particlesNatural.push({
            x: from.x,
            y: from.y,
            targetX: to.x,
            targetY: to.y,
            targetIndex: toIndex,
            progress: 0,
            speed: 0.01,
            size: 5,
            trail: [],
            color: colors.particle
        });
    }

    // When insight first appears, spread to immediate neighbors
    initiateSpread() {
        // FIRST: Mark source node as activated (green) - it has the insight!
        const sourceNode = this.networkNatural.nodes[this.sourceNode];
        sourceNode.activated = true;

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
            this.systemConnectionProgress = 0;
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
        }

        // ===== INSTANT SIDE =====
        if (this.hasInsightAppeared) {
            // Animate connection line from insight to system
            if (this.systemConnectionProgress < 1) {
                this.systemConnectionProgress += 0.015;

                // Create particle traveling to system
                if (this.systemConnectionProgress > 0.05 && this.particlesInstant.length === 0) {
                    const sourceNode = this.networkInstant.nodes[this.sourceNode];
                    this.particlesInstant.push({
                        x: sourceNode.x,
                        y: sourceNode.y,
                        targetX: this.systemHubX,
                        targetY: this.systemHubY,
                        targetIndex: -1, // System hub
                        progress: 0,
                        speed: 0.02,
                        size: 6,
                        trail: [],
                        color: colors.system
                    });
                }
            } else if (!this.systemActivated) {
                // System received the insight
                this.systemActivated = true;
            }

            // Start broadcast after system activation
            if (this.systemActivated && !this.instantBroadcastStarted) {
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

        if (this.animating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    startInstantBroadcast() {
        const nodes = this.networkInstant.nodes;

        nodes.forEach((node, index) => {
            if (index !== this.sourceNode) {
                this.particlesInstant.push({
                    x: this.systemHubX,
                    y: this.systemHubY,
                    targetX: node.x,
                    targetY: node.y,
                    targetIndex: index,
                    progress: 0,
                    speed: 0.025,
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
            particle.progress += particle.speed;

            // Update position
            const prevX = particle.x;
            const prevY = particle.y;
            particle.x = particle.x + (particle.targetX - particle.x) * particle.speed;
            particle.y = particle.y + (particle.targetY - particle.y) * particle.speed;

            // Update trail
            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 10) particle.trail.shift();

            // Check if particle reached destination
            if (particle.progress >= 1) {
                const targetNode = this.networkNatural.nodes[particle.targetIndex];

                // Activate the target node
                if (!targetNode.activated) {
                    targetNode.activated = true;

                    // IMPORTANT: Now spread from this newly activated node
                    const neighbors = this.getConnectedNodes(particle.targetIndex);
                    console.log(`Node ${particle.targetIndex} activated with ${neighbors.length} neighbors`);

                    // Spread to all non-green neighbors
                    neighbors.forEach(neighborIndex => {
                        this.createParticle(particle.targetIndex, neighborIndex);
                    });
                }

                return false; // Remove this particle
            }

            return true; // Keep this particle
        });
    }

    updateInstantParticles() {
        this.particlesInstant = this.particlesInstant.filter(particle => {
            particle.progress += particle.speed;

            const prevX = particle.x;
            const prevY = particle.y;

            particle.x = particle.x + (particle.targetX - particle.x) * particle.speed;
            particle.y = particle.y + (particle.targetY - particle.y) * particle.speed;

            particle.trail.push({ x: prevX, y: prevY });
            if (particle.trail.length > 8) particle.trail.shift();

            if (particle.progress >= 1) {
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
        drawSystemHub(this.ctxInstant, this.systemHubX, this.systemHubY, 30, currentTime, this.systemActivated);

        // Draw connection line from insight to system
        if (this.hasInsightAppeared && this.systemConnectionProgress > 0) {
            const sourceNode = this.networkInstant.nodes[this.sourceNode];
            drawSystemConnectionLine(
                this.ctxInstant,
                sourceNode.x,
                sourceNode.y,
                this.systemHubX,
                this.systemHubY,
                this.systemConnectionProgress
            );
        }

        drawParticles(this.ctxInstant, this.particlesInstant);
    }
}

// Initialize
const viz = new EnergyFlowVisualization(
    document.getElementById('canvas-natural'),
    document.getElementById('canvas-instant')
);

document.getElementById('btn-start').addEventListener('click', () => viz.start());
document.getElementById('btn-reset').addEventListener('click', () => viz.reset());
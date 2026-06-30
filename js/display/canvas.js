/**
 * js/display/canvas.js
 * HID-Fix Geometric Vector Canvas Engine (ES2024 - OOP Architecture)
 * مدیریت رندر استیک‌ها، رسم ددزون‌ها و ثبت تریل حرکتی سنسورها
 */

import { AppState } from '../core/state.js';

class StickVisualizer {
    constructor(canvasId, stickKey) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.stickKey = stickKey;
        this.trail = [];
        this.maxTrailPoints = 120; // طول بافر سایه متحرک پوتانسیومتر
        
        this.theme = {
            accent: stickKey === 'left' ? '#00f2fe' : '#10b981',
            glow: stickKey === 'left' ? 'rgba(0, 242, 254, 0.3)' : 'rgba(16, 185, 129, 0.3)',
            grid: '#141c30',
            deadzone: 'rgba(239, 68, 68, 0.12)',
            text: '#5b6982'
        };

        this.dimensions = {
            width: this.canvas.width,
            height: this.canvas.height,
            centerX: this.canvas.width / 2,
            centerY: this.canvas.height / 2,
            radius: (this.canvas.width / 2) - 15
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height);
    }

    drawGrid() {
        const { ctx, dimensions, theme } = this;
        const { centerX, centerY, radius } = dimensions;

        ctx.fillStyle = '#03050c';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1.0].forEach(scale => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();
    }

    drawDeadzones() {
        const { ctx, dimensions, theme } = this;
        const { centerX, centerY, radius } = dimensions;
        const deadzoneRadius = radius * 0.05; // محدوده ددزون ۵ درصدی سخت‌افزار

        ctx.fillStyle = theme.deadzone;
        ctx.beginPath();
        ctx.arc(centerX, centerY, deadzoneRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawTrail(px, py) {
        const { ctx, theme } = this;
        this.trail.push({ x: px, y: py });
        if (this.trail.length > this.maxTrailPoints) this.trail.shift();

        if (this.trail.length < 2) return;

        ctx.strokeStyle = theme.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.stroke();
    }

    drawPointer(px, py) {
        const { ctx, theme } = this;
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    renderHudText(rawX, rawY) {
        const { ctx, dimensions, theme } = this;
        ctx.fillStyle = theme.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`X: ${rawX.toFixed(4)}`, 12, dimensions.height - 24);
        ctx.fillText(`Y: ${rawY.toFixed(4)}`, 12, dimensions.height - 12);
    }

    updateDirectionMatrix(rawX, rawY) {
        const threshold = 0.3;
        let dir = 'C';

        if (rawY < -threshold) {
            if (rawX < -threshold) dir = 'NW';
            else if (rawX > threshold) dir = 'NE';
            else dir = 'N';
        } else if (rawY > threshold) {
            if (rawX < -threshold) dir = 'SW';
            else if (rawX > threshold) dir = 'SE';
            else dir = 'S';
        } else {
            if (rawX < -threshold) dir = 'W';
            else if (rawX > threshold) dir = 'E';
        }

        const matrixContainer = document.getElementById(`matrix-${this.stickKey}`);
        if (matrixContainer) {
            const spans = matrixContainer.querySelectorAll('span');
            spans.forEach(span => {
                if (span.getAttribute('data-dir') === dir) {
                    span.classList.add('active');
                } else {
                    span.classList.remove('active');
                }
            });
        }
    }

    updateAndRender(rawX, rawY) {
        if (!this.canvas) return;
        this.clear();
        this.drawGrid();
        this.drawDeadzones();

        const pointerX = this.dimensions.centerX + (rawX * this.dimensions.radius);
        const pointerY = this.dimensions.centerY + (rawY * this.dimensions.radius);

        this.drawTrail(pointerX, pointerY);
        this.drawPointer(pointerX, pointerY);
        this.renderHudText(rawX, rawY);
        this.updateDirectionMatrix(rawX, rawY);
    }
}

export const AnalogCanvas = {
    instances: {},

    init(canvasLeftId, canvasRightId) {
        this.instances['left'] = new StickVisualizer(canvasLeftId, 'left');
        this.instances['right'] = new StickVisualizer(canvasRightId, 'right');
    },

    updateAndRender(stickKey, rawX, rawY) {
        const visualizer = this.instances[stickKey];
        if (visualizer) {
            visualizer.updateAndRender(rawX, rawY);
        }
    }
};

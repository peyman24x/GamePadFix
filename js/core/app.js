/**
 * js/core/app.js
 * MATRIX App Orchestrator - Production-Ready Version for Cloudflare & GitHub
 */

import { AppState, resetAppStateInputs } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    init() {
        // ۱. پل ارتباطی ارسال لاگ به کنسول UI
        HidEngine.onLog = (message, type) => this.logToConsole(message, type);

        // ۲. خط لوله داده فیزیکی
        HidEngine.onInputReceived = (vendorId, reportId, data) => {
            const dataView = new DataView(data.buffer);
            if (vendorId === 0x054C || vendorId === 1356) {
                SonyDecoder.decodeInput(reportId, dataView);
            } else if (vendorId === 0x045E || vendorId === 1118) {
                XboxDecoder.decodeInput(reportId, dataView);
            }
        };

        this.logToConsole('سامانه ماتریکس آماده برقراری ارتباط با پورت سخت‌افزار است.', 'info');
        
        // راه‌اندازی ماژول‌ها
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال ایمن رویدادهای دکمه‌ها با چک کردن وجود المان (Prevention of Null Pointer)
        this.bindEvents();

        // شروع لوپ رندر ۶۰ هرتز
        this.lifecycleLoop();
    },

    bindEvents() {
        const connectBtn = document.getElementById('btn-connect');
        if (connectBtn) {
            connectBtn.onclick = async (e) => {
                e.preventDefault();
                await HidEngine.connectDevice();
            };
        }

        const startCalibBtn = document.getElementById('btn-start-calibration');
        if (startCalibBtn) startCalibBtn.onclick = () => CalibrationWizard.start();

        const nextBtn = document.getElementById('wiz-btn-next');
        if (nextBtn) nextBtn.onclick = () => CalibrationWizard.nextStep();

        const backBtn = document.getElementById('wiz-btn-back');
        if (backBtn) backBtn.onclick = () => CalibrationWizard.prevStep();

        const cancelBtn = document.getElementById('wiz-btn-cancel');
        if (cancelBtn) cancelBtn.onclick = () => CalibrationWizard.cancel();
    },

    lifecycleLoop() {
        if (AppState.connection.isConnected) {
            AnalogCanvas.instances['left']?.updateAndRender('left', AppState.inputs.axes.lx, AppState.inputs.axes.ly);
            AnalogCanvas.instances['right']?.updateAndRender('right', AppState.inputs.axes.rx, AppState.inputs.axes.ry);
            
            // ✅ فراخوانی رکورد کردن نمونه‌های زنده برای ویزارد کالیبراسیون
            if (CalibrationWizard.isActive) {
                CalibrationWizard.recordLiveSamples();
            }
            
            this.renderVirtualGamepad();
        } else {
            resetAppStateInputs();
        }

        this.renderTelemetryUI();
        requestAnimationFrame(() => this.lifecycleLoop());
    },

    renderVirtualGamepad() {
        Object.keys(AppState.inputs.buttons).forEach(btnKey => {
            const el = document.getElementById(`btn-${btnKey}`);
            if (el) {
                if (AppState.inputs.buttons[btnKey]) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        const l2Perc = Math.round(AppState.inputs.triggers.l2 * 100);
        const r2Perc = Math.round(AppState.inputs.triggers.r2 * 100);

        const barL2 = document.getElementById('bar-l2');
        const txtL2 = document.getElementById('txt-l2');
        if (barL2) barL2.style.width = `${l2Perc}%`;
        if (txtL2) txtL2.innerText = `${l2Perc}%`;

        const barR2 = document.getElementById('bar-r2');
        const txtR2 = document.getElementById('txt-r2');
        if (barR2) barR2.style.width = `${r2Perc}%`;
        if (txtR2) txtR2.innerText = `${r2Perc}%`;
    },

    renderTelemetryUI() {
        const body = document.body;
        const badge = document.getElementById('connection-badge');
        const devName = document.getElementById('device-name');

        if (AppState.connection.isConnected) {
            body.classList.remove('disconnected');
            if (badge) {
                badge.innerText = 'آنلاین // سخت‌افزار متصل است';
                badge.className = 'badge badge-connected';
            }
            if (devName) devName.innerText = AppState.deviceInfo.name;

            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = AppState.connection.type.toUpperCase();
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = `0x${AppState.deviceInfo.vendorId.toString(16).toUpperCase()}`;
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = `0x${AppState.deviceInfo.productId.toString(16).toUpperCase()}`;
            if (document.getElementById('val-charge-status')) {
                document.getElementById('val-charge-status').innerText = AppState.analysis.battery.isCharging ? 'در حال شارژ' : `${AppState.analysis.battery.level || 100}%`;
            }

            if (document.getElementById('val-hz-left')) document.getElementById('val-hz-left').innerText = `${AppState.analysis.left.pollingRate} Hz`;
            if (document.getElementById('val-hz-right')) document.getElementById('val-hz-right').innerText = `${AppState.analysis.right.pollingRate} Hz`;

            if (document.getElementById('err-l-offset')) document.getElementById('err-l-offset').innerText = AppState.analysis.left.centerOffset.toFixed(4);
            if (document.getElementById('err-r-offset')) document.getElementById('err-r-offset').innerText = AppState.analysis.right.centerOffset.toFixed(4);
            if (document.getElementById('err-l-circ')) document.getElementById('err-l-circ').innerText = `${(AppState.analysis.left.circularError * 100).toFixed(2)}%`;
            if (document.getElementById('err-r-circ')) document.getElementById('err-r-circ').innerText = `${(AppState.analysis.right.circularError * 100).toFixed(2)}%`;
        } else {
            if (!body.classList.contains('disconnected')) body.classList.add('disconnected');
            if (badge) {
                badge.innerText = 'آفلاین // در انتظار کنترلر';
                badge.className = 'badge badge-disconnected';
            }
            if (devName) devName.innerText = 'در انتظار سنترگیری تراشه سخت‌افزار...';
            
            ['hw-mcu', 'fw-date', 'fw-ver', 'val-charge-status'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = '-';
            });
            if (document.getElementById('val-hz-left')) document.getElementById('val-hz-left').innerText = '0 Hz';
            if (document.getElementById('val-hz-right')) document.getElementById('val-hz-right').innerText = '0 Hz';
        }
    },

    logToConsole(message, type = 'info') {
        const consoleBody = document.getElementById('app-console');
        if (!consoleBody) return;

        const logRow = document.createElement('div');
        logRow.className = `log-${type}`;
        logRow.innerText = `[${type.toUpperCase()}] ${message}`;
        consoleBody.appendChild(logRow);
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }
};

// اجرای امن به محض آماده شدن کامل DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppCore.init());
} else {
    AppCore.init();
}

export { AppCore };

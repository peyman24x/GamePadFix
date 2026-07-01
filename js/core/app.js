/**
 * js/core/app.js
 * MATRIX App Orchestrator - Adjusted for Custom DOM Layout
 */

import { AppState, resetAppStateInputs } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    init() {
        HidEngine.onLog = (message, type) => this.logToConsole(message, type);

        HidEngine.onInputReceived = (vendorId, reportId, data) => {
            const dataView = new DataView(data.buffer);
            if (vendorId === 0x054C || vendorId === 1356) {
                SonyDecoder.decodeInput(reportId, dataView);
            } else if (vendorId === 0x045E || vendorId === 1118) {
                XboxDecoder.decodeInput(reportId, dataView);
            }
        };

        this.logToConsole('سامانه کالیبراسیون ماتریکس آماده برقراری ارتباط با پورت سخت‌افزار است.', 'info');
        
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال دکمه‌های ناوبری پنجره کالیبراسیون ماتریکس
        document.getElementById('btn-start-calibration')?.addEventListener('click', () => CalibrationWizard.start());
        document.getElementById('wiz-btn-next')?.addEventListener('click', () => CalibrationWizard.nextStep());
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => CalibrationWizard.prevStep());
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => CalibrationWizard.cancel());

        // پیوند دکمه اختصاصی شما در HTML جدید جهت فراخوانی پنجره مرورگر
        document.getElementById('btn-connect')?.addEventListener('click', () => HidEngine.connectDevice());

        // استارت لوپ رندر با فرکانس مانیتور کاربر
        this.lifecycleLoop();
    },

    lifecycleLoop() {
        if (AppState.connection.isConnected) {
            // آپدیت بوم گرافیکی استیک‌ها
            AnalogCanvas.instances['left']?.updateAndRender(AppState.inputs.axes.lx, AppState.inputs.axes.ly);
            AnalogCanvas.instances['right']?.updateAndRender(AppState.inputs.axes.rx, AppState.inputs.axes.ry);
            
            // آپدیت وضعیت دکمه‌ها و جابجایی تریگرها در نقشه زنده مپینگ
            this.renderVirtualGamepad();
        } else {
            resetAppStateInputs();
        }

        this.renderTelemetryUI();
        requestAnimationFrame(() => this.lifecycleLoop());
    },

    renderVirtualGamepad() {
        // مپینگ داینامیک دکمه‌های دیجیتال روی فیزیک شاسی
        Object.keys(AppState.inputs.buttons).forEach(btnKey => {
            const el = document.getElementById(`btn-${btnKey}`);
            if (el) {
                if (AppState.inputs.buttons[btnKey]) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        });

        // رندر و محاسبه طول بارهای تریگرهای آنالوگ L2 و R2
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
            if (body.classList.contains('disconnected')) body.classList.remove('disconnected');
            
            if (badge) {
                badge.innerText = 'آنلاین // سخت‌افزار متصل است';
                badge.className = 'badge badge-connected';
            }

            if (devName) devName.innerText = AppState.deviceInfo.name;

            // نگاشت دقیق داده‌های رجیستر مطابق با ساختار جدید فایل HTML شما
            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = AppState.connection.type.toUpperCase();
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = `0x${AppState.deviceInfo.vendorId.toString(16).toUpperCase()}`;
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = `0x${AppState.deviceInfo.productId.toString(16).toUpperCase()}`;
            if (document.getElementById('val-charge-status')) {
                document.getElementById('val-charge-status').innerText = AppState.analysis.battery.isCharging ? 'در حال شارژ' : `${AppState.analysis.battery.level || 100}%`;
            }

            // شمارنده‌های فرکانس پوتانسیومترها
            if (document.getElementById('val-hz-left')) document.getElementById('val-hz-left').innerText = `${AppState.analysis.left.pollingRate} Hz`;
            if (document.getElementById('val-hz-right')) document.getElementById('val-hz-right').innerText = `${AppState.analysis.right.pollingRate} Hz`;

            // خطای آفست مرکز و دایره‌ای
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
            
            // بازنشانی ایمن مقادیر در زمان آفلاین شدن کابل
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

document.addEventListener('DOMContentLoaded', () => AppCore.init());
export { AppCore };

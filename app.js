/**
 * HID-Fix App Orchestrator (ES2024 Phase 5 Fully Integrated Engine)
 * اتصال نهایی WebHID، کالیبراسیون ویزارد، رندرهای کانوس و سیستم لاگ کارگاهی
 */

import { AppState } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js'; // [تزریق موتور کالیبراسیون فاز ۵]

const AppCore = {
    init() {
        AppState.log('هسته مرکزی سامانه HID-Fix راه‌اندازی شد.', 'info');
        
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال دکمه‌های ناوبری ویزارد کالیبراسیون به موتور منطقی
        const btnStartCalib = document.getElementById('btn-start-calibration');
        if (btnStartCalib) {
            btnStartCalib.addEventListener('click', () => CalibrationWizard.start());
        }

        document.getElementById('wiz-btn-next')?.addEventListener('click', () => CalibrationWizard.nextStep());
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => CalibrationWizard.prevStep());
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => CalibrationWizard.cancel());

        const btnConnect = document.getElementById('btn-connect');
        if (btnConnect) {
            btnConnect.addEventListener('click', () => HidEngine.requestDevicePermission());
        }

        this.initTabs();

        HidEngine.onDeviceReady = async (device) => {
            AppState.log(`در حال استخراج هدرهای عمیق فریمور از کانتینر تراشه...`, 'info');
            if (device.vendorId === 0x054C) {
                await SonyDecoder.queryDeepFirmware(device);
            }
        };

        HidEngine.onInputReceived = (vendorId, reportId, dataBuffer) => {
            const view = new DataView(dataBuffer.buffer);
            if (vendorId === 0x054C) {
                SonyDecoder.decodeInput(reportId, view);
            } else if (vendorId === 0x045E) {
                XboxDecoder.decodeInput(reportId, view);
            }
        };

        this.runUpdateLoop();
    },

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = document.getElementById(btn.getAttribute('data-tab'));
                if (targetTab) targetTab.classList.add('active');
            });
        });
    },

    runUpdateLoop() {
        const loop = () => {
            this.syncStateWithUI();
            this.renderHardwareButtonsMap();
            
            if (AppState.connection.status === 'connected') {
                // اعمال پویای ضریب اصلاح کالیبراسیون فاز ۵ روی محورها قبل از رندر نهایی
                const calibratedLX = AppState.inputs.axes.lx - AppState.calibration.offsetLX;
                const calibratedLY = AppState.inputs.axes.ly - AppState.calibration.offsetLY;
                const calibratedRX = AppState.inputs.axes.rx - AppState.calibration.offsetRX;
                const calibratedRY = AppState.inputs.axes.ry - AppState.calibration.offsetRY;

                // رندر گرافیکی کانوس‌ها با مقادیر اصلاح‌شده
                AnalogCanvas.updateAndRender('left', calibratedLX, calibratedLY);
                AnalogCanvas.updateAndRender('right', calibratedRX, calibratedRY);

                // [توسعه فاز ۵]: مانیتورینگ آنلاین بافرها در مراحل فعال کالیبراسیون
                CalibrationWizard.captureLiveBounds();
            }
            
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    renderHardwareButtonsMap() {
        if (AppState.connection.status !== 'connected') return;

        const buttonSelectors = {
            'dpad-up': 'btn-dpad-up', 'dpad-down': 'btn-dpad-down',
            'dpad-left': 'btn-dpad-left', 'dpad-right': 'btn-dpad-right',
            'action-top': 'btn-action-top', 'action-bottom': 'btn-action-bottom',
            'action-left': 'btn-action-left', 'action-right': 'btn-action-right',
            'l1': 'btn-l1', 'r1': 'btn-r1', 'l3': 'btn-l3', 'r3': 'btn-r3'
        };

        for (const [stateKey, domId] of Object.entries(buttonSelectors)) {
            const el = document.getElementById(domId);
            if (el) {
                if (AppState.inputs.buttons[stateKey]) el.classList.add('pressed');
                else el.classList.remove('pressed');
            }
        }

        const l2Bar = document.getElementById('bar-l2');
        const r2Bar = document.getElementById('bar-r2');
        if (l2Bar) l2Bar.style.width = `${(AppState.inputs.triggers.l2 * 100).toFixed(0)}%`;
        if (r2Bar) r2Bar.style.width = `${(AppState.inputs.triggers.r2 * 100).toFixed(0)}%`;
    },

    syncStateWithUI() {
        const body = document.body;
        const status = AppState.connection.status;

        if (status === 'connected') {
            if (body.classList.contains('disconnected')) body.classList.remove('disconnected');
            
            document.getElementById('connection-badge').innerText = `Connected: ${AppState.connection.backend.toUpperCase()}`;
            document.getElementById('connection-badge').className = 'badge badge-connected';
            document.getElementById('val-conn-type').innerText = AppState.connection.type;
            document.getElementById('val-charge-status').innerText = AppState.battery.status.toUpperCase();
            document.getElementById('val-battery-lvl').innerText = `${AppState.battery.percentage}%`;
            document.getElementById('val-voltage').innerText = AppState.battery.voltage;
            document.getElementById('rate-l-poll').innerText = `${AppState.analysis.left.pollingRate}Hz`;
            
            document.getElementById('axis-lx').innerText = AppState.inputs.axes.lx.toFixed(2);
            document.getElementById('axis-ly').innerText = AppState.inputs.axes.ly.toFixed(2);
            document.getElementById('axis-rx').innerText = AppState.inputs.axes.rx.toFixed(2);
            document.getElementById('axis-ry').innerText = AppState.inputs.axes.ry.toFixed(2);

            const lOffset = AppState.analysis.left.centerOffset;
            const rOffset = AppState.analysis.right.centerOffset;
            document.getElementById('err-l-offset').innerText = lOffset.toFixed(4);
            document.getElementById('err-r-offset').innerText = rOffset.toFixed(4);
            
            document.getElementById('err-l-offset').style.color = lOffset > 0.05 ? 'var(--color-danger)' : 'var(--color-text-primary)';
            document.getElementById('err-r-offset').style.color = rOffset > 0.05 ? 'var(--color-danger)' : 'var(--color-text-primary)';

            const lCircErr = AppState.analysis.left.circularError;
            const rCircErr = AppState.analysis.right.circularError;
            document.getElementById('err-l-circ').innerText = `${lCircErr.toFixed(2)}%`;
            document.getElementById('err-r-circ').innerText = `${rCircErr.toFixed(2)}%`;

            document.getElementById('info-name').innerText = AppState.deviceInfo.controllerName.substring(0, 22);
            document.getElementById('info-vid').innerText = AppState.deviceInfo.vendorId;
            document.getElementById('info-pid').innerText = AppState.deviceInfo.productId;
            document.getElementById('fw-ver').innerText = AppState.deviceInfo.firmware.version;
            document.getElementById('fw-date').innerText = AppState.deviceInfo.firmware.buildDate;
            document.getElementById('fw-sbl').innerText = AppState.deviceInfo.firmware.sblVersion;
            document.getElementById('fw-touchpad').innerText = AppState.deviceInfo.firmware.touchpadVersion;
            document.getElementById('hw-mcu').innerText = AppState.deviceInfo.hardware.mcuUniqueId;
            document.getElementById('hw-serial').innerText = AppState.deviceInfo.hardware.serialNumber;
            document.getElementById('hw-bt-addr').innerText = AppState.deviceInfo.hardware.bluetoothAddress;
        } else {
            if (!body.classList.contains('disconnected')) body.classList.add('disconnected');
            document.getElementById('connection-badge').innerText = 'Disconnected';
            document.getElementById('connection-badge').className = 'badge badge-disconnected';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => AppCore.init());
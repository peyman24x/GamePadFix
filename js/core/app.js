/**
 * js/core/app.js
 * HID-Fix App Orchestrator (ES2024 Phase 3 - Standard UI Integration)
 * ارکستراتور اصلی، مدیریت چرخه پردازش زنده و ایمن‌سازی بوم گرافیکی با دقت بالا
 */

import { AppState } from './state.js';
import { HidEngine } from '../hid/engine.js';
import { SonyDecoder } from '../controllers/sony.js';
import { XboxDecoder } from '../controllers/xbox.js';
import { AnalogCanvas } from '../display/canvas.js';
import { CalibrationWizard } from './wizard.js';

const AppCore = {
    /**
     * راه‌اندازی اولیه ماژول‌ها و شنودارهای رویداد رابط کاربری (UI Event Listeners)
     */
    init() {
        // ثبت لاگ اولیه سیستم جهت تایید لود کامپوننت‌ها
        this.logToConsole('هسته مرکزی سامانه HID-Fix با موفقیت راه‌اندازی شد.', 'info');
        
        // مقداردهی اولیه موتورهای فیزیکی اتصال و رندرسازی گرافیکی Canvas
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال رویدادهای مربوط به دکمه‌های ناوبری ماشین وضعیت ویزارد کالیبراسیون
        document.getElementById('btn-start-calibration')?.addEventListener('click', () => {
            CalibrationWizard.start();
        });

        document.getElementById('wiz-btn-next')?.addEventListener('click', () => {
            CalibrationWizard.nextStep();
        });

        document.getElementById('wiz-btn-back')?.addEventListener('click', () => {
            CalibrationWizard.prevStep();
        });

        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => {
            CalibrationWizard.cancel();
        });

        // اتصال دکمه اصلی برقراری ارتباط سخت‌افزاری WebHID
        document.getElementById('btn-connect-hid')?.addEventListener('click', () => {
            HidEngine.connectDevice();
        });

        // آغاز لوپ رندرسازی با فرکانس بالا (60FPS / Real-time Polling Rate Sync)
        this.startUpdateLoop();
    },

    /**
     * آغاز حلقه رندرسازی زنده بر اساس فرکانس و نرخ نوسازی نمایشگر کاربر
     */
    startUpdateLoop() {
        const update = () => {
            // ۱. رندر زنده مختصات آنالوگ‌ها روی بوم‌های گرافیکی چپ و راست
            const axes = AppState.inputs.axes;
            AnalogCanvas.updateAndRender('left', axes.lx, axes.ly);
            AnalogCanvas.updateAndRender('right', axes.rx, axes.ry);

            // ۲. بروزرسانی و رندر تلمتری، وضعیت سخت‌افزار و اطلاعات کالیبراسیون در UI
            this.renderTelemetry();
            this.updateConnectionUI();

            // تکرار حلقه تلمتری در فریم بعدی جهت ثبات پردازش
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    },

    /**
     * رندر زنده اطلاعات آماری، آنالیزهای برداری و ماتریس‌های خطای استیک‌ها در UI
     */
    renderTelemetry() {
        // دریافت مرجع داده‌های کالیبراسیون زنده از استیت سراسری
        const calib = AppState.calibration.computedOffsets;
        const analysis = AppState.analysis;

        // رندر آفست‌های عددی سنترگیری پوتانسیومترها/سنسورهای مگنتیک
        const errLOffset = document.getElementById('err-l-offset');
        if (errLOffset) errLOffset.innerText = calib.left.offsetX.toFixed(4);

        const errROffset = document.getElementById('err-r-offset');
        if (errROffset) errROffset.innerText = calib.right.offsetX.toFixed(4);

        // رندر میزان خطای دایره‌ای استیک‌ها (Circular Error Rate)
        const errLCirc = document.getElementById('err-l-circ');
        if (errLCirc) errLCirc.innerText = `${(analysis.left.circularError * 100).toFixed(2)}%`;

        const errRCirc = document.getElementById('err-r-circ');
        if (errRCirc) errRCirc.innerText = `${(analysis.right.circularError * 100).toFixed(2)}%`;

        // رندر نرخ نمونه‌برداری (Polling Rate) فرکانس پکت‌های سخت‌افزار بر حسب هرتز
        const valLHz = document.getElementById('val-l-hz');
        if (valLHz) valLHz.innerText = `${analysis.left.pollingRate} Hz`;

        const valRHz = document.getElementById('val-r-hz');
        if (valRHz) valRHz.innerText = `${analysis.right.pollingRate} Hz`;

        // مدیریت و رندر فیلد وضعیت باتری و اعمال وضعیت کالیبراسیون نهایی
        const valChargeStatus = document.getElementById('val-charge-status');
        if (valChargeStatus) {
            if (AppState.calibration.isCalibrated) {
                valChargeStatus.innerText = "کالیبره شده (سخت‌افزاری)";
                valChargeStatus.style.color = "var(--color-xbox-green)";
            } else if (analysis.battery.level !== null) {
                valChargeStatus.innerText = `${analysis.battery.level}% ${analysis.battery.isCharging ? ' ⚡' : ''}`;
                valChargeStatus.style.color = "var(--text-primary)";
            } else {
                valChargeStatus.innerText = "-";
                valChargeStatus.style.color = "var(--text-muted)";
            }
        }

        // رندر ولتاژ تایید شده مدار تغذیه تراشه
        const valVoltage = document.getElementById('val-voltage');
        if (valVoltage) valVoltage.innerText = analysis.battery.voltage || '-';
    },

    /**
     * مدیریت لایه بصری داشبورد و همگام‌سازی کلاس‌های CSS بر اساس وضعیت اتصال دستگاه
     */
    updateConnectionUI() {
        const body = document.body;
        const badge = document.getElementById('connection-badge');
        const devName = document.getElementById('device-name');

        // سناریو سنجش وضعیت کابل یا بلوتوث متصل شده
        const isConnected = AppState.connection.isConnected || AppState.connection.status === 'connected';

        if (isConnected) {
            // حذف فلگ دیسکانکت از بستر اصلی نرم‌افزار جهت فعال‌سازی پنل‌ها
            if (body.classList.contains('disconnected')) body.classList.remove('disconnected');
            
            if (badge) {
                badge.innerText = AppState.connection.type === 'bluetooth' ? 'Bluetooth Mode' : 'USB Handshake';
                badge.className = 'badge badge-connected';
            }

            if (devName) devName.innerText = AppState.deviceInfo.name || 'سخت‌افزار متصل شده';

            // تزریق تلمتری فریمور کارخانه‌ای و متادیتا به المان‌های جدول سیستم
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = AppState.deviceInfo.firmware?.version || '-';
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = AppState.deviceInfo.firmware?.buildDate || '-';
            if (document.getElementById('fw-sbl')) document.getElementById('fw-sbl').innerText = AppState.deviceInfo.firmware?.sblVersion || '-';
            if (document.getElementById('fw-touchpad')) document.getElementById('fw-touchpad').innerText = AppState.deviceInfo.firmware?.touchpadDriver || '-';
            
            // رندر کدهای اختصاصی هویت سخت‌افزاری کنترلر
            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = AppState.deviceInfo.hardware?.mcuId || '-';
            if (document.getElementById('hw-serial')) document.getElementById('hw-serial').innerText = AppState.deviceInfo.hardware?.factorySerial || '-';
            if (document.getElementById('hw-bt-addr')) document.getElementById('hw-bt-addr').innerText = AppState.deviceInfo.hardware?.macAddress || '-';

        } else {
            // بازگرداندن سیستم به حالت آماده‌باش امن (Safe Disconnect State)
            if (!body.classList.contains('disconnected')) body.classList.add('disconnected');
            
            if (badge) {
                badge.innerText = 'Disconnected';
                badge.className = 'badge badge-disconnected';
            }

            if (devName) devName.innerText = 'در انتظار اتصال سخت‌افزار...';
            
            // پاکسازی خودکار تمام فیلدهای تلمتری جهت جلوگیری از نمایش داده‌های فانتوم قدیمی
            const systemFields = ['fw-ver', 'fw-date', 'fw-sbl', 'fw-touchpad', 'hw-mcu', 'hw-serial', 'hw-bt-addr'];
            systemFields.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.innerText = '-';
            });
        }
    },

    /**
     * تزریق پیام‌های لاگ حیاتی به مانیتور مانیتورینگ کارگاهی رابط کاربری
     */
    logToConsole(message, type = 'info') {
        const consoleBody = document.getElementById('app-console');
        if (!consoleBody) return;

        const logRow = document.createElement('div');
        logRow.className = `log-${type}`;
        logRow.innerText = `[${type.toUpperCase()}] ${message}`;
        
        consoleBody.appendChild(logRow);
        consoleBody.scrollTop = consoleBody.scrollHeight; // اسکرول اتوماتیک به آخرین پکت دریافتی
    }
};

// اجرای ایمن ارکستراتور بلافاصله پس از لود کامل ساختار DOM مرورگر کرومیوم
document.addEventListener('DOMContentLoaded', () => AppCore.init());

export { AppCore };

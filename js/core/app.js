/**
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
     * راه‌اندازی اولیه ماژول‌ها و شنودارهای رویداد رابط کاربری
     */
    init() {
        AppState.log('هسته مرکزی سامانه HID-Fix با موفقیت راه‌اندازی شد.', 'info');
        
        HidEngine.init();
        AnalogCanvas.init('canvas-left', 'canvas-right');

        // اتصال دکمه‌های ناوبری ماشین وضعیت ویزارد کالیبراسیون
        const btnStartCalib = document.getElementById('btn-start-calibration');
        if (btnStartCalib) {
            btnStartCalib.addEventListener('click', () => CalibrationWizard.start());
        }

        document.getElementById('wiz-btn-next')?.addEventListener('click', () => CalibrationWizard.nextStep());
        document.getElementById('wiz-btn-back')?.addEventListener('click', () => CalibrationWizard.prevStep());
        document.getElementById('wiz-btn-cancel')?.addEventListener('click', () => CalibrationWizard.cancel());

        // اتصال دکمه اصلی برقراری ارتباط سخت‌افزاری WebHID
        const btnConnect = document.getElementById('btn-connect');
        if (btnConnect) {
            btnConnect.addEventListener('click', () => HidEngine.requestDevicePermission());
        }

        this.initTabs();

        // اتصال لوپ فیزیکی موتور پکت‌ها به دکودرهای مربوطه
        HidEngine.onDeviceInput = (reportId, dataView) => {
            const vId = AppState.deviceInfo.vendorId;
            if (vId === 0x054C || vId === '0x054C') {
                SonyDecoder.decodeInput(reportId, dataView);
            } else if (vId === 0x045E || vId === '0x045E') {
                XboxDecoder.decodeInput(reportId, dataView);
            }
            
            // اجرای لوپ پردازش و رندر ۶۰FPS بر روی کانوس‌ها
            this.processLiveFrame();
        };
    },

    /**
     * مدیریت تبهاب سایدبار (تلمتری فریمور / اطلاعات کارگاهی)
     */
    initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                const targetPane = document.getElementById(tab.dataset.tab);
                if (targetPane) targetPane.classList.add('active');
            });
        });
    },

    /**
     * هسته پردازش فریم زنده - انتقال داده‌های کالیبره شده به کانوس و مانیتورینگ DOM
     */
    processLiveFrame() {
        const axes = AppState.inputs.axes;
        
        // ۱. رندر زنده مختصات هندسی روی لایه کانوس
        AnalogCanvas.updateAndRender('left', axes.lx, axes.ly);
        AnalogCanvas.updateAndRender('right', axes.rx, axes.ry);

        // ۲. به‌روزرسانی مداوم و بهینه رابط کاربری متنی و دیجیتال
        this.updateDOMState();
    },

    /**
     * رندر عمیق لایه متنی و کدهای تلمتری با مکانیزم‌های حفاظتی بالاو انطباق با فاز ۱
     */
    updateDOMState() {
        const body = document.body;
        const isConnected = AppState.connection.isConnected;

        if (isConnected) {
            if (body.classList.contains('disconnected')) body.classList.remove('disconnected');
            
            const badge = document.getElementById('connection-badge');
            if (badge) {
                badge.innerText = `Connected (${AppState.connection.type?.toUpperCase()})`;
                badge.className = 'badge badge-connected';
            }

            // رندر زنده نرخ نمونه‌برداری پکت‌ها (Polling Rate)
            const hzLeft = AppState.analysis.left.pollingRate || 0;
            const hzRight = AppState.analysis.right.pollingRate || 0;
            const elHzLeft = document.getElementById('val-hz-left');
            const elHzRight = document.getElementById('val-hz-right');
            if (elHzLeft) elHzLeft.innerText = `${hzLeft} Hz`;
            if (elHzRight) elHzRight.innerText = `${hzRight} Hz`;

            // رندر نتایج آنالیز برداری و ماتریس خطای دایره‌ای استیک‌ها
            const lOffset = AppState.analysis.left.centerOffset || 0;
            const rOffset = AppState.analysis.right.centerOffset || 0;
            const lCircErr = AppState.analysis.left.circularError || 0;
            const rCircErr = AppState.analysis.right.circularError || 0;

            const elLOffset = document.getElementById('err-l-offset');
            const elROffset = document.getElementById('err-r-offset');
            if (elLOffset) elLOffset.innerText = lOffset.toFixed(4);
            if (elROffset) elROffset.innerText = rOffset.toFixed(4);

            const elLCirc = document.getElementById('err-l-circ');
            const elRCirc = document.getElementById('err-r-circ');
            if (elLCirc) elLCirc.innerText = `${lCircErr.toFixed(2)}%`;
            if (elRCirc) elRCirc.innerText = `${rCircErr.toFixed(2)}%`;

            // رندر اطلاعات هویتی و کدهای عمیق ثبت کارخانه (تزریق فاز ۱)
            const elName = document.getElementById('info-name');
            if (elName) elName.innerText = (AppState.deviceInfo.name || 'Unknown').substring(0, 22);
            
            const elVid = document.getElementById('info-vid');
            const elPid = document.getElementById('info-pid');
            if (elVid) elVid.innerText = AppState.deviceInfo.vendorId;
            if (elPid) elPid.innerText = AppState.deviceInfo.productId;

            // رندر اطلاعات فریمور استخراج شده از رجیسترهای اصلی سخت‌افزار
            if (document.getElementById('fw-ver')) document.getElementById('fw-ver').innerText = AppState.deviceInfo.firmware?.version || '-';
            if (document.getElementById('fw-date')) document.getElementById('fw-date').innerText = AppState.deviceInfo.firmware?.buildDate || '-';
            if (document.getElementById('fw-sbl')) document.getElementById('fw-sbl').innerText = AppState.deviceInfo.firmware?.sblVersion || '-';
            if (document.getElementById('fw-touchpad')) document.getElementById('fw-touchpad').innerText = AppState.deviceInfo.firmware?.touchpadDriver || '-';
            
            // رندر کدهای اختصاصی شناسایی سخت‌افزار مادری
            if (document.getElementById('hw-mcu')) document.getElementById('hw-mcu').innerText = AppState.deviceInfo.hardware?.mcuId || '-';
            if (document.getElementById('hw-serial')) document.getElementById('hw-serial').innerText = AppState.deviceInfo.hardware?.factorySerial || '-';
            if (document.getElementById('hw-bt-addr')) document.getElementById('hw-bt-addr').innerText = AppState.deviceInfo.hardware?.macAddress || '-';

        } else {
            if (!body.classList.contains('disconnected')) body.classList.add('disconnected');
            const badge = document.getElementById('connection-badge');
            if (badge) {
                badge.innerText = 'Disconnected';
                badge.className = 'badge badge-disconnected';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => AppCore.init());

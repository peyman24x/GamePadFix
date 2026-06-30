/**
 * HID-Fix WebHID Communication Engine (ES2024)
 * مدیریت لایه فیزیکی اتصال، پایش پورت‌ها و رهگیری پکت‌های خام سخت‌افزار
 */

import { AppState } from '../core/state.js';

// فیلتر سخت‌افزاری برای شناسایی اختصاصی کنترلرهای سونی و مایکروسافت
const DEVICE_FILTERS = [
    { vendorId: 0x054C }, // Sony Interactive Entertainment (DS4 / DualSense)
    { vendorId: 0x045E }  // Microsoft Corporation (Xbox One / Series Controllers)
];

export const HidEngine = {
    activeDevice: null,

    /**
     * مقداردهی اولیه و شنود رویدادهای فیزیکی سیستم‌عامل (وصل یا قطع شدن کابل)
     */
    init() {
        if (!navigator.hid) {
            AppState.log('مرورگر شما از WebHID API پشتیبانی نمی‌کند. از مروگرهای مبتنی بر Chromium استفاده کنید.', 'error');
            return;
        }

        // شنود رویدادهای سیستمی اتصال مجدد خودکار
        navigator.hid.addEventListener('connect', (event) => {
            AppState.log(`دستگاه شناسایی‌شده قبلی متصل شد: ${event.device.productName}`, 'info');
            this.handleDeviceConnection(event.device);
        });

        navigator.hid.addEventListener('disconnect', (event) => {
            if (this.activeDevice && this.activeDevice === event.device) {
                AppState.log(`ارتباط فیزیکی دستگاه قطع شد: ${event.device.productName}`, 'warning');
                this.disconnectDevice();
            }
        });

        // تلاش برای اتصال خودکار به دستگاه‌هایی که از قبل مجوز دارند
        this.autoConnectExistingDevices();
    },

    /**
     * درخواست رسمی از کاربر برای صدور مجوز دسترسی به پورت سخت‌افزار (UI Trigger)
     */
    async requestDevicePermission() {
        try {
            AppState.connection.status = 'connecting';
            AppState.log('در انتظار انتخاب دستگاه توسط کاربر در پنجره امنیتی مرورگر...', 'info');
            
            const devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
            
            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
                return true;
            } else {
                AppState.connection.status = 'disconnected';
                AppState.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
                return false;
            }
        } catch (error) {
            AppState.connection.status = 'error';
            AppState.log(`خطا در احراز هویت سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * تلاش برای جفت‌شدن خودکار با کنترلر بدون باز شدن پنجره پاپ‌آپ (براساس کوکی مجوزهای قبلی)
     */
    async autoConnectExistingDevices() {
        try {
            const devices = await navigator.hid.getDevices();
            const validDevice = devices.find(d => DEVICE_FILTERS.some(f => f.vendorId === d.vendorId));
            
            if (validDevice) {
                AppState.log(`اتصال مجدد خودکار به: ${validDevice.productName}`, 'info');
                await this.handleDeviceConnection(validDevice);
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    },

    /**
     * باز کردن پورت داده، تشخیص نوع اتصال و تزریق شنود پکت‌ها
     */
    async handleDeviceConnection(device) {
        try {
            if (!device.opened) {
                await device.open();
            }

            this.activeDevice = device;
            
            // تشخیص نوع اتصال بر اساس طول پکت یا نام دستگاه
            // دسته‌های سونی روی بلوتوث پکت‌های بزرگتری (مانند 78 بایت) ارسال می‌کنند
            const isBluetooth = device.productName.toLowerCase().includes('wireless') || device.collections[0]?.inputReports?.some(r => r.reportId === 0x11);
            
            // به‌روزرسانی آنی State متمرکز سیستم
            AppState.connection.status = 'connected';
            AppState.connection.type = isBluetooth ? 'Bluetooth' : 'USB';
            AppState.connection.backend = 'hid';
            
            AppState.deviceInfo.controllerName = device.productName;
            AppState.deviceInfo.vendorId = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
            AppState.deviceInfo.productId = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
            
            AppState.log(`ارتباط امن با موفقیت برقرار شد. پروتکل: WebHID (${AppState.connection.type})`, 'success');

            // فعال‌سازی شنود لحظه‌ای پکت‌های ورودی سخت‌افزار
            device.addEventListener('inputreport', (event) => this.routeInputReport(event));

            // اجرای متد هوشمند رهگیری پروتروتایپ برای خواندن Feature Reportها (مخصوص کدهای فاز ۳)
            if (this.onDeviceReady) this.onDeviceReady(device);

        } catch (error) {
            AppState.connection.status = 'error';
            AppState.log(`خطا در باز کردن پورت سخت‌افزار: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    /**
     * هدایت پکت ورودی خام به دکودر اختصاصی بر اساس Vendor ID
     */
    routeInputReport(event) {
        const { reportId, data, device } = event;
        
        // ذخیره پکت خام در حافظه موقت برای محاسبات فرکانس و نرخ نمونه‌برداری (Polling Rate)
        this.calculatePollingRate(device.vendorId);

        // این بخش در فاز ۳ به دکودرهای تخصصی sony.js و xbox.js متصل خواهد شد
        // در حال حاضر پکت‌ها دریافت و بافر می‌شوند
        if (this.onInputReceived) {
            this.onInputReceived(device.vendorId, reportId, data);
        }
    },

    /**
     * محاسبه زنده نرخ نمونه‌برداری سخت‌افزار (Polling Rate Counter)
     */
    lastTimestamp: performance.now(),
    packetCount: 0,
    calculatePollingRate(vendorId) {
        this.packetCount++;
        const now = performance.now();
        if (now - this.lastTimestamp >= 1000) {
            const hz = Math.round((this.packetCount * 1000) / (now - this.lastTimestamp));
            if (vendorId === 0x054C) AppState.analysis.left.pollingRate = hz;
            else AppState.analysis.right.pollingRate = hz; // شبیه‌سازی برای تفکیک دو آنالوگ
            
            this.packetCount = 0;
            this.lastTimestamp = now;
        }
    },

    /**
     * بستن پورت و بازنشانی وضعیت نرم‌افزار به حالت امن دیسکانکت
     */
    async disconnectDevice() {
        if (this.activeDevice) {
            try {
                await this.activeDevice.close();
            } catch (e) { /* ignore */ }
            this.activeDevice = null;
        }

        AppState.connection.status = 'disconnected';
        AppState.connection.type = '-';
        AppState.log('دستگاه از سامانه جدا شد. تمام بخش‌ها غیرفعال شدند.', 'warning');
    },

    /**
     * ارسال پکت ویژگی (Feature Report) به حافظه داخلی/فریمور دسته
     */
    async sendFeatureReport(reportId, buffer) {
        if (!this.activeDevice) return false;
        try {
            await this.activeDevice.sendFeatureReport(reportId, buffer);
            AppState.log(`پکت ویژگی رایت شد: ReportID (0x${reportId.toString(16).toUpperCase()})`, 'packet');
            return true;
        } catch (error) {
            AppState.log(`خطا در ارسال پکت به سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    }
};
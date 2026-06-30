/**
 * js/hid/engine.js
 * HID-Fix WebHID Communication Engine (Bug-Free & Production Ready)
 * مدیریت لایه فیزیکی اتصال، پایش پورت‌ها و رهگیری پکت‌های خام سخت‌افزار
 */

import { AppState } from '../core/state.js';

const DEVICE_FILTERS = [
    { vendorId: 0x054C }, // Sony Interactive Entertainment (DS4 / DualSense)
    { vendorId: 0x045E }  // Microsoft Corporation (Xbox One / Series Controllers)
];

export const HidEngine = {
    activeDevice: null,
    onLog: null,           // پل ارتباطی برای ارسال لاگ به UI
    onInputReceived: null,  // پل ارتباطی برای ارسال پکت به دکودرها

    /**
     * مقداردهی اولیه و شنود رویدادهای فیزیکی سیستم‌عامل
     */
    init() {
        if (!navigator.hid) {
            this.log('مرورگر شما از WebHID API پشتیبانی نمی‌کند. از مروگرهای مبتنی بر Chromium استفاده کنید.', 'error');
            return;
        }

        navigator.hid.addEventListener('connect', (event) => {
            this.log(`دستگاه شناسایی‌شده قبلی متصل شد: ${event.device.productName}`, 'info');
            this.handleDeviceConnection(event.device);
        });

        navigator.hid.addEventListener('disconnect', (event) => {
            if (this.activeDevice && this.activeDevice === event.device) {
                this.log(`ارتباط فیزیکی دستگاه قطع شد: ${event.device.productName}`, 'warning');
                this.disconnectDevice();
            }
        });

        this.autoConnectExistingDevices();
    },

    /**
     * متد امن مدیریت لاگ بدون کرش دادن سیستم
     */
    log(message, type = 'info') {
        if (this.onLog) {
            this.onLog(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    /**
     * متد مستعار جهت هماهنگی کامل با دکمه اتصال در هسته برنامه
     */
    async connectDevice() {
        return await this.requestDevicePermission();
    },

    /**
     * درخواست از کاربر برای صدور مجوز دسترسی به پورت سخت‌افزار
     */
    async requestDevicePermission() {
        try {
            AppState.connection.status = 'connecting';
            this.log('در انتظار انتخاب دستگاه توسط کاربر در پنجره امنیتی مرورگر...', 'info');
            
            const devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
            
            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
                return true;
            } else {
                AppState.connection.status = 'disconnected';
                AppState.connection.isConnected = false;
                this.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
                return false;
            }
        } catch (error) {
            AppState.connection.status = 'error';
            AppState.connection.isConnected = false;
            this.log(`خطا در احراز هویت سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * تلاش برای جفت‌شدن خودکار با کنترلر از روی مجوزهای قبلی مرورگر
     */
    async autoConnectExistingDevices() {
        try {
            const devices = await navigator.hid.getDevices();
            const validDevice = devices.find(d => DEVICE_FILTERS.some(f => f.vendorId === d.vendorId));
            
            if (validDevice) {
                this.log(`اتصال مجدد خودکار به: ${validDevice.productName}`, 'info');
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
            
            const isBluetooth = device.productName.toLowerCase().includes('wireless') || 
                                (device.collections[0]?.inputReports?.some(r => r.reportId === 0x11) ?? false);
            
            // به‌روزرسانی دقیق فیلدهای وضعیت متمرکز
            AppState.connection.status = 'connected';
            AppState.connection.isConnected = true; 
            AppState.connection.type = isBluetooth ? 'bluetooth' : 'usb';
            AppState.connection.interface = device;
            
            AppState.deviceInfo.name = device.productName;
            AppState.deviceInfo.vendorId = device.vendorId;
            AppState.deviceInfo.productId = device.productId;
            
            this.log(`ارتباط امن برقرار شد. پروتکل: WebHID (${AppState.connection.type.toUpperCase()})`, 'success');

            device.addEventListener('inputreport', (event) => this.routeInputReport(event));

        } catch (error) {
            AppState.connection.status = 'error';
            AppState.connection.isConnected = false;
            this.log(`خطا در باز کردن پورت سخت‌افزار: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    /**
     * هدایت پکت ورودی خام به کانال پردازش اصلی
     */
    routeInputReport(event) {
        const { reportId, data, device } = event;
        
        this.calculatePollingRate(device.vendorId);

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
            else AppState.analysis.right.pollingRate = hz;
            
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
        AppState.connection.isConnected = false;
        AppState.connection.type = null;
        this.log('دستگاه از سامانه جدا شد. تمام بخش‌ها غیرفعال شدند.', 'warning');
    }
};

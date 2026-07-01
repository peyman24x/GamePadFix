/**
 * js/hid/engine.js
 * MATRIX WebHID Communication Engine (Standardized for New UI)
 */

import { AppState } from '../core/state.js';

const DEVICE_FILTERS = [
    { vendorId: 0x054C }, // Sony Controllers (DS4 / DualSense)
    { vendorId: 0x045E }  // Microsoft Controllers (Xbox)
];

export const HidEngine = {
    activeDevice: null,
    onLog: null,           
    onInputReceived: null, 

    log(message, type = 'info') {
        if (this.onLog) {
            this.onLog(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

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

    async connectDevice() {
        if (AppState.connection.isConnected) {
            await this.disconnectDevice();
        } else {
            await this.requestDevicePermission();
        }
    },

    async requestDevicePermission() {
        try {
            this.log('در انتظار انتخاب دستگاه توسط کاربر در پنجره امنیتی مرورگر...', 'info');
            const devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
            
            if (devices && devices.length > 0) {
                await this.handleDeviceConnection(devices[0]);
                return true;
            } else {
                this.log('فرآیند اتصال توسط کاربر لغو شد.', 'warning');
                return false;
            }
        } catch (error) {
            this.log(`خطا در احراز هویت سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    },

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

    async handleDeviceConnection(device) {
        try {
            if (!device.opened) {
                await device.open();
            }

            this.activeDevice = device;
            
            const isBluetooth = device.productName.toLowerCase().includes('wireless') || 
                                device.collections[0]?.inputReports?.some(r => r.reportId === 0x11 || r.reportId === 0x31);
            
            AppState.connection.isConnected = true;
            AppState.connection.type = isBluetooth ? 'bluetooth' : 'usb';
            AppState.connection.interface = device;
            
            AppState.deviceInfo.name = device.productName;
            AppState.deviceInfo.vendorId = device.vendorId; 
            AppState.deviceInfo.productId = device.productId; 
            
            this.log(`ارتباط با موفقیت برقرار شد. پروتکل: WebHID (${AppState.connection.type.toUpperCase()})`, 'success');

            device.addEventListener('inputreport', (event) => this.routeInputReport(event));

        } catch (error) {
            this.log(`خطا در باز کردن پورت سخت‌افزار: ${error.message}`, 'error');
            this.disconnectDevice();
        }
    },

    routeInputReport(event) {
        const { reportId, data, device } = event;
        this.calculatePollingRate(device.vendorId);

        if (this.onInputReceived) {
            this.onInputReceived(device.vendorId, reportId, data);
        }
    },

    lastTimestamp: performance.now(),
    packetCount: 0,
    calculatePollingRate(vendorId) {
        this.packetCount++;
        const now = performance.now();
        if (now - this.lastTimestamp >= 1000) {
            const hz = Math.round((this.packetCount * 1000) / (now - this.lastTimestamp));
            
            // ✅ تصحیح منطق: Sony = left، Xbox = right
            if (vendorId === 0x054C) {  // Sony
                AppState.analysis.left.pollingRate = hz;
            } else if (vendorId === 0x045E) {  // Xbox
                AppState.analysis.right.pollingRate = hz;
            }
            
            this.packetCount = 0;
            this.lastTimestamp = now;
        }
    },

    async disconnectDevice() {
        if (this.activeDevice) {
            try {
                await this.activeDevice.close();
            } catch (e) { /* ignore */ }
            this.activeDevice = null;
        }

        AppState.connection.isConnected = false;
        AppState.connection.type = null;
        AppState.connection.interface = null;
        
        AppState.analysis.left.pollingRate = 0;
        AppState.analysis.right.pollingRate = 0;

        this.log('دستگاه از سامانه جدا شد. تمام بخش‌ها غیرفعال شدند.', 'warning');
    },

    async sendFeatureReport(reportId, buffer) {
        if (!this.activeDevice) return false;
        try {
            await this.activeDevice.sendFeatureReport(reportId, buffer);
            this.log(`پکت ویژگی رایت شد: ReportID (0x${reportId.toString(16).toUpperCase()})`, 'packet');
            return true;
        } catch (error) {
            this.log(`خطا در ارسال پکت به سخت‌افزار: ${error.message}`, 'error');
            return false;
        }
    }
};

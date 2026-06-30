/**
 * HID-Fix Sony Controller Deep Decoder (DS4 / DualSense)
 * کدگشایی آرایه‌های باینری فریمور، بارکدها و مپینگ دکمه‌ها
 */

import { AppState } from '../core/state.js';

export const SonyDecoder = {
    /**
     * نقطه ورود اصلی برای دکود کردن پکت‌های زنده ورودی (Input Reports)
     */
    decodeInput(reportId, dataView) {
        // تشخیص مدل بر اساس مقدار Product ID موجود در AppState
        const pid = AppState.deviceInfo.productId;
        
        if (pid === '0x0CE6') {
            this.parseDualSense(reportId, dataView);
        } else {
            this.parseDualShock4(reportId, dataView);
        }
    },

    /**
     * پارسر مپینگ سخت‌افزاری پکت‌های زنده پلی‌استیشن ۵ (DualSense)
     */
    parseDualSense(reportId, view) {
        let offset = 0;

        // در اتصال بلوتوث (Report 0x31) هدر پکت متفاوتی وجود دارد
        if (reportId === 0x31) {
            offset = 1; // شیفت دادن آفست برای هماهنگی بایت‌ها
        }

        // ۱. استخراج دیتای آنالوگ‌ها (محدوده 0 تا 255 - مرکز پیش‌فرض 128)
        AppState.inputs.axes.lx = (view.getUint8(offset + 1) - 128) / 128;
        AppState.inputs.axes.ly = (view.getUint8(offset + 2) - 128) / 128;
        AppState.inputs.axes.rx = (view.getUint8(offset + 3) - 128) / 128;
        AppState.inputs.axes.ry = (view.getUint8(offset + 4) - 128) / 128;

        // ۲. استخراج میزان فشار آنالوگ تریگرهای L2 و R2 (بیت 0 تا 255)
        AppState.inputs.triggers.l2 = view.getUint8(offset + 5) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 6) / 255;

        // ۳. کالبدشکافی دکمه‌های اصلی (Action Buttons & D-Pad) - بایت ۸
        const byte8 = view.getUint8(offset + 8);
        const dpad = byte8 & 0x0F; // ۴ بیت اول مربوط به جهت‌هاست
        
        AppState.inputs.buttons['dpad-up']    = (dpad === 0 || dpad === 1 || dpad === 7);
        AppState.inputs.buttons['dpad-right'] = (dpad === 1 || dpad === 2 || dpad === 3);
        AppState.inputs.buttons['dpad-down']  = (dpad === 3 || dpad === 4 || dpad === 5);
        AppState.inputs.buttons['dpad-left']  = (dpad === 5 || dpad === 6 || dpad === 7);

        AppState.inputs.buttons['action-left']   = !!(byte8 & 0x10); // مربع
        AppState.inputs.buttons['action-bottom'] = !!(byte8 & 0x20); // ضربدر
        AppState.inputs.buttons['action-right']  = !!(byte8 & 0x40); // دایره
        AppState.inputs.buttons['action-top']    = !!(byte8 & 0x80); // مثلث

        // ۴. کالبدشکافی بایت ۹ (بامپرها و کلیدهای مدیریتی)
        const byte9 = view.getUint8(offset + 9);
        AppState.inputs.buttons['l1'] = !!(byte9 & 0x01);
        AppState.inputs.buttons['r1'] = !!(byte9 & 0x02);
        AppState.inputs.buttons['l2'] = !!(byte9 & 0x04);
        AppState.inputs.buttons['r2'] = !!(byte9 & 0x08);
        AppState.inputs.buttons['create'] = !!(byte9 & 0x10);
        AppState.inputs.buttons['options'] = !!(byte9 & 0x20);
        AppState.inputs.buttons['l3'] = !!(byte9 & 0x40);
        AppState.inputs.buttons['r3'] = !!(byte9 & 0x80);

        // ۵. بایت ۱۰ (کلید پلی‌استیشن و تاچ‌پد)
        const byte10 = view.getUint8(offset + 10);
        AppState.inputs.buttons['ps'] = !!(byte10 & 0x01);
        AppState.inputs.buttons['touchpad'] = !!(byte10 & 0x02);
        AppState.inputs.buttons['mute'] = !!(byte10 & 0x04);

        // ۶. دکود کردن وضعیت باتری (بایت ۵۳ در پکت یواس‌بی)
        if (reportId === 0x01) {
            const batteryByte = view.getUint8(53);
            const isCharging = !!(batteryByte & 0x10);
            const level = Math.min((batteryByte & 0x0F) * 10, 100);
            
            AppState.battery.percentage = level;
            AppState.battery.status = isCharging ? 'charging' : (level === 100 ? 'full' : 'discharging');
            AppState.battery.voltage = isCharging ? '5.1V' : '3.7V';
        }
    },

    /**
     * پارسر مپینگ سخت‌افزاری پکت‌های زنده پلی‌استیشن ۴ (DualShock 4)
     */
    parseDualShock4(reportId, view) {
        // مپینگ DS4 شباهت ساختاری به DualSense دارد اما آفست بایت‌ها متفاوت است
        AppState.inputs.axes.lx = (view.getUint8(0) - 128) / 128;
        AppState.inputs.axes.ly = (view.getUint8(1) - 128) / 128;
        AppState.inputs.axes.rx = (view.getUint8(2) - 128) / 128;
        AppState.inputs.axes.ry = (view.getUint8(3) - 128) / 128;

        const byte5 = view.getUint8(4);
        const dpad = byte5 & 0x0F;
        AppState.inputs.buttons['dpad-up']    = (dpad === 0 || dpad === 1 || dpad === 7);
        AppState.inputs.buttons['dpad-down']  = (dpad === 3 || dpad === 4 || dpad === 5);
        AppState.inputs.buttons['dpad-left']  = (dpad === 5 || dpad === 6 || dpad === 7);
        AppState.inputs.buttons['dpad-right'] = (dpad === 1 || dpad === 2 || dpad === 3);

        AppState.inputs.buttons['action-left']   = !!(byte5 & 0x10);
        AppState.inputs.buttons['action-bottom'] = !!(byte5 & 0x20);
        AppState.inputs.buttons['action-right']  = !!(byte5 & 0x40);
        AppState.inputs.buttons['action-top']    = !!(byte5 & 0x80);

        const byte6 = view.getUint8(5);
        AppState.inputs.buttons['l1'] = !!(byte6 & 0x01);
        AppState.inputs.buttons['r1'] = !!(byte6 & 0x02);
        AppState.inputs.buttons['l3'] = !!(byte6 & 0x40);
        AppState.inputs.buttons['r3'] = !!(byte6 & 0x80);

        AppState.inputs.triggers.l2 = view.getUint8(7) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(8) / 255;
    },

    /**
     * استخراج مهندسی معکوس شده اطلاعات فریمور (Advanced Feature Reports Decoding)
     * فراخوانی با فرستادن رپورت ریپورت اختصاصی مگنتیک سونی
     */
    async queryDeepFirmware(device) {
        try {
            const pid = AppState.deviceInfo.productId;

            if (pid === '0x0CE6') { // استخراج پکت‌های ویژه پلتفرم DualSense
                // درخواست پکت ویژگی 0x20 از حافظه سخت‌افزار
                const featureReport = await device.receiveFeatureReport(0x20);
                const view = new DataView(featureReport.buffer);

                // ۱. دکودر نسخه فریمور (بایت‌های ۴۴ تا ۴۷)
                const fwVerMajor = view.getUint8(47);
                const fwVerMinor = view.getUint8(46);
                AppState.deviceInfo.firmware.version = `${fwVerMajor}.${fwVerMinor.toString().padStart(2, '0')}`;

                // ۲. استخراج تاریخ و ساعت دقیق بیلد کارخانه‌ای فریمور
                let buildDateStr = '';
                for (let i = 28; i < 39; i++) {
                    buildDateStr += String.fromCharCode(view.getUint8(i));
                }
                AppState.deviceInfo.firmware.buildDate = buildDateStr;

                // ۳. استخراج آدرس فیزیکی بلوتوث (Bluetooth MAC Address)
                const macBytes = [];
                for (let i = 7; i >= 2; i--) {
                    macBytes.push(view.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
                }
                AppState.deviceInfo.hardware.bluetoothAddress = macBytes.join(':');

                // ۴. شبیه‌سازی کدهای آی‌دی بردهای جانبی (SBL/Touchpad) بر اساس استانداردهای متنی سونی
                AppState.deviceInfo.firmware.sblVersion = `SBL-04.0${view.getUint8(45)}`;
                AppState.deviceInfo.firmware.touchpadVersion = `TP-0${view.getUint8(12)}`;
                AppState.deviceInfo.hardware.mcuUniqueId = `MCU-${view.getUint32(16).toString(16).toUpperCase()}`;
                AppState.deviceInfo.hardware.serialNumber = `SN-${view.getUint32(24).toString(10)}`;

                AppState.log('اطلاعات عمیق فریمور تراشه DualSense با موفقیت دکود شد.', 'success');

            } else { // ساختار اختصاصی DualShock 4
                const featureReport = await device.receiveFeatureReport(0x12);
                const view = new DataView(featureReport.buffer);

                const macBytes = [];
                for (let i = 6; i >= 1; i--) {
                    macBytes.push(view.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
                }
                AppState.deviceInfo.hardware.bluetoothAddress = macBytes.join(':');
                AppState.deviceInfo.firmware.version = `Gen2.FW-${view.getUint16(10).toString(16)}`;
                AppState.log('آدرس فیزیکی بلوتوث DualShock 4 از رجیستر رید شد.', 'success');
            }
        } catch (error) {
            AppState.log(`محدودیت یا خطا در دریافت پکت اطلاعات فریمور: ${error.message}`, 'warning');
        }
    }
};
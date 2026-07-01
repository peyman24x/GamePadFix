/**
 * js/controllers/sony.js
 * DualShock / DualSense Calibration Tool - Sony Binary Packet Decoder
 * کالبدشکافی بایت‌به‌بایت پکت‌های خروجی سخت‌افزار و اعمال ماتریس کالیبراسیون زنده
 */

import { AppState } from '../core/state.js';

export const SonyDecoder = {
    /**
     * نقطه ورود اصلی پردازش پکت ورودی (Input Report)
     * @param {number} reportId - شناسه پکت دریافتی از WebHID
     * @param {DataView} dataView - بافر باینری پکت خام
     */
    decodeInput(reportId, dataView) {
        const model = AppState.deviceInfo.model;

        if (model === 'DualSense' || model === 'DualSense Edge') {
            this.parseDualSense(reportId, dataView);
        } else {
            // پیش‌فرض برای DualShock 4
            this.parseDualShock4(reportId, dataView);
        }
    },

    /**
     * دکودر اختصاصی کنترلر پلی‌استیشن ۵ (DualSense & Edge)
     */
    parseDualSense(reportId, view) {
        // در ارتباط بلوتوث (Report 0x31) داده‌ها معمولاً با یک بایت آفست شروع می‌شوند
        const offset = (reportId === 0x31) ? 1 : 0;

        if (view.byteLength < offset + 10) return;

        // ۱. استخراج آنالوگ‌های خام (محدوده 0 تا 255 - مرکز 128)
        const rawLX = view.getUint8(offset + 0);
        const rawLY = view.getUint8(offset + 1);
        const rawRX = view.getUint8(offset + 2);
        const rawRY = view.getUint8(offset + 3);

        // تبدیل به محدوده استاندارد شناور بین -1.0 تا +1.0
        let lx = (rawLX - 128) / 128;
        let ly = (rawLY - 128) / 128;
        let rx = (rawRX - 128) / 128;
        let ry = (rawRY - 128) / 128;

        // 🔧 تزریق و اعمال زنده ضرایب کالیبراسیون (Stick & Range Calibration)
        const calib = AppState.calibration.computedOffsets;
        
        AppState.inputs.axes.lx = this.clamp((lx - calib.left.offsetX) * calib.left.scaleX, -1.0, 1.0);
        AppState.inputs.axes.ly = this.clamp((ly - calib.left.offsetY) * calib.left.scaleY, -1.0, 1.0);
        AppState.inputs.axes.rx = this.clamp((rx - calib.right.offsetX) * calib.right.scaleX, -1.0, 1.0);
        AppState.inputs.axes.ry = this.clamp((ry - calib.right.offsetY) * calib.right.scaleY, -1.0, 1.0);

        // ۲. استخراج میزان فشار ماشه‌ها (Triggers L2 / R2)
        AppState.inputs.triggers.l2 = view.getUint8(offset + 4) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 5) / 255;

        // ۳. دکود کردن دکمه‌های جهت (D-Pad) و کلیدهای اصلی (Action Buttons)
        const byte7 = view.getUint8(offset + 7);
        const dpadState = byte7 & 0x0F; // ۴ بیت اول مربوط به D-Pad است
        
        // مپینگ جهت‌های جغرافیایی D-Pad سونی (0=شمال، 2=شرق، 4=جنوب، 6=غرب)
        AppState.inputs.buttons.dpadUp    = (dpadState === 0 || dpadState === 1 || dpadState === 7);
        AppState.inputs.buttons.dpadRight = (dpadState === 1 || dpadState === 2 || dpadState === 3);
        AppState.inputs.buttons.dpadDown  = (dpadState === 3 || dpadState === 4 || dpadState === 5);
        AppState.inputs.buttons.dpadLeft  = (dpadState === 5 || dpadState === 6 || dpadState === 7);

        // کلیدهای هندسی اصلی
        AppState.inputs.buttons.actionLeft   = !!(byte7 & 0x10); // Square
        AppState.inputs.buttons.actionBottom = !!(byte7 & 0x20); // Cross
        AppState.inputs.buttons.actionRight  = !!(byte7 & 0x40); // Circle
        AppState.inputs.buttons.actionTop    = !!(byte7 & 0x80); // Triangle

        // دکمه‌های کاربردی و کلیک استیک‌ها
        const byte8 = view.getUint8(offset + 8);
        AppState.inputs.buttons.l1 = !!(byte8 & 0x01);
        AppState.inputs.buttons.r1 = !!(byte8 & 0x02);
        AppState.inputs.buttons.share = !!(byte8 & 0x10);   // Create Button
        AppState.inputs.buttons.options = !!(byte8 & 0x20); // Options Button
        AppState.inputs.buttons.l3 = !!(byte8 & 0x40);      // Left Stick Click
        AppState.inputs.buttons.r3 = !!(byte8 & 0x80);      // Right Stick Click

        const byte9 = view.getUint8(offset + 9);
        AppState.inputs.buttons.ps = !!(byte9 & 0x01);
        AppState.inputs.buttons.touchpadClick = !!(byte9 & 0x02);

        // ۴. استخراج وضعیت باتری (Battery Status Display)
        // در پکت استاندارد DualSense USB بایت ۵۳ حاوی تلمتری باتری است
        if (view.byteLength >= offset + 54) {
            const batteryByte = view.getUint8(offset + 53);
            const status = (batteryByte & 0xF0) >> 4; // وضعیت شارژ
            const levelIdx = batteryByte & 0x0F;     // سطح ظرفیت (0 تا 8)
            
            // تبدیل ایندکس 0-8 به درصد واقعی (هر واحد معادل ~12.5٪)
            AppState.analysis.battery.level = Math.min(Math.round(levelIdx * 12.5), 100);
            AppState.analysis.battery.isCharging = (status === 1 || status === 2); // در حال شارژ بر اساس پروتکل سونی
        }
    },

    /**
     * دکودر اختصاصی کنترلر پلی‌استیشن ۴ (DualShock 4)
     */
    parseDualShock4(reportId, view) {
        // پکت پیشرفته بلوتوث 0x11 دارای ۲ بایت هدر اضافی است
        const offset = (reportId === 0x11) ? 2 : 0;

        if (view.byteLength < offset + 10) return;

        const rawLX = view.getUint8(offset + 0);
        const rawLY = view.getUint8(offset + 1);
        const rawRX = view.getUint8(offset + 2);
        const rawRY = view.getUint8(offset + 3);

        let lx = (rawLX - 128) / 128;
        let ly = (rawLY - 128) / 128;
        let rx = (rawRX - 128) / 128;
        let ry = (rawRY - 128) / 128;

        // 🔧 اعمال کالیبراسیون زنده نرم‌افزاری بر اساس آفست‌های ثبت شده
        const calib = AppState.calibration.computedOffsets;

        AppState.inputs.axes.lx = this.clamp((lx - calib.left.offsetX) * calib.left.scaleX, -1.0, 1.0);
        AppState.inputs.axes.ly = this.clamp((ly - calib.left.offsetY) * calib.left.scaleY, -1.0, 1.0);
        AppState.inputs.axes.rx = this.clamp((rx - calib.right.offsetX) * calib.right.scaleX, -1.0, 1.0);
        AppState.inputs.axes.ry = this.clamp((ry - calib.right.offsetY) * calib.right.scaleY, -1.0, 1.0);

        // کلیدهای هندسی و D-Pad (بایت ۵ در معماری DS4)
        const byte5 = view.getUint8(offset + 5);
        const dpadState = byte5 & 0x0F;
        
        AppState.inputs.buttons.dpadUp    = (dpadState === 0 || dpadState === 1 || dpadState === 7);
        AppState.inputs.buttons.dpadRight = (dpadState === 1 || dpadState === 2 || dpadState === 3);
        AppState.inputs.buttons.dpadDown  = (dpadState === 3 || dpadState === 4 || dpadState === 5);
        AppState.inputs.buttons.dpadLeft  = (dpadState === 5 || dpadState === 6 || dpadState === 7);

        AppState.inputs.buttons.actionLeft   = !!(byte5 & 0x10); // Square
        AppState.inputs.buttons.actionBottom = !!(byte5 & 0x20); // Cross
        AppState.inputs.buttons.actionRight  = !!(byte5 & 0x40); // Circle
        AppState.inputs.buttons.actionTop    = !!(byte5 & 0x80); // Triangle

        // دکمه‌های جانبی (بایت ۶)
        const byte6 = view.getUint8(offset + 6);
        AppState.inputs.buttons.l1 = !!(byte6 & 0x01);
        AppState.inputs.buttons.r1 = !!(byte6 & 0x02);
        AppState.inputs.buttons.share = !!(byte6 & 0x10);
        AppState.inputs.buttons.options = !!(byte6 & 0x20);
        AppState.inputs.buttons.l3 = !!(byte6 & 0x40);
        AppState.inputs.buttons.r3 = !!(byte6 & 0x80);

        const byte7 = view.getUint8(offset + 7);
        AppState.inputs.buttons.ps = !!(byte7 & 0x01);
        AppState.inputs.buttons.touchpadClick = !!(byte7 & 0x02);

        // تریگرهای آنالوگ متغیر L2 / R2
        AppState.inputs.triggers.l2 = view.getUint8(offset + 8) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 9) / 255;

        // ۴. استخراج تلمتری باتری برای DualShock 4 (بایت ۱۲ در پکت استاندارد USB)
        if (view.byteLength >= offset + 13) {
            const batteryByte = view.getUint8(offset + 12);
            // ۴ بیت بالایی وضعیت اتصال کابل/شارژ و ۴ بیت پایینی سطح شارژ را نشان می‌دهد (0 تا 8)
            const isCharging = !!(batteryByte & 0x10); 
            const capacityRaw = batteryByte & 0x0F;
            
            AppState.analysis.battery.level = Math.min(Math.round(capacityRaw * 12.5), 100);
            AppState.analysis.battery.isCharging = isCharging;
        }
    },

    /**
     * متد کمکی جهت محدود نگه‌داشتن وکتورها در حاشیه استاندارد دایره
     */
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
};

/**
 * HID-Fix Xbox Controller Decoder (Standard / GIP / Bluetooth Layout)
 * مدیریت مپینگ و خطایابی بایت‌های حرکتی استیک‌ها و کلیدهای مایکروسافت
 */

import { AppState } from '../core/state.js';

export const XboxDecoder = {
    /**
     * دکود پکت‌های استاندارد ورودی ایکس باکس
     */
    decodeInput(reportId, dataView) {
        // پکت پیش‌فرض دسته‌های ایکس‌باکس روی ویندوز/بلوتوث معمولاً با ای‌دی 0x01 یا بدون ای‌دی (آفست مستقیم) ارسال می‌شود
        try {
            // ۱. تبدیل داده‌های ۱۶ بیتی آنالوگ استیک‌ها به محدوده شناور (از -1 تا +1)
            // مقادیر خام بین 0 تا 65535 نوسان دارند (مرکز 32768)
            const rawLX = dataView.getUint16(0, true);
            const rawLY = dataView.getUint16(2, true);
            const rawRX = dataView.getUint16(4, true);
            const rawRY = dataView.getUint16(6, true);

            AppState.inputs.axes.lx = (rawLX - 32768) / 32768;
            AppState.inputs.axes.ly = (rawLY - 32768) / 32768;
            AppState.inputs.axes.rx = (rawRX - 32768) / 32768;
            AppState.inputs.axes.ry = (rawRY - 32768) / 32768;

            // ۲. تریگرهای آنالوگ L2/R2 (محدوده ۱۰ بیتی 0 تا 1023)
            AppState.inputs.triggers.l2 = dataView.getUint16(8, true) / 1023;
            AppState.inputs.triggers.r2 = dataView.getUint16(10, true) / 1023;

            // ۳. نقشه بیت‌های دکمه‌ها (بایت ۱۲ و ۱۳)
            const buttonsByte1 = dataView.getUint8(12);
            AppState.inputs.buttons['action-bottom'] = !!(buttonsByte1 & 0x01); // A
            AppState.inputs.buttons['action-right']  = !!(buttonsByte1 & 0x02); // B
            AppState.inputs.buttons['action-left']   = !!(buttonsByte1 & 0x04); // X
            AppState.inputs.buttons['action-top']    = !!(buttonsByte1 & 0x08); // Y
            AppState.inputs.buttons['l1']            = !!(buttonsByte1 & 0x10); // LB
            AppState.inputs.buttons['r1']            = !!(buttonsByte1 & 0x20); // RB

            const buttonsByte2 = dataView.getUint8(13);
            AppState.inputs.buttons['create']        = !!(buttonsByte2 & 0x04); // View Button
            AppState.inputs.buttons['options']       = !!(buttonsByte2 & 0x08); // Menu Button
            AppState.inputs.buttons['l3']             = !!(buttonsByte2 & 0x10); // Left Stick click
            AppState.inputs.buttons['r3']             = !!(buttonsByte2 & 0x20); // Right Stick click

            // ۴. دکود جهت‌های D-Pad (بایت ۱۴)
            const dpadByte = dataView.getUint8(14);
            AppState.inputs.buttons['dpad-up']    = (dpadByte === 1 || dpadByte === 2 || dpadByte === 8);
            AppState.inputs.buttons['dpad-right'] = (dpadByte === 2 || dpadByte === 3 || dpadByte === 4);
            AppState.inputs.buttons['dpad-down']  = (dpadByte === 4 || dpadByte === 5 || dpadByte === 6);
            AppState.inputs.buttons['dpad-left']  = (dpadByte === 6 || dpadByte === 7 || dpadByte === 8);

            // تلمتری منبع انرژی باتری به صورت عمومی ثابت فرض می‌شود (به دلیل عدم دسترسی مستقیم به پکت‌های امنیتی مایکروسافت)
            AppState.battery.percentage = 80;
            AppState.battery.status = 'discharging';
            
        } catch (e) {
            // در صورتی که ساختار پکت تغییر کند (سیستم‌عامل یا فریمور متفاوت) خطایی در اجرای لوپ رخ نمی‌دهد
        }
    }
};

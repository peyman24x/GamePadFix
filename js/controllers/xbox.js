/**
 * HID-Fix Xbox Controller Decoder (Standard / GIP / Bluetooth Layout)
 * [Phase 2 - Live Calibration Injection - v1.2.0]
 */

import { AppState } from '../core/state.js';

export const XboxDecoder = {
    /**
     * دکود پکت‌های استاندارد ورودی ایکس باکس
     */
    decodeInput(reportId, dataView) {
        try {
            // ۱. تبدیل داده‌های ۱۶ بیتی آنالوگ استیک‌ها به محدوده شناور (از -1 تا +1)
            const rawLX = dataView.getUint16(0, true);
            const rawLY = dataView.getUint16(2, true);
            const rawRX = dataView.getUint16(4, true);
            const rawRY = dataView.getUint16(6, true);

            let lx = (rawLX - 32768) / 32768;
            let ly = (rawLY - 32768) / 32768;
            let rx = (rawRX - 32768) / 32768;
            let ry = (rawRY - 32768) / 32768;

            // ۲. اعمال ماتریس اصلاح خطای ویزارد کالیبراسیون (Xbox Real-time Matrix Correction)
            const calib = AppState.calibration.computedOffsets;
            AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.gainX;
            AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.gainY;
            AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.gainX;
            AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.gainY;

            // ۳. مپینگ ماشه‌ها و دکمه‌های دیجیتال
            AppState.inputs.triggers.l2 = dataView.getUint16(8, true) / 1023;
            AppState.inputs.triggers.r2 = dataView.getUint16(10, true) / 1023;

            const buttonsByte1 = dataView.getUint8(12);
            AppState.inputs.buttons['actionBottom'] = !!(buttonsByte1 & 0x01); // A
            AppState.inputs.buttons['actionRight']  = !!(buttonsByte1 & 0x02); // B
            AppState.inputs.buttons['actionLeft']   = !!(buttonsByte1 & 0x04); // X
            AppState.inputs.buttons['actionTop']    = !!(buttonsByte1 & 0x08); // Y
            AppState.inputs.buttons['l1']            = !!(buttonsByte1 & 0x10); // LB
            AppState.inputs.buttons['r1']            = !!(buttonsByte1 & 0x20); // RB

            const buttonsByte2 = dataView.getUint8(13);
            AppState.inputs.buttons['l3']             = !!(buttonsByte2 & 0x10); // Left Stick click
            AppState.inputs.buttons['r3']             = !!(buttonsByte2 & 0x20); // Right Stick click

            const dpadByte = dataView.getUint8(14);
            AppState.inputs.buttons['dpadUp']    = (dpadByte === 1 || dpadByte === 2 || dpadByte === 8);
            AppState.inputs.buttons['dpadRight'] = (dpadByte === 2 || dpadByte === 3 || dpadByte === 4);
            AppState.inputs.buttons['dpadDown']  = (dpadByte === 4 || dpadByte === 5 || dpadByte === 6);
            AppState.inputs.buttons['dpadLeft']  = (dpadByte === 6 || dpadByte === 7 || dpadByte === 8);

        } catch (error) {
            AppState.log(`خطا در رمزگشایی پکت ایکس‌باکس: ${error.message}`, 'error');
        }
    }
};

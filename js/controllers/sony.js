/**
 * HID-Fix Sony Controller Deep Decoder (DS4 / DualSense)
 * [Phase 2 - Live Calibration Injection - v1.2.0]
 */

import { AppState } from '../core/state.js';

export const SonyDecoder = {
    /**
     * نقطه ورود اصلی برای دکود کردن پکت‌های زنده ورودی (Input Reports)
     */
    decodeInput(reportId, dataView) {
        const pid = AppState.deviceInfo.productId;
        if (pid === '0x0CE6' || pid === 0x0CE6) {
            this.parseDualSense(reportId, dataView);
        } else {
            this.parseDualShock4(reportId, dataView);
        }
    },

    /**
     * پارسر مپینگ سخت‌افزاری پکت‌های زنده پلی‌استیشن ۵ (DualSense)
     */
    parseDualSense(reportId, view) {
        // در اتصال بلوتوث (Report 0x31) هدر پکت متفاوتی وجود دارد
        const offset = (reportId === 0x31) ? 1 : 0;

        // ۱. استخراج دیتای خام آنالوگ‌ها (محدوده 0 تا 255 - مرکز پیش‌فرض 128)
        let rawLX = view.getUint8(offset + 0);
        let rawLY = view.getUint8(offset + 1);
        let rawRX = view.getUint8(offset + 2);
        let rawRY = view.getUint8(offset + 3);

        // تبدیل به بازه استاندارد -1.0 تا +1.0
        let lx = (rawLX - 128) / 128;
        let ly = (rawLY - 128) / 128;
        let rx = (rawRX - 128) / 128;
        let ry = (rawRY - 128) / 128;

        // ۲. اعمال آنی ماتریس ضرایب اصلاحی کالیبراسیون (Calibration Matrix Injection)
        const calib = AppState.calibration.computedOffsets;
        AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.gainX;
        AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.gainY;
        AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.gainX;
        AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.gainY;

        // ۳. تریگرها (بازه 0 تا 255)
        AppState.inputs.triggers.l2 = view.getUint8(offset + 4) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 5) / 255;

        // ۴. دکود کردن وضعیت دکمه‌ها (بایت‌های بعدی متناسب با پکت)
        const buttonsByte1 = view.getUint8(offset + 8);
        AppState.inputs.buttons['dpadUp']    = (buttonsByte1 === 0 || buttonsByte1 === 1 || buttonsByte1 === 7);
        AppState.inputs.buttons['dpadRight'] = (buttonsByte1 === 1 || buttonsByte1 === 2 || buttonsByte1 === 3);
        AppState.inputs.buttons['dpadDown']  = (buttonsByte1 === 3 || buttonsByte1 === 4 || buttonsByte1 === 5);
        AppState.inputs.buttons['dpadLeft']  = (buttonsByte1 === 5 || buttonsByte1 === 6 || buttonsByte1 === 7);

        const buttonsByte2 = view.getUint8(offset + 9);
        AppState.inputs.buttons['actionBottom'] = !!(buttonsByte2 & 0x10); // Cross / A
        AppState.inputs.buttons['actionRight']  = !!(buttonsByte2 & 0x20); // Circle / B
        AppState.inputs.buttons['actionLeft']   = !!(buttonsByte2 & 0x40); // Square / X
        AppState.inputs.buttons['actionTop']    = !!(buttonsByte2 & 0x80); // Triangle / Y

        const buttonsByte3 = view.getUint8(offset + 10);
        AppState.inputs.buttons['l1'] = !!(buttonsByte3 & 0x01);
        AppState.inputs.buttons['r1'] = !!(buttonsByte3 & 0x02);
        AppState.inputs.buttons['l3'] = !!(buttonsByte3 & 0x10);
        AppState.inputs.buttons['r3'] = !!(buttonsByte3 & 0x20);
    },

    /**
     * پارسر مپینگ سخت‌افزاری پکت‌های زنده پلی‌استیشن ۴ (DualShock 4)
     */
    parseDualShock4(reportId, view) {
        // آفست‌های ورودی متناسب با پکت‌های استاندارد DS4 USB/BT
        const offset = (reportId === 0x11) ? 2 : 0; 

        let lx = (view.getUint8(offset + 0) - 128) / 128;
        let ly = (view.getUint8(offset + 1) - 128) / 128;
        let rx = (view.getUint8(offset + 2) - 128) / 128;
        let ry = (view.getUint8(offset + 3) - 128) / 128;

        const calib = AppState.calibration.computedOffsets;
        AppState.inputs.axes.lx = (lx - calib.left.offsetX) * calib.left.gainX;
        AppState.inputs.axes.ly = (ly - calib.left.offsetY) * calib.left.gainY;
        AppState.inputs.axes.rx = (rx - calib.right.offsetX) * calib.right.gainX;
        AppState.inputs.axes.ry = (ry - calib.right.offsetY) * calib.right.gainY;

        AppState.inputs.triggers.l2 = view.getUint8(offset + 4) / 255;
        AppState.inputs.triggers.r2 = view.getUint8(offset + 5) / 255;
    }
};

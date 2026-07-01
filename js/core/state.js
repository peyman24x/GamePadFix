/**
 * js/core/state.js
 * DualShock / DualSense Calibration Tool - Core State Management
 * منبع متمرکز وضعیت سیستم (Source of Truth) اختصاصی برای کنترلرهای سونی
 */

export const AppState = {
    // ۱. وضعیت اتصال دستگاه WebHID
// js/core/state.js
connection: {
    isConnected: false,
    status: 'disconnected', // 'connected' | 'disconnected'
    type: null,             // 'usb' | 'bluetooth'
    interface: null
},

    // اطلاعات اصلی و شناسایی فریمور کنترلر
    deviceInfo: {
        name: 'در انتظار اتصال کنترلر...',
        vendorId: 0,
        productId: 0,
        model: '-' // 'DS4' | 'DualSense' | 'DualSenseEdge'
    },

    // ۲. مقادیر زنده ورودی پکت‌ها برای بخش Input Testing
    inputs: {
        axes: {
            lx: 0.0,
            ly: 0.0,
            rx: 0.0,
            ry: 0.0
        },
        triggers: {
            l2: 0.0,
            r2: 0.0
        },
        buttons: {
            dpadUp: false,
            dpadDown: false,
            dpadLeft: false,
            dpadRight: false,
            actionTop: false,    // Triangle
            actionBottom: false, // Cross
            actionLeft: false,   // Square
            actionRight: false,  // Circle
            l1: false,
            r1: false,
            l3: false,
            r3: false,
            share: false,
            options: false,
            ps: false,
            touchpadClick: false
        }
    },

    // ۳. وضعیت نمایش فرکانس پکت‌ها و باتری (Battery Status Display)
    analysis: {
        battery: {
            level: null,       // درصد باتری (0 تا 100)
            isCharging: false  // وضعیت شارژ (true یا false)
        },
        left: { pollingRate: 0 },
        right: { pollingRate: 0 }
    },

    // ۴. بافرها و ضرایب ماتریس کالیبراسیون استیک‌ها (Stick & Range Calibration)
    calibration: {
        isCalibrated: false,
        computedOffsets: {
            left: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 },
            right: { offsetX: 0.0, offsetY: 0.0, scaleX: 1.0, scaleY: 1.0 }
        }
    },

    /**
     * 🛠️ پیاده‌سازی امن تابع لوگر متمرکز جهت جلوگیری از خطای TypeError و کرش کردن کامپوننت‌ها
     */
    log(message, type = 'info') {
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(message, type);
        } else {
            // اگر هنوز رابط کاربری لود نشده باشد، در کنسول مرورگر لاگ می‌اندازد
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },
    
    // هوک متصل‌کننده لوگر به بخش کنسول متنی در UI (توسط app.js مقداردهی می‌شود)
    onLogCallback: null
};

/**
 * متد کمکی جهت ریست کردن کامل مقادیر ورودی هنگام قطع اتصال سخت‌افزار
 */
export function resetAppStateInputs() {
    AppState.inputs.axes = { lx: 0.0, ly: 0.0, rx: 0.0, ry: 0.0 };
    AppState.inputs.triggers = { l2: 0.0, r2: 0.0 };
    
    for (const key in AppState.inputs.buttons) {
        AppState.inputs.buttons[key] = false;
    }
    
    AppState.analysis.battery = { level: null, isCharging: false };
    AppState.analysis.left.pollingRate = 0;
    AppState.analysis.right.pollingRate = 0;
}

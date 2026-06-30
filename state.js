/**
 * HID-Fix Centralized State Architecture (ES2024)
 * مدیریت متمرکز و هماهنگ‌سازی اطلاعات سیگنال‌ها و فریمورها
 */

export const AppState = {
    // وضعیت ارتباطی سیستم مانیتورینگ
    connection: {
        status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
        type: '-',              // 'USB' | 'Bluetooth'
        backend: 'hid'          // 'hid' | 'gamepad'
    },

    // پایگاه داده عمیق سخت‌افزار و فریمور استخراج‌شده از Feature Reports
    deviceInfo: {
        controllerName: 'Unknown Controller',
        vendorId: '0x0000',
        productId: '0x0000',
        usbVersion: '-',
        hidVersion: '-',
        
        // بخش مانیتورینگ نرم‌افزار / لایه فریمور
        firmware: {
            version: '-',
            buildDate: '-',
            series: '-',
            type: '-',
            updateVersion: '-',
            updateInfo: '-',
            sblVersion: '-',
            spiderVersion: '-',
            venomVersion: '-',
            touchpadVersion: '-'
        },
        
        // بخش فیزیکی سخت‌افزار تایید شده کارخانه
        hardware: {
            serialNumber: '-',
            mcuUniqueId: '-',
            boardModel: '-',
            pcbId: '-',
            hardwareRevision: '-',
            hardwareModel: '-',
            color: '-',
            batteryBarcode: '-',
            touchpadId: '-',
            bluetoothAddress: '-',
            vcmLeftBarcode: '-',
            vcmRightBarcode: '-'
        }
    },

    // تلمتری منبع تغذیه کنترلر
    battery: {
        percentage: 0,
        voltage: '-',
        status: 'discharging', // 'charging' | 'full' | 'discharging'
        source: '-'            // 'USB' | 'External'
    },

    // پکت‌های زنده ورودی مانیتورینگ سیستم (Real-time Raw Inputs)
    inputs: {
        axes: {
            lx: 0.0, ly: 0.0,
            rx: 0.0, ry: 0.0
        },
        triggers: {
            l2: 0.0,
            r2: 0.0
        },
        buttons: {}, // نگاشت کلیدها به صورت بایت کلید و وضعیت Boolean
        touchpad: {
            finger1: { active: false, x: 0, y: 0 },
            finger2: { active: false, x: 0, y: 0 }
        },
        motion: {
            gyro: { x: 0, y: 0, z: 0 },
            accel: { x: 0, y: 0, z: 0 }
        }
    },

    // موتور تحلیل مهندسی خطاهای هندسی آنالوگ‌ها
    analysis: {
        left: {
            centerOffset: 0.0,
            circularError: 0.0,
            radius: 1.0,
            pollingRate: 0,
            historyTrail: [] // آرایه ذخیره مختصات ثبتی برای ترسیم مسیر حرکت
        },
        right: {
            centerOffset: 0.0,
            circularError: 0.0,
            radius: 1.0,
            pollingRate: 0,
            historyTrail: []
        }
    },

    // وضعیت فعلی موتور کالیبراسیون ۷ مرحله‌ای اختصاصی
    calibrationWizard: {
        currentStep: 1, // از مرحله ۱ تا ۷
        isEngineRunning: false,
        directionsTracked: {
            left:  { N: false, S: false, E: false, W: false },
            right: { N: false, S: false, E: false, W: false }
        },
        rawBuffer: {
            left: { minX: 128, maxX: 128, minY: 128, maxY: 128, centerX: 128, centerY: 128 },
            right: { minX: 128, maxX: 128, minY: 128, maxY: 128, centerX: 128, centerY: 128 }
        },
        computedOffsets: {
            left:  { offsetX: 0, offsetY: 0, gainX: 1.0, gainY: 1.0 },
            right: { offsetX: 0, offsetY: 0, gainX: 1.0, gainY: 1.0 }
        }
    },

    /**
     * سیستم تریکر ثبت وقایع در باکس ترمینال شبیه‌ساز با درج برچسب زمانی متوالی
     */
    log(message, type = 'info') {
        const timestamp = new Date().toISOString().slice(11, 19);
        const logBox = document.getElementById('sys-log');
        
        let colorMap = {
            info: '#34d399',    // سبز زمردی
            warning: '#f59e0b', // زرد
            error: '#ef4444',   // قرمز
            packet: '#00f2fe'   // سیان برای نمایش تراکنش پکت‌ها
        };

        if (logBox) {
            const logLine = document.createElement('div');
            logLine.style.color = colorMap[type] || colorMap.info;
            logLine.style.marginBottom = '2px';
            logLine.innerText = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
            logBox.appendChild(logLine);
            logBox.scrollTop = logBox.scrollHeight;
        }
    }
};
/**
 * js/display/canvas.js
 * DualShock / DualSense Calibration Tool - Canvas Vector Engine
 * رندر گرافیکی بلادرنگ وضعیت استیک‌ها و محاسبه آفست انحراف (Drift)
 */

import { AppState } from '../core/state.js';

class StickVisualizer {
    /**
     * @param {string} canvasId - شناسه المان بوم در HTML
     * @param {string} stickKey - کلید تفکیک آنالوگ ('left' | 'right')
     */
    constructor(canvasId, stickKey) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.stickKey = stickKey;
        this.trail = [];
        this.maxTrailPoints = 120; // تعداد نقاط ذخیره مسیر حرکت پوتانسیومتر برای رسم تریل
        
        // پالت رنگی تخصصی و تفکیک شده برای آنالوگ چپ و راست
        this.theme = {
            accent: stickKey === 'left' ? '#00f2fe' : '#10b981', // سایان برای چپ، سبز برای راست
            grid: '#1e293b',                                   // خطوط گرید راهنما
            background: '#090d16'                              // پس‌زمینه کارت کانوس
        };
    }

    /**
     * رندر هندسی بوم گرافیکی در هر فریم ورودی
     * @param {number} x - مختصات کالیبره شده محور افقی (-1.0 تا +1.0)
     * @param {number} y - مختصات کالیبره شده محور عمودی (-1.0 تا +1.0)
     */
    render(x, y) {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = w / 2 - 15; // حاشیه امن ۱۵ پیکسلی برای عدم خروج پوینتر از کادر دایره

        // ۱. پاکسازی فریم قبلی بوم و رندر پس‌زمینه تیره
        ctx.fillStyle = this.theme.background;
        ctx.fillRect(0, 0, w, h);

        // ۲. رسم گرید متقاطع (محورهای دکارت ایکس و وای)
        ctx.strokeStyle = this.theme.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(w, cy); // محور افقی
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h); // محور عمودی
        ctx.stroke();

        // رسم دایره بیرونی (محدوده حداکثری دامنه ۱.۰ فیزیکی استیک)
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // ۳. تبدیل بازه ریاضی (-1.0 تا +1.0) به مختصات پیکسلی بوم گرافیکی
        const pointerX = cx + (x * r);
        const pointerY = cy + (y * r);

        // ذخیره نقطه در بافر مسیر حرکت
        this.trail.push({ x: pointerX, y: pointerY });
        if (this.trail.length > this.maxTrailPoints) {
            this.trail.shift(); // حذف قدیمی‌ترین فریم جهت حفظ کارایی حافظه
        }

        // رسم تریل (مسیر حرکت آنالوگ) با افکت آلفا و شفافیت
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = this.theme.accent + '25'; // اضافه کردن شفافیت hex (حدود ۱۵٪)
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // ۴. رسم کورسر اصلی موقعیت زنده آنالوگ (Target Pointer)
        ctx.fillStyle = this.theme.accent;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // رسم حلقه بیرونی پوینتر جهت زیبایی و دید بهتر تفکیک برداری
        ctx.strokeStyle = this.theme.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 11, 0, Math.PI * 2);
        ctx.stroke();

        // ۵. محاسبه ریاضی میزان انحراف از مرکز (Center Offset / Drift) بر اساس قضیه فیثاغورث
        const drift = Math.sqrt(x * x + y * y);
        
        // تزریق بلادرنگ مقدار عددی به المان متناظر در UI (صرفاً ۴ رقم اعشار)
        const elementId = `err-${this.stickKey === 'left' ? 'l' : 'r'}-offset`;
        const offsetElement = document.getElementById(elementId);
        if (offsetElement) {
            offsetElement.innerText = drift.toFixed(4);
        }
    }
}

// شیء مدیریت بوم‌ها جهت تعامل با هسته هماهنگ‌کننده برنامه (app.js)
export const AnalogCanvas = {
    instances: {},

    /**
     * وهله‌سازی و آماده‌سازی نمونه‌ها برای هر دو استیک چپ و راست
     */
    init(canvasLeftId, canvasRightId) {
        this.instances['left'] = new StickVisualizer(canvasLeftId, 'left');
        this.instances['right'] = new StickVisualizer(canvasRightId, 'right');
        AppState.log('موتور رندر گرافیکی بوم آنالوگ‌ها با موفقیت راه‌اندازی شد.', 'info');
    },

    /**
     * متد دسترسی سریع بیرونی برای به‌روزرسانی فریم رندر استیک‌ها
     * @param {string} stickKey - 'left' یا 'right'
     * @param {number} x - محور X (-1.0 تا +1.0)
     * @param {number} y - محور Y (-1.0 تا +1.0)
     */
    updateAndRender(stickKey, x, y) {
        if (this.instances[stickKey]) {
            this.instances[stickKey].render(x, y);
        }
    }
};

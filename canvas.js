/**
 * HID-Fix Geometric Vector Canvas Engine (ES2024)
 * مدیریت رندر گرافیکی بوم‌های آنالوگ و محاسبات خطای دایره‌ای و آفست مرکز
 */

import { AppState } from '../core/state.js';

export const AnalogCanvas = {
    contexts: {},
    maxTrailPoints: 120, // تعداد فریم‌های ذخیره مسیر حرکت برای رسم تریل

    /**
     * مقداردهی اولیه بوم‌های چپ و راست
     */
    init(canvasLeftId, canvasRightId) {
        this.setupCanvas(canvasLeftId, 'left');
        this.setupCanvas(canvasRightId, 'right');
        AppState.log('موتور رندر هندسی Canvas با موفقیت راه‌اندازی شد.', 'info');
    },

    setupCanvas(id, stickKey) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        this.contexts[stickKey] = canvas.getContext('2d');
    },

    /**
     * متد اصلی رندر و تحلیل برداری در هر فریم (فرکانس بالا)
     */
    updateAndRender(stickKey, x, y) {
        const ctx = this.contexts[stickKey];
        if (!ctx) return;

        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 15; // حاشیه امن برای رسم محیط دایره

        // ۱. محاسبات ریاضی هندسی (Pythagorean Theorem)
        const currentRadius = Math.hypot(x, y); // فاصله برداری از مرکز اصلی
        
        // ذخیره مختصات در آرایه تاریخچه مسیر (Trail)
        const analysis = AppState.analysis[stickKey];
        analysis.historyTrail.push({ x, y });
        if (analysis.historyTrail.length > this.maxTrailPoints) {
            analysis.historyTrail.shift();
        }

        // محاسبه آفست مرکز (Center Offset / Drift Vector)
        // در حالت ایده‌آل وقتی استیک رها شده، مقدار باید 0.0000 باشد
        analysis.centerOffset = currentRadius;

        // محاسبه پویای خطای هندسی دایره (Circular Error Rate)
        // بررسی انحراف استیک در لبه‌های ۳۶۰ درجه نسبت به دایره کامل (محیط ایده آل = 1.0)
        if (currentRadius > 0.85) {
            const error = Math.abs(currentRadius - 1.0) * 100;
            // فیلتر میانگین متحرک ساده برای جلوگیری از پرش عدد خطای دایره
            analysis.circularError = (analysis.circularError * 0.9) + (error * 0.1);
        }

        // ۲. عملیات رندر روی بوم Canvas
        ctx.clearRect(0, 0, width, height);

        // رسم گرید مختصات پس‌زمینه (Crosshair Grid)
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
        ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
        ctx.stroke();

        // رسم دایره بیرونی مرجع ۱۰۰٪ (Outer Reference Bound)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // رسم محدوده ددزون داخلی پیش‌فرض کارخانه (Inner Deadzone Limit ~ 10%)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.1, 0, Math.PI * 2);
        ctx.stroke();

        // رسم مسیر حرکت پیموده شده (History Trail Line)
        if (analysis.historyTrail.length > 1) {
            ctx.strokeStyle = stickKey === 'left' ? 'rgba(0, 242, 254, 0.25)' : 'rgba(16, 185, 129, 0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < analysis.historyTrail.length; i++) {
                const pt = analysis.historyTrail[i];
                const ptX = centerX + (pt.x * radius);
                const ptY = centerY + (pt.y * radius); // لایه محور Y در کامپیوتر برعکس است
                if (i === 0) ctx.moveTo(ptX, ptY);
                else ctx.lineTo(ptX, ptY);
            }
            ctx.stroke();
        }

        // محاسبه و نگاشت زنده موقعیت فیزیکی فعلی کورسر آنالوگ
        const pointerX = centerX + (x * radius);
        const pointerY = centerY + (y * radius);

        // رسم خط بردار از مرکز به موقعیت فعلی استیک (Vector Link)
        ctx.strokeStyle = stickKey === 'left' ? 'rgba(0, 242, 254, 0.6)' : 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pointerX, pointerY);
        ctx.stroke();

        // رسم کورسر فیزیکی موقعیت آنالوگ (Target Crosshair Pointer)
        ctx.fillStyle = stickKey === 'left' ? '#00f2fe' : '#10b981';
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 5, 0, Math.PI * 2);
        ctx.fill();

        // رونمایی از ماتریس جهت‌های جغرافیایی ۳۶۰ درجه فعال
        this.updateDirectionMatrix(stickKey, x, y);
    },

    /**
     * نگاشت موقعیت آنالوگ به المان‌های ماتریس ۳x۳ جهت‌های جغرافیایی در UI
     */
    updateDirectionMatrix(stickKey, x, y) {
        const threshold = 0.3; // آستانه حساسیت برای روشن شدن جهت‌ها
        let dir = 'C'; // مرکز پیش‌فرض

        if (y < -threshold) {
            if (x < -threshold) dir = 'NW';
            else if (x > threshold) dir = 'NE';
            else dir = 'N';
        } else if (y > threshold) {
            if (x < -threshold) dir = 'SW';
            else if (x > threshold) dir = 'SE';
            else dir = 'S';
        } else {
            if (x < -threshold) dir = 'W';
            else if (x > threshold) dir = 'E';
        }

        const matrixContainer = document.getElementById(`matrix-${stickKey}`);
        if (matrixContainer) {
            const spans = matrixContainer.querySelectorAll('span');
            spans.forEach(span => {
                if (span.getAttribute('data-dir') === dir) {
                    span.classList.add('active');
                } else {
                    span.classList.remove('active');
                }
            });
        }
    }
};
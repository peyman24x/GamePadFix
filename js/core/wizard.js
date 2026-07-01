/**
 * js/core/wizard.js
 * DualShock / DualSense Calibration Tool - 7-Step Calibration State Machine
 * مدیریت ماشین وضعیت کالیبراسیون کارگاهی، ثبت بافرهای فیزیکی و محاسبه ضرایب تصحیح دریفت
 */

import { AppState } from './state.js';

export const CalibrationWizard = {
    currentStep: 1,
    totalSteps: 7,
    isActive: false,

    // بافرهای موقت برای ذخیره حد بالا و پایین سیگنال ولتاژ پتانسیومترها در طول فرآیند
    samples: {
        left: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 },
        right: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 }
    },

    // دایره المعارف و راهنمای گام‌به‌گام مراحل کالیبراسیون مطابق داکیومنت‌های فنی سونی
    stepGuides: [
        { title: 'شروع فرآیند کالیبراسیون', desc: 'لطفاً کنترلر را روی یک سطح کاملاً صاف و پایدار قرار داده و استیک‌ها بدون دست زدن بخود باقی بمانند.' },
        { title: 'ثبت مرکز استیک چپ (Left Center)', desc: 'بدون دست زدن به استیک‌ها، دکمه "ثبت و ادامه" را بزنید تا خروجی ولتاژ و مرکز ثبت شود.' },
        { title: 'کالیبراسیون دامنه استیک چپ (Left Range)', desc: 'استیک چپ را ۲ الی ۳ بار به صورت کامل و دایره‌ای ۳۶۰ درجه بچرخانید تا حد بالا و پایین ثبت شود.' },
        { title: 'ثبت مرکز استیک راست (Right Center)', desc: 'استیک‌ها را مجدداً رها کنید و دکمه "ثبت و ادامه" را بزنید تا نقطه ثقل آنالوگ راست ضبط شود.' },
        { title: 'کالیبراسیون دامنه استیک راست (Right Range)', desc: 'استیک راست را چند بار به صورت کامل در تمامی جهات ۳۶۰ درجه بچرخانید تا حد‌های حرکت ثبت شوند.' },
        { title: 'تحلیل دایره‌های و کیفیت سنسور', desc: 'سیستم دقت و خطای دایره‌های سنسورها را آنالیز می‌کند. لطفاً صبر کنید...' },
        { title: 'پردازش ماتریس و اعمال نهایی', desc: 'بافرهای فیزیکی با موفقیت ارزیابی شدند. برای تزریق زنده ضرایب تصحیح، روی "پایان کالیبراسیون" کلیک کنید.' }
    ],

    /**
     * فعال‌سازی مود کارگاهی و بازنشانی متغیرها
     */
    start() {
        if (!AppState.connection.isConnected) {
            AppState.log('جهت شروع کالیبراسیون، ابتدا باید کنترلر را متصل کنید.', 'warning');
            return;
        }
        this.isActive = true;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        
        AppState.log('ویزارد ۷ مرحله‌ای کالیبراسیون سخت‌افزاری تراشه فعال شد.', 'info');
    },

    /**
     * انتقال به گام بعدی و اجرای لایف‌سایکل اختصاصی هر مرحله
     */
    nextStep() {
        if (!this.isActive) return;

        // اجرای عملیات منطقی متناسب با خروج از مرحله فعلی
        this.executeStepLogic(this.currentStep);

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();
        } else {
            // گام آخر: محاسبه ریاضی ماتریس تصحیح و اعمال به فریمور
            this.finalizeCalibration();
        }
    },

    /**
     * بازگشت به مرحله قبلی ویزارد
     */
    prevStep() {
        if (!this.isActive || this.currentStep <= 1) return;
        this.currentStep--;
        this.updateUI();
    },

    /**
     * ابورت کردن آنی فرآیند و پاکسازی بافرها برای جلوگیری از به هم ریختگی سیگنال
     */
    cancel() {
        this.isActive = false;
        this.currentStep = 1;
        this.resetSamples();
        AppState.log('فرآیند کالیبراسیون تراشه توسط کاربر لغو شد.', 'warning');
    },

    resetSamples() {
        this.samples = {
            left: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 },
            right: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 }
        };
    },

    /**
     * شنودر زنده پکت‌ها؛ این متد در فرکانس بالا (High Hz) توسط دکودر یا ارکستراتور 
     * فراخوانی می‌شود تا مقادیر مینیمم/ماکزیمم فیزیکی چرخاندن استیک را شکار کند.
     */
    recordLiveSamples() {
        if (!this.isActive) return;

        // گام ۳: ضبط دامنه استیک چپ
        if (this.currentStep === 3) {
            const lx = AppState.inputs.axes.lx;
            const ly = AppState.inputs.axes.ly;
            const s = this.samples.left;
            if (lx < s.minX) s.minX = lx;
            if (lx > s.maxX) s.maxX = lx;
            if (ly < s.minY) s.minY = ly;
            if (ly > s.maxY) s.maxY = ly;
        }
        
        // گام ۵: ضبط دامنه استیک راست
        if (this.currentStep === 5) {
            const rx = AppState.inputs.axes.rx;
            const ry = AppState.inputs.axes.ry;
            const s = this.samples.right;
            if (rx < s.minX) s.minX = rx;
            if (rx > s.maxX) s.maxX = rx;
            if (ry < s.minY) s.minY = ry;
            if (ry > s.maxY) s.maxY = ry;
        }
    },

    /**
     * ثبت نقاط ثقل (اصلاح ددزون داخلی فیزیکی) در فازهای سکون
     */
    executeStepLogic(step) {
        switch(step) {
            case 2: // کپچر کردن نقطه استراحت آنالوگ چپ
                this.samples.left.centerX = AppState.inputs.axes.lx;
                this.samples.left.centerY = AppState.inputs.axes.ly;
                AppState.log(`نقطه صفر استیک چپ ثبت شد: X=${this.samples.left.centerX.toFixed(4)}, Y=${this.samples.left.centerY.toFixed(4)}`, 'packet');
                break;
            case 4: // کپچر کردن نقطه استراحت آنالوگ راست
                this.samples.right.centerX = AppState.inputs.axes.rx;
                this.samples.right.centerY = AppState.inputs.axes.ry;
                AppState.log(`نقطه صفر استیک راست ثبت شد: X=${this.samples.right.centerX.toFixed(4)}, Y=${this.samples.right.centerY.toFixed(4)}`, 'packet');
                break;
        }
    },

    /**
     * مینی‌ماتریس استخراج دیتای نهایی و تولید مقادیر دقیق کالیبراسیون
     */
    finalizeCalibration() {
        const calib = AppState.calibration.computedOffsets;
        const sL = this.samples.left;
        const sR = this.samples.right;

        // ۱. تزریق مستقیم مقادیر سنترگیری (آفست‌ها از نقطه صفر کم خواهند شد)
        calib.left.offsetX = sL.centerX;
        calib.left.offsetY = sL.centerY;
        calib.right.offsetX = sR.centerX;
        calib.right.offsetY = sR.centerY;

        // ۲. محاسبه اسکیلینگ برداری (Gain Multiplier) برای اصلاح دایره‌ای کامل (Circular Scaling)
        // اگر کاربر استیک را کامل چرخاند، بازه عددی باید نزدیک به ۲.0 فیزیکی باشد
        const rangeLX = (sL.maxX - sL.minX) || 2.0;
        const rangeLY = (sL.maxY - sL.minY) || 2.0;
        const rangeRX = (sR.maxX - sR.minX) || 2.0;
        const rangeRY = (sR.maxY - sR.minY) || 2.0;

        // محاسبه ضریب گین جهت رساندن سیگنال‌های ضعیف‌شده به مرز استاندارد ۱.۰ دایره
        calib.left.scaleX = 2.0 / rangeLX;
        calib.left.scaleY = 2.0 / rangeLY;
        calib.right.scaleX = 2.0 / rangeRX;
        calib.right.scaleY = 2.0 / rangeRY;

        // فعال‌سازی پرچم کالیبراسیون در استیت جهت اعمال خودکار روی سیگنال‌های دکودر
        AppState.calibration.isCalibrated = true;
        this.isActive = false;

        AppState.log('✅ عملیات کالیبراسیون با موفقیت مانیتور و نهایی شد. ضرایب ریاضی به دکودر تزریق شدند.', 'success');
    },

    /**
     * اتصال خودکار و ایمن ماشین وضعیت به المان‌های پویای رابط کاربری (DOM HTML)
     */
    updateUI() {
        const guide = this.stepGuides[this.currentStep - 1];
        if (!guide) return;

        const titleEl = document.getElementById('step-title');
        const descEl = document.getElementById('step-desc');
        const indicatorEl = document.getElementById('wizard-step-indicator');
        const progressEl = document.getElementById('progress-bar');
        const btnNext = document.getElementById('wiz-btn-next');

        if (titleEl) titleEl.innerText = guide.title;
        if (descEl) descEl.innerText = guide.desc;
        if (indicatorEl) indicatorEl.innerText = `مرحله ${this.currentStep} از ${this.totalSteps}`;
        
        if (progressEl) {
            const percent = (this.currentStep / this.totalSteps) * 100;
            progressEl.style.width = `${percent}%`;
        }

        if (btnNext) {
            btnNext.innerText = this.currentStep === this.totalSteps ? 'پایان کالیبراسیون' : 'ثبت و ادامه';
        }
    }
};

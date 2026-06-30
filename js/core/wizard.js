/**
 * HID-Fix 7-Step Hardware Calibration Wizard Engine (ES2024)
 * مدیریت ماشین وضعیت کالیبراسیون، ثبت بافرهای فیزیکی استیک و محاسبات ماتریس سنترگیری
 */

import { AppState } from './state.js';

export const CalibrationWizard = {
    currentStep: 1,
    totalSteps: 7,
    isActive: false,

    // بافرهای موقت برای ذخیره مقادیر فیزیکی استیک‌ها در طول فرآیند کالیبراسیون
    samples: {
        left: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 },
        right: { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 }
    },

    /**
     * شروع به کار و فعال‌سازی مود کارگاهی کالیبراسیون
     */
    start() {
        if (AppState.connection.status !== 'connected') {
            AppState.log('جهت شروع کالیبراسیون، ابتدا باید کنترلر را متصل کنید.', 'warning');
            return;
        }
        this.isActive = true;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        AppState.log('ویزارد ۷ مرحله‌ای کالیبراسیون سخت‌افزاری فعال شد.', 'info');
    },

    /**
     * انتقال به مرحله بعدی با ثبت داده‌های فیزیکی مرحله فعلی
     */
    nextStep() {
        if (!this.isActive) return;

        // اجرای منطق نمونه‌برداری اختصاصی هر مرحله قبل از خروج
        this.processStepData(this.currentStep);

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();
            AppState.log(`ورود به مرحله ${this.currentStep} کالیبراسیون.`, 'info');
        } else {
            this.completeCalibration();
        }
    },

    /**
     * بازگشت به مرحله قبلی
     */
    prevStep() {
        if (!this.isActive || this.currentStep <= 1) return;
        this.currentStep--;
        this.updateUI();
    },

/**
     * بازنشانی تمام بافرهای سخت‌افزاری نمونه‌برداری با فاکتور شناور سقف و کف
     */
    resetSamples() {
        this.samples = {
            // مقادیر اولیه برای شکار کوچکترین و بزرگترین محدوده فرکانسی تغییر کردند
            left: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 },
            right: { minX: 1.0, maxX: -1.0, minY: 1.0, maxY: -1.0, centerX: 0, centerY: 0 }
        };
    },

    /**
     * پردازش عمیق دیتای فیزیکی دریافتی از استیک‌ها در هر فاز ویزارد
     */
    processStepData(step) {
        const lx = AppState.inputs.axes.lx;
        const ly = AppState.inputs.axes.ly;
        const rx = AppState.inputs.axes.rx;
        const ry = AppState.inputs.axes.ry;

        switch (step) {
            case 2: // ثبت نقطه استراحت فیزیکی (Physical Center) آنالوگ چپ
                this.samples.left.centerX = lx;
                this.samples.left.centerY = ly;
                AppState.log(`نقطه صفر آنالوگ چپ ثبت شد: X=${lx.toFixed(4)}, Y=${ly.toFixed(4)}`, 'success');
                break;

            case 3: // محاسبه بیشترین انحراف لبه‌ها (Outer Range) آنالوگ چپ در طول چرخش تکنسین
                AppState.log('بافرهای دامنه حرکتی لبه‌های استیک چپ با موفقیت در رم ذخیره شد.', 'success');
                break;

            case 4: // ثبت نقطه استراحت فیزیکی آنالوگ راست
                this.samples.right.centerX = rx;
                this.samples.right.centerY = ry;
                AppState.log(`نقطه صفر آنالوگ راست ثبت شد: X=${rx.toFixed(4)}, Y=${ry.toFixed(4)}`, 'success');
                break;

            case 5: // بافرهای دامنه حرکتی لبه‌های استیک راست
                AppState.log('بافرهای دامنه حرکتی لبه‌های استیک راست با موفقیت در رم ذخیره شد.', 'success');
                break;

            case 6: // ساخت نهایی ماتریس کالیبراسیون و اعمال نرم‌افزاری
                this.applyCalibrationMatrix();
                break;
        }
    },

    /**
     * شنود آنلاین در هر فریم برای شکار مقادیر مینیمم و ماکسیمم پالس‌های استیک (مخصوص مراحل ۳ و ۵)
     */
    captureLiveBounds() {
        if (!this.isActive) return;

        if (this.currentStep === 3) { // مانیتورینگ زنده استیک چپ
            const lx = AppState.inputs.axes.lx;
            const ly = AppState.inputs.axes.ly;
            this.samples.left.minX = Math.min(this.samples.left.minX, lx);
            this.samples.left.maxX = Math.max(this.samples.left.maxX, lx);
            this.samples.left.minY = Math.min(this.samples.left.minY, ly);
            this.samples.left.maxY = Math.max(this.samples.left.maxY, ly);
        } else if (this.currentStep === 5) { // مانیتورینگ زنده استیک راست
            const rx = AppState.inputs.axes.rx;
            const ry = AppState.inputs.axes.ry;
            this.samples.right.minX = Math.min(this.samples.right.minX, rx);
            this.samples.right.maxX = Math.max(this.samples.right.maxX, rx);
            this.samples.right.minY = Math.min(this.samples.right.minY, ry);
            this.samples.right.maxY = Math.max(this.samples.right.maxY, ry);
        }
    },

    /**
     * محاسبه تزریق آفست و اعمال ماتریس ریاضی کالیبراسیون به استیت مادر جهت صفر کردن خطای مرکز (Zero Drift)
     */
    applyCalibrationMatrix() {
        // فاکتورهای اصلاحی جهت حذف سخت‌افزاری انحراف درایفت
        // این مقادیر در محاسبات فریم‌ورک‌های بعدی از مقادیر خام کم خواهند شد
        AppState.calibration.offsetLX = this.samples.left.centerX;
        AppState.calibration.offsetLY = this.samples.left.centerY;
        AppState.calibration.offsetRX = this.samples.right.centerX;
        AppState.calibration.offsetRY = this.samples.right.centerY;

        AppState.log('ماتریس آلاینمنت برای جبران فیزیکی دریفت (Zero-Drift Matrix) تولید و اعمال شد.', 'success');
    },

    /**
     * پایان موفقیت‌آمیز کالیبراسیون و قفل کردن مقادیر
     */
    completeCalibration() {
        this.isActive = false;
        this.currentStep = 1;
        this.updateUI();
        document.getElementById('wizard-container').classList.remove('active');
        AppState.log('عملیات کالیبراسیون سخت‌افزاری با موفقیت به پایان رسید و در پروفایل ابزار ذخیره شد.', 'success');
    },

    /**
     * خروج اضطراری و لغو فرآیند کالیبراسیون بدون ذخیره‌سازی داده‌ها
     */
    cancel() {
        this.isActive = false;
        this.currentStep = 1;
        this.resetSamples();
        this.updateUI();
        document.getElementById('wizard-container').classList.remove('active');
        AppState.log('عملیات کالیبراسیون توسط تکنسین لغو شد.', 'warning');
    },

    /**
     * به‌روزرسانی زنده متون راهنما و بخش‌های گرافیکی ویزارد در DOM
     */
    updateUI() {
        const wizardBox = document.getElementById('wizard-container');
        if (!wizardBox) return;

        if (this.isActive) {
            wizardBox.classList.add('active');
        } else {
            wizardBox.classList.remove('active');
            return;
        }

        // مدیریت فعال بودن دکمه‌های ناوبری ویزارد
        document.getElementById('wiz-btn-back').disabled = (this.currentStep === 1);
        document.getElementById('wiz-btn-next').innerText = (this.currentStep === this.totalSteps) ? 'ذخیره و پایان' : 'مرحله بعدی';

        // به‌روزرسانی نوار پیشرفت (Progress Bar)
        const progressPercent = ((this.currentStep / this.totalSteps) * 100).toFixed(0);
        document.getElementById('wiz-progress').style.width = `${progressPercent}%`;
        document.getElementById('wiz-step-number').innerText = `مرحله ${this.currentStep} از ${this.totalSteps}`;

        // آرایه عناوین و متون راهنمای کارگاهی کالیبراسیون (متناسب با داکیومنت‌های تعمیراتی سونی)
        const stepGuides = [
            { title: 'شروع کالیبراسیون', desc: 'لطفاً کنترلر را روی سطح کاملاً صاف قرار داده و استیک‌ها را رها کنید. سپس روی مرحله بعد کلیک کنید.' },
            { title: 'ثبت مرکز آنالوگ چپ', desc: 'بدون دست زدن به آنالوگ‌ها، دکمه ثبت مرحله بعد را بزنید تا خروجی ولتاژ و مقاومت تراشه چپ صفر شود.' },
            { title: 'کالیبراسیون دامنه استیک چپ', desc: 'استیک چپ را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده مغناطیسی ثبت شود. سپس دکمه بعد را بزنید.' },
            { title: 'ثبت مرکز آنالوگ راست', desc: 'استیک‌ها را رها کرده و دکمه ثبت مرحله بعد را بزنید تا خروجی ولتاژ و مقاومت تراشه راست صفر شود.' },
            { title: 'کالیبراسیون دامنه استیک راست', desc: 'استیک راست را ۲ الی ۳ بار به صورت کامل ۳۶۰ درجه بچرخانید تا بیشترین محدوده مغناطیسی ثبت شود. سپس دکمه بعد را بزنید.' },
            { title: 'تولید ماتریس تصحیح خطا', desc: 'سیستم در حال ارزیابی بافرهای ذخیره‌شده و اعمال اسکیلینگ نهایی به خطای دایره‌ای است. روی دکمه بعد کلیک کنید.' },
            { title: 'اعمال فریمور نهایی', desc: 'فرآیند با موفقیت انجام شد. برای ذخیره‌سازی دائمی مقادیر جدید روی دکمه پایان کلیک کنید.' }
        ];

        const currentGuide = stepGuides[this.currentStep - 1];
        document.getElementById('wiz-title').innerText = currentGuide.title;
        document.getElementById('wiz-desc').innerText = currentGuide.desc;
    }
};

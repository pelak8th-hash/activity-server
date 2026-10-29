// Railway deployment test 

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 8080;


// ========================================
// اتصال به Supabase
// ========================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);


// ========================================
// تنظیمات سرور
// ========================================

app.use(cors());
app.use(express.json());

// ثبت زمان و نتیجهٔ درخواست‌ها برای تشخیص تأخیر Railway، شبکه و Supabase
app.use((req, res, next) => {
    const startedAt = Date.now();

    const requestId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${startedAt}-${Math.random().toString(16).slice(2)}`;

    res.setHeader("X-Request-Id", requestId);

    const monitoredPaths = [
        "/reservation/sessions",
        "/reservation/capacity",
        "/"
    ];

    if (monitoredPaths.includes(req.path)) {
        console.log(
            `[REQ START] id=${requestId} method=${req.method} path=${req.originalUrl}`
        );
    }

    res.on("finish", () => {
        if (monitoredPaths.includes(req.path)) {
            console.log(
                `[REQ END] id=${requestId} path=${req.path} status=${res.statusCode} duration_ms=${Date.now() - startedAt}`
            );
        }
    });

    next();
});

// ========================================
// ابزارهای تاریخ شمسی و محدودیت رزرو
// زمان مرجع رزروها: ساعت رسمی ایران
// ========================================

function normalizeDigits(value) {
    return String(value || "")
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
        .trim();
}

function jalaliToGregorian(jy, jm, jd) {
    jy = Number(jy);
    jm = Number(jm);
    jd = Number(jd);

    if (
        !Number.isInteger(jy) ||
        !Number.isInteger(jm) ||
        !Number.isInteger(jd) ||
        jm < 1 || jm > 12 ||
        jd < 1 || jd > (jm <= 6 ? 31 : jm <= 11 ? 30 : 30)
    ) {
        return null;
    }

    jy += 1595;

    let days = -355668 + (365 * jy) +
        Math.floor(jy / 33) * 8 +
        Math.floor(((jy % 33) + 3) / 4) + jd;

    if (jm < 7) {
        days += (jm - 1) * 31;
    } else {
        days += ((jm - 7) * 30) + 186;
    }

    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;

    if (days > 36524) {
        gy += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }

    gy += 4 * Math.floor(days / 1461);
    days %= 1461;

    if (days > 365) {
        gy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }

    let gd = days + 1;

    const leap =
        (gy % 4 === 0 && gy % 100 !== 0) ||
        gy % 400 === 0;

    const monthDays = [
        0, 31, leap ? 29 : 28, 31, 30, 31, 30,
        31, 31, 30, 31, 30, 31
    ];

    let gm = 1;

    while (gm <= 12 && gd > monthDays[gm]) {
        gd -= monthDays[gm];
        gm++;
    }

    if (gm > 12) return null;

    return {
        year: gy,
        month: gm,
        day: gd
    };
}

function iranNowParts() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const get = type =>
        Number(parts.find(p => p.type === type)?.value);

    return {
        gy: get("year"),
        gm: get("month"),
        gd: get("day"),
        hour: get("hour"),
        minute: get("minute")
    };
}

function reservationCutoffPassed(jalaliDate, sessionTime) {
    const dateMatch = normalizeDigits(jalaliDate)
        .match(/^(\d{4})\/(\d{2})\/(\d{2})$/);

    const timeMatch = normalizeDigits(sessionTime)
        .match(/(\d{1,2})\s*:\s*(\d{2})/);

    if (!dateMatch || !timeMatch) return true;

    const target = jalaliToGregorian(
        Number(dateMatch[1]),
        Number(dateMatch[2]),
        Number(dateMatch[3])
    );

    if (!target) return true;

    const start = new Date(Date.UTC(
        target.year,
        target.month - 1,
        target.day,
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        0,
        0
    ));

    const nowParts = iranNowParts();

    const nowDate = new Date(Date.UTC(
        nowParts.gy,
        nowParts.gm - 1,
        nowParts.gd,
        nowParts.hour,
        nowParts.minute
    ));

    return start.getTime() - nowDate.getTime() <= 0;
}




async function getSessionSettingsForDate(date) {
    // ابتدا بررسی تنظیم ویژه برای تاریخ مشخص
    const { data: special, error: specialError } = await supabase
        .from("activity_types")
        .select("name,start_date,category,sessions,points")
        .eq("setting_type", "special_date")
        .eq("start_date", date)
        .limit(1)
        .maybeSingle();

    if (specialError) throw specialError;

    if (special) {
        const parsedCapacity = Number(special.points);

        const capacity =
            Number.isFinite(parsedCapacity) && parsedCapacity > 0
                ? Math.floor(parsedCapacity)
                : 10;

        return {
            start_date: special.start_date,
            sessions: Array.isArray(special.sessions)
                ? special.sessions
                : [],
            capacity,
            is_special: true,
            title: String(
                special.name || special.category || ""
            ).trim(),
            max_companions: Math.max(0, capacity - 1)
        };
    }

    // در نبود تاریخ ویژه، آخرین تنظیم عادی تا تاریخ موردنظر
    const { data, error } = await supabase
        .from("activity_types")
        .select("sessions,start_date,points")
        .eq("setting_type", "sessions")
        .lte("start_date", date)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const parsedCapacity = Number(data.points);

    const capacity =
        Number.isFinite(parsedCapacity) && parsedCapacity > 0
            ? Math.floor(parsedCapacity)
            : 10;

    return {
        start_date: data.start_date,
        sessions: Array.isArray(data.sessions)
            ? data.sessions
            : [],
        capacity,
        is_special: false,
        title: "",
        max_companions: Math.max(0, capacity - 1)
    };
}

// ========================================
// تست سرور
// ========================================

app.get("/", (req, res) => {

    res.status(200).send(
        "Activity server is running!"
    );

});


// ========================================
// دریافت تنظیمات سانس
// آخرین تنظیمی که start_date آن
// کوچکتر یا مساوی تاریخ انتخابی باشد.
// ========================================

app.get("/reservation/sessions", async (req, res) => {
    try {
        const date = normalizeDigits(req.query.date || "");

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_DATE"
            });
        }

        const data = await getSessionSettingsForDate(date);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "SESSIONS_NOT_FOUND"
            });
        }


        return res.status(200).json({
            success: true,
            start_date: data.start_date,
            sessions: data.sessions,
            capacity: data.capacity,
            is_special: data.is_special === true,
            title: data.title || "",
            max_companions: data.max_companions
        });

    } catch (error) {
        console.error("Sessions server error:", error);

        return res.status(500).json({
            success: false,
            message: "DATABASE_ERROR"
        });
    }
});

// تاریخ‌های ویژه در بازهٔ نمایش‌داده‌شده
app.get("/reservation/special-dates", async (req, res) => {
    try {
        const startDate = normalizeDigits(
            req.query.start_date || ""
        );

        const endDate = normalizeDigits(
            req.query.end_date || ""
        );

        const pattern = /^\d{4}\/\d{2}\/\d{2}$/;

        if (
            !pattern.test(startDate) ||
            !pattern.test(endDate) ||
            startDate > endDate
        ) {
            return res.status(400).json({
                success: false,
                message: "INVALID_DATE_RANGE"
            });
        }

        const { data, error } = await supabase
            .from("activity_types")
            .select("start_date,category")
            .eq("setting_type", "special_date")
            .gte("start_date", startDate)
            .lte("start_date", endDate)
            .order("start_date", { ascending: true });

        if (error) {
            console.error("Special dates database error:", error);

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        return res.status(200).json({
            success: true,
            special_dates: (data || [])
                .map(row => ({
                    date: row.start_date,
                    title: String(row.category || "").trim()
                }))
                .filter(row => row.date && row.title)
        });

    } catch (error) {
        console.error("Special dates server error:", error);

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});

// ========================================
// ثبت فعالیت جدید
// ========================================

app.post("/activity", async (req, res) => {

    try {

        console.log("Received:", req.body);

        const {
            first_name,
            last_name,
            date,
            time,
            activity
        } = req.body;


        if (
            typeof first_name !== "string" ||
            typeof last_name !== "string" ||
            typeof date !== "string" ||
            typeof time !== "string" ||
            typeof activity !== "string"
        ) {

            return res.status(400).json({

                success: false,

                message: "MISSING_DATA"

            });

        }


        if (
            first_name.trim() === "" ||
            last_name.trim() === "" ||
            date.trim() === "" ||
            time.trim() === "" ||
            activity.trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                message: "MISSING_DATA"

            });

        }


        const { data, error } = await supabase

            .from("users")

            .insert([

                {

                    first_name:
                        first_name.trim(),

                    last_name:
                        last_name.trim(),

                    date:
                        date.trim(),

                    time:
                        time.trim(),

                    activity:
                        activity.trim()

                }

            ])

            .select();


        if (error) {

            console.log(
                "Supabase error:",
                error
            );

            return res.status(500).json({

                success: false,

                message: "DATABASE_ERROR"

            });

        }


        console.log(
            "Saved successfully:",
            data
        );


        return res.status(200).json({

            success: true,

            message: "SAVED",

            data: data

        });


    } catch (error) {

        console.log(
            "Server error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "SERVER_ERROR"

        });

    }

});


// ========================================
// دریافت تمام کاربران
// ========================================

app.get("/users", async (req, res) => {

    try {

        console.log(
            "Request received: GET /users"
        );


        const { data, error } = await supabase

            .from("users")

            .select("*")

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.log(
                "Supabase error:",
                error
            );

            return res.status(500).json({

                success: false,

                message: "DATABASE_ERROR"

            });

        }


        console.log(
            "Users loaded:",
            data.length
        );


        return res.status(200).json({

            success: true,

            users: data

        });


    } catch (error) {

        console.log(
            "Server error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "SERVER_ERROR"

        });

    }

});

// ========================================
// دریافت ظرفیت باقی‌مانده یک سانس
// ========================================

// ========================================
// دریافت ظرفیت باقی‌مانده یک سانس
// ========================================

app.get("/reservation/capacity", async (req, res) => {
    try {
        const date = normalizeDigits(req.query.date || "");
        const time = String(req.query.time || "").trim();

        if (
            !/^\d{4}\/\d{2}\/\d{2}$/.test(date) ||
            !time
        ) {
            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });
        }

        // دریافت ظرفیت تنظیم‌شده برای تاریخ انتخابی
        const sessionSettings =
            await getSessionSettingsForDate(date);

        if (!sessionSettings) {
            return res.status(404).json({
                success: false,
                message: "SESSIONS_NOT_FOUND"
            });
        }

        // دریافت رزروهای ثبت‌شده برای همین سانس
        const capacityQueryStartedAt = Date.now();

        const { data, error } = await supabase
            .from("reservations")
            .select("companions")
            .eq("date", date)
            .eq("time", time);

        console.log(
            `[CAPACITY DB END] date=${date} time=${time} duration_ms=${Date.now() - capacityQueryStartedAt} error=${error ? "yes" : "no"}`
        );

        if (error) {
            console.error("Capacity database error:", error);

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        // هر رزرو شامل یک نفر اصلی و همراهان اوست
        const reservedPeople = (data || []).reduce(
            (sum, reservation) =>
                sum + 1 + Number(reservation.companions || 0),
            0
        );

        const capacity = sessionSettings.capacity;

        const remaining = Math.max(
            0,
            capacity - reservedPeople
        );

        return res.status(200).json({
            success: true,
            capacity,
            reserved: reservedPeople,
            remaining
        });

    } catch (error) {
        console.error("Capacity server error:", error);

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});

// ========================================
// ثبت رزرو جدید
// ========================================

app.post("/reservation", async (req, res) => {
    try {
        // بررسی Verification Token
        const verificationToken = String(
            req.body.verificationToken || ""
        ).trim();

        if (!verificationToken) {
            return res.status(401).json({
                success: false,
                message: "VERIFICATION_REQUIRED"
            });
        }

        const verified = verifiedStore.get(verificationToken);

        if (!verified) {
            return res.status(401).json({
                success: false,
                message: "INVALID_VERIFICATION"
            });
        }

        if (Date.now() > verified.expiresAt) {
            verifiedStore.delete(verificationToken);

            return res.status(401).json({
                success: false,
                message: "VERIFICATION_EXPIRED"
            });
        }

        const {
            first_name,
            last_name,
            gender,
            date,
            time,
            activity,
            companions
        } = req.body;


        // بررسی نوع اطلاعات
        if (
            typeof first_name !== "string" ||
            typeof last_name !== "string" ||
            typeof gender !== "string" ||
            typeof date !== "string" ||
            typeof time !== "string" ||
            typeof activity !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });
        }

        // یکسان‌سازی تاریخ و بررسی قالب آن
        const reservationDate = normalizeDigits(date);

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(reservationDate)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_DATE"
            });
        }

        const companionsNumber = Number(companions);

        const sessionSettings =
            await getSessionSettingsForDate(reservationDate);

        if (!sessionSettings) {
            return res.status(409).json({
                success: false,
                message: "SESSIONS_NOT_FOUND"
            });
        }

        const maxCompanions = sessionSettings.max_companions;

        if (
            !Number.isInteger(companionsNumber) ||
            companionsNumber < 0 ||
            companionsNumber > maxCompanions
        ) {
            return res.status(400).json({
                success: false,
                message: "INVALID_COMPANIONS"
            });
        }

        if (
            !first_name.trim() ||
            !last_name.trim() ||
            !gender.trim() ||
            !time.trim() ||
            !activity.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });
        }


        // جلوگیری از رزرو از لحظه شروع سانس به بعد
        if (reservationCutoffPassed(date, time)) {
            return res.status(409).json({
                success: false,
                message: "RESERVATION_CUTOFF"
            });
        }


        // محاسبه ظرفیت مصرف‌شده
        const {
            data: currentReservations,
            error: currentReservationsError
        } = await supabase
            .from("reservations")
            .select("companions")
            .eq("date", reservationDate)
            .eq("time", time);

        if (currentReservationsError) {
            console.error(
                "Reservation capacity precheck error:",
                currentReservationsError
            );

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        const alreadyReserved = (
            currentReservations || []
        ).reduce(
            (sum, reservation) =>
                sum + 1 + Number(reservation.companions || 0),
            0
        );

        const requestedPeople = 1 + companionsNumber;

        if (
            alreadyReserved + requestedPeople >
            sessionSettings.capacity
        ) {
            return res.status(409).json({
                success: false,
                message: "CAPACITY_FULL",
                remaining: Math.max(
                    0,
                    sessionSettings.capacity - alreadyReserved
                )
            });
        }

        // ثبت نهایی رزرو از طریق تابع Supabase
        const {
            data: reservationResult,
            error: reservationError
        } = await supabase.rpc(
            "create_reservation",
            {
                p_first_name: first_name.trim(),
                p_last_name: last_name.trim(),
                p_phone: verified.phone,
                p_gender: gender.trim(),
                p_date: reservationDate,
                p_time: time.trim(),
                p_activity: activity.trim(),
                p_companions: companionsNumber
            }
        );

        if (reservationError) {
            console.error(
                "RPC reservation error:",
                reservationError
            );

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        if (
            reservationResult &&
            reservationResult.success === false
        ) {
            const status =
                reservationResult.message === "CAPACITY_FULL" ||
                reservationResult.message === "SESSIONS_NOT_FOUND"
                    ? 409
                    : 400;

            return res.status(status).json({
                success: false,
                message: reservationResult.message
            });
        }

        if (
            !reservationResult ||
            reservationResult.success !== true
        ) {
            console.error(
                "Unexpected reservation RPC result:",
                reservationResult
            );

            return res.status(500).json({
                success: false,
                message: "RESERVATION_FAILED"
            });
        }

        // مصرف توکن فقط پس از ثبت موفق رزرو
        verifiedStore.delete(verificationToken);

        return res.status(200).json({
            success: true,
            message: "RESERVATION_SAVED",
            data: reservationResult.data
        });

    } catch (error) {
        console.error("Reservation server error:", error);

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});


// ========================================
// OTP
// ========================================

// OTPهای موقت
const otpStore = new Map();

// توکن‌های تأیید موقت
const verifiedStore = new Map();


// ========================================
// نرمال‌سازی شماره تلفن
// ========================================

function normalizePhone(phone) {

    let value =
        String(phone || "")

            .replace(
                /[۰-۹]/g,
                d =>
                    "۰۱۲۳۴۵۶۷۸۹"
                        .indexOf(d)
            )

            .replace(
                /[٠-٩]/g,
                d =>
                    "٠١٢٣٤٥٦٧٨٩"
                        .indexOf(d)
            )

            .replace(
                /\s+/g,
                ""
            )

            .trim();


    if (
        value.startsWith("+")
    ) {

        value =
            value.substring(1);

    }


    if (
        value.startsWith("09") &&
        value.length === 11
    ) {

        value =
            "98" +
            value.substring(1);

    }

    else if (
        value.startsWith("9") &&
        value.length === 10
    ) {

        value =
            "98" +
            value;

    }


    return value;

}


// ========================================
// ارسال OTP
// ========================================

app.post("/otp/send", async (req, res) => {

    try {

        const phone =
            normalizePhone(
                req.body.phone
            );


        if (!phone) {

            return res.status(400).json({

                success: false,

                message:
                    "PHONE_REQUIRED"

            });

        }


        // تولید کد 6 رقمی

        const otp =
            crypto
                .randomInt(
                    100000,
                    1000000
                )
                .toString();


        // ذخیره OTP برای 5 دقیقه

        otpStore.set(
            phone,
            {

                otp:

                    otp,

                expiresAt:

                    Date.now() +
                    5 * 60 * 1000,

                attempts:

                    0

            }
        );


        const response =
            await fetch(
                "https://safir.bale.ai/api/v3/send_message",
                {

                    method:
                        "POST",

                    headers:
                        {

                            "api-access-key":
                                process.env
                                    .BALE_API_ACCESS_KEY,

                            "Content-Type":
                                "application/json"

                        },

                    body:
                        JSON.stringify(
                            {

                                bot_id:
                                    Number(
                                        process.env
                                            .BALE_BOT_ID
                                    ),

                                phone_number:
                                    phone,

                                message_data:
                                    {

                                        otp_message:
                                            {

                                                otp:
                                                    otp

                                            }

                                    }

                            }
                        )

                }
            );


        const text =
            await response.text();


        console.log(
            "Bale status:",
            response.status
        );


        console.log(
            "Bale response:",
            text
        );


        if (!response.ok) {

            otpStore.delete(
                phone
            );


            return res.status(500).json({

                success: false,

                message:
                    "BALE_ERROR"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "OTP_SENT"

        });


    } catch (error) {

        console.log(
            "OTP send error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "SERVER_ERROR"

        });

    }

});


// ========================================
// بررسی OTP
// ========================================

app.post("/otp/verify", async (req, res) => {

    try {

        const phone =
            normalizePhone(
                req.body.phone
            );


        const otp =
            String(
                req.body.otp || ""
            ).trim();


        if (
            !phone ||
            !otp
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "MISSING_DATA"

            });

        }


        const saved =
            otpStore.get(
                phone
            );


        if (!saved) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP_NOT_FOUND"

            });

        }


        if (
            Date.now() >
            saved.expiresAt
        ) {

            otpStore.delete(
                phone
            );

            return res.status(400).json({

                success: false,

                message:
                    "OTP_EXPIRED"

            });

        }


        saved.attempts++;


        if (
            saved.attempts > 5
        ) {

            otpStore.delete(
                phone
            );

            return res.status(429).json({

                success: false,

                message:
                    "TOO_MANY_ATTEMPTS"

            });

        }


        if (
            otp !== saved.otp
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "INVALID_OTP"

            });

        }


        // OTP یکبار مصرف است

        otpStore.delete(
            phone
        );


        // ========================================
        // ساخت Verification Token
        // ========================================

        const verificationToken =
            crypto
                .randomBytes(32)
                .toString("hex");


        verifiedStore.set(
            verificationToken,
            {

                phone:
                    phone,

                expiresAt:
                    Date.now() +
                    10 * 60 * 1000

            }
        );


        return res.status(200).json({

            success: true,

            message:
                "USER_VERIFIED",

            verificationToken:
                verificationToken

        });


    } catch (error) {

        console.log(
            "OTP verify error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "SERVER_ERROR"

        });

    }

});

// ========================================
// دریافت رزروهای بازه زمانی برای پنل مدیریت
// ========================================

app.get("/reservation/admin", async (req, res) => {
    try {
        const startDate = String(
            req.query.start_date || ""
        ).trim();

        const endDate = String(
            req.query.end_date || ""
        ).trim();

        const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;

        if (
            !datePattern.test(startDate) ||
            !datePattern.test(endDate) ||
            startDate > endDate
        ) {
            return res.status(400).json({
                success: false,
                message: "INVALID_DATE_RANGE"
            });
        }

        const { data, error } = await supabase
            .from("reservations")
            .select(`
                first_name,
                last_name,
                phone,
                gender,
                date,
                time,
                activity,
                companions,
                created_at
            `)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true })
            .order("time", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) {
            console.error(
                "Admin reservations error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        return res.status(200).json({
            success: true,
            reservations: data || []
        });

    } catch (error) {
        console.error(
            "Admin reservations server error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});

// ========================================
// درگاه پرداخت آزمایشی
// بدون دریافت پول واقعی
// ========================================

const testPayments = new Map();

const TEST_RESERVATION_AMOUNT = 1000;

// ========================================
// تکمیل رزرو آزمایشی فقط با پرداخت تأییدشده
// ========================================

app.post("/payment-test/complete", async (req, res) => {
    let payment = null;

    try {
        const paymentId = String(
            req.body.paymentId || ""
        ).trim();

        const verificationToken = String(
            req.body.verificationToken || ""
        ).trim();

        payment = testPayments.get(paymentId);

        // بررسی وجود، انقضا و وضعیت پرداخت
        if (
            !payment ||
            Date.now() > payment.expiresAt ||
            payment.status !== "paid"
        ) {
            return res.status(400).json({
                success: false,
                message: "TEST_PAYMENT_NOT_CONFIRMED"
            });
        }

        // بررسی تطابق توکن با پرداخت
        if (
            payment.verificationToken !== verificationToken
        ) {
            return res.status(401).json({
                success: false,
                message: "INVALID_VERIFICATION"
            });
        }

        // بررسی اعتبار تأیید شماره تلفن
        const verified = verifiedStore.get(
            verificationToken
        );

        if (
            !verified ||
            Date.now() > verified.expiresAt ||
            verified.phone !== payment.phone
        ) {
            return res.status(401).json({
                success: false,
                message: "VERIFICATION_EXPIRED"
            });
        }

        // جلوگیری از استفاده هم‌زمان از یک پرداخت
        payment.status = "processing";

        const {
            first_name,
            last_name,
            gender,
            date,
            time,
            activity
        } = req.body;

        const companionsNumber = Number(
            req.body.companions
        );
        if (
            typeof first_name !== "string" ||
            typeof last_name !== "string" ||
            typeof gender !== "string" ||
            typeof time !== "string" ||
            typeof activity !== "string" ||
            !first_name.trim() ||
            !last_name.trim() ||
            !gender.trim() ||
            !time.trim() ||
            !activity.trim()
        ) {
            payment.status = "paid";

            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });
        }


        // بررسی و یکسان‌سازی تاریخ رزرو
        const reservationDate = normalizeDigits(
            req.body.date
        );

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(reservationDate)) {
            payment.status = "paid";

            return res.status(400).json({
                success: false,
                message: "INVALID_DATE"
            });
        }

        // بررسی سقف همراهان بر اساس تنظیمات تاریخ رزرو
        const sessionSettings =
            await getSessionSettingsForDate(reservationDate);

        if (!sessionSettings) {
            payment.status = "paid";

            return res.status(409).json({
                success: false,
                message: "SESSIONS_NOT_FOUND"
            });
        }


        const maxCompanions = sessionSettings.max_companions;

        if (
            !Number.isInteger(companionsNumber) ||
            companionsNumber < 0 ||
            companionsNumber > maxCompanions
        ) {
            payment.status = "paid";

            return res.status(400).json({
                success: false,
                message: "INVALID_COMPANIONS"
            });
        }


        // جلوگیری از رزرو از لحظه شروع سانس به بعد
        if (reservationCutoffPassed(reservationDate, time)) {
            payment.status = "paid";

            return res.status(409).json({
                success: false,
                message: "RESERVATION_CUTOFF"
            });
        }

        // دریافت رزروهای فعلی این سانس
        const {
            data: currentReservations,
            error: currentReservationsError
        } = await supabase
            .from("reservations")
            .select("companions")
            .eq("date", reservationDate)
            .eq("time", time);

        if (currentReservationsError) {
            console.error(
                "Test reservation capacity precheck error:",
                currentReservationsError
            );

            payment.status = "paid";

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        const alreadyReserved = (
            currentReservations || []
        ).reduce(
            (sum, reservation) =>
                sum + 1 + Number(reservation.companions || 0),
            0
        );

        const requestedPeople = 1 + companionsNumber;

        if (
            alreadyReserved + requestedPeople >
            sessionSettings.capacity
        ) {
            payment.status = "paid";

            return res.status(409).json({
                success: false,
                message: "CAPACITY_FULL",
                remaining: Math.max(
                    0,
                    sessionSettings.capacity - alreadyReserved
                )
            });
        }

        // ثبت رزرو در Supabase
        const {
            data: reservationResult,
            error: reservationError
        } = await supabase.rpc(
            "create_reservation",
            {
                p_first_name: first_name.trim(),
                p_last_name: last_name.trim(),
                p_phone: verified.phone,
                p_gender: gender.trim(),
                p_date: reservationDate,
                p_time: time.trim(),
                p_activity: activity.trim(),
                p_companions: companionsNumber
            }
        );

        if (reservationError) {
            console.error(
                "Test reservation RPC error:",
                reservationError
            );

            payment.status = "paid";

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });
        }

        if (
            reservationResult &&
            reservationResult.success === false
        ) {
            payment.status = "paid";

            const status =
                reservationResult.message === "CAPACITY_FULL" ||
                reservationResult.message === "SESSIONS_NOT_FOUND"
                    ? 409
                    : 400;

            return res.status(status).json({
                success: false,
                message: reservationResult.message
            });
        }

        if (
            !reservationResult ||
            reservationResult.success !== true
        ) {
            payment.status = "paid";

            console.error(
                "Unexpected test reservation RPC result:",
                reservationResult
            );

            return res.status(500).json({
                success: false,
                message: "RESERVATION_FAILED"
            });
        }

        // رزرو موفق است؛ پرداخت آزمایشی مصرف می‌شود
        payment.status = "consumed";
        payment.reservationCreatedAt = Date.now();

        // توکن تأیید شماره تلفن نیز مصرف می‌شود
        verifiedStore.delete(verificationToken);

        return res.status(200).json({
            success: true,
            testMode: true,
            message: "RESERVATION_SAVED",
            data: reservationResult.data
        });

    } catch (error) {
        // در صورت خطا، امکان تلاش مجدد باقی بماند
        if (
            payment &&
            payment.status === "processing"
        ) {
            payment.status = "paid";
        }

        console.error(
            "Test payment completion error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});

// ========================================
// تأیید پرداخت آزمایشی
// ========================================


// ========================================
// شروع سرور
// ========================================

app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            `Server started on port ${PORT}`
        );

    }

);

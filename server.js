// Railway deployment test

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 8080;


// اتصال به Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);


// تنظیمات سرور
app.use(cors());
app.use(express.json());


// ========================================
// تست سرور
// ========================================

app.get("/", (req, res) => {

    res.status(200).send(
        "Activity server is running!"
    );

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


        // بررسی نوع اطلاعات

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


        // بررسی خالی نبودن اطلاعات

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


        // ذخیره در Supabase

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


        // بررسی خطای Supabase

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


        // پاسخ موفق

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


        // بررسی خطای Supabase

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


        // ارسال کاربران به HTML

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
// ثبت رزرو جدید
// ========================================

app.post("/reservation", async (req, res) => {

    try {

        // ========================================
        // بررسی Verification Token
        // ========================================

        const verificationToken =
            String(req.body.verificationToken || "").trim();


        if (!verificationToken) {

            return res.status(401).json({

                success: false,

                message: "VERIFICATION_REQUIRED"

            });

        }


        const verified =
            verifiedStore.get(verificationToken);


        if (!verified) {

            return res.status(401).json({

                success: false,

                message: "INVALID_VERIFICATION"

            });

        }


        // بررسی انقضای توکن

        if (
            Date.now() > verified.expiresAt
        ) {

            verifiedStore.delete(
                verificationToken
            );

            return res.status(401).json({

                success: false,

                message: "VERIFICATION_EXPIRED"

            });

        }

        console.log(
            "Reservation received:",
            req.body
        );


        const {
            first_name,
            last_name,
            phone,
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
            typeof phone !== "string" ||
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


        // بررسی تعداد همراه

        const companionsNumber =
            Number(companions);


        if (
            !Number.isInteger(companionsNumber) ||
            companionsNumber < 0 ||
            companionsNumber > 9
        ) {

            return res.status(400).json({

                success: false,

                message: "INVALID_COMPANIONS"

            });

        }


        // بررسی خالی نبودن اطلاعات

        if (
            first_name.trim() === "" ||
            last_name.trim() === "" ||
            phone.trim() === "" ||
            gender.trim() === "" ||
            date.trim() === "" ||
            time.trim() === "" ||
            activity.trim() === ""
        ) {

            return res.status(400).json({

                success: false,

                message: "MISSING_DATA"

            });

        }


        // ========================================
        // بررسی ظرفیت
        // ========================================

        const {
            data: reservations,
            error: capacityError
        } = await supabase

            .from("reservations")

            .select("companions")

            .eq("date", date.trim())

            .eq("time", time.trim());


        if (capacityError) {

            console.log(
                "Capacity check error:",
                capacityError
            );

            return res.status(500).json({

                success: false,

                message: "DATABASE_ERROR"

            });

        }


        // محاسبه تعداد نفرات رزرو شده

        let reservedPeople = 0;


        for (const reservation of reservations) {

            reservedPeople +=
                1 + Number(reservation.companions || 0);

        }


        // تعداد افراد این رزرو

        const requestedPeople =
            1 + companionsNumber;


        // حداکثر ظرفیت هر سانس = 10 نفر

        if (
            reservedPeople + requestedPeople > 10
        ) {

            return res.status(409).json({

                success: false,

                message: "CAPACITY_FULL"

            });

        }


        // ========================================
        // ذخیره رزرو
        // ========================================

        const {
            data,
            error
        } = await supabase

            .from("reservations")

            .insert([

                {

                    first_name:
                        first_name.trim(),

                    last_name:
                        last_name.trim(),

                    phone:
                        verified.phone,

                    gender:
                        gender.trim(),

                    date:
                        date.trim(),

                    time:
                        time.trim(),

                    activity:
                        activity.trim(),

                    companions:
                        companionsNumber

                }

            ])

            .select();


        // بررسی خطای Supabase

        if (error) {

            console.log(
                "Reservation database error:",
                error
            );

            return res.status(500).json({

                success: false,

                message: "DATABASE_ERROR"

            });

        }


        console.log(
            "Reservation saved:",
            data
        );

        // ========================================
        // Token یک‌بار مصرف است
        // ========================================

        verifiedStore.delete(
            verificationToken
        );

        return res.status(200).json({

            success: true,

            message: "RESERVATION_SAVED",

            data: data

        });


    } catch (error) {

        console.log(
            "Reservation server error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "SERVER_ERROR"

        });

    }

});

// ========================================
// شروع سرور
// ========================================

const crypto = require("crypto");

// OTPهای موقت
const otpStore = new Map();

// توکن‌های تأیید موقت پس از تأیید OTP
const verifiedStore = new Map();

function normalizePhone(phone) {

    let value = String(phone || "")
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
        .replace(/\s+/g, "")
        .trim();

    // حذف +
    if (value.startsWith("+")) {
        value = value.substring(1);
    }

    // تبدیل 09xxxxxxxxx به 989xxxxxxxxx
    if (value.startsWith("09") && value.length === 11) {
        value = "98" + value.substring(1);
    }

    // اگر با 9 شروع شده باشد
    else if (value.startsWith("9") && value.length === 10) {
        value = "98" + value;
    }

    return value;
}


// ارسال OTP
app.post("/otp/send", async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "PHONE_REQUIRED"
            });
        }

        // تولید کد 6 رقمی
        const otp = crypto.randomInt(100000, 1000000).toString();

        // ذخیره OTP برای 5 دقیقه
        otpStore.set(phone, {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        const response = await fetch(
            "https://safir.bale.ai/api/v3/send_message",
            {
                method: "POST",
                headers: {
                    "api-access-key":
                        process.env.BALE_API_ACCESS_KEY,
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    bot_id: Number(process.env.BALE_BOT_ID),
                    phone_number: phone,
                    message_data: {
                        otp_message: {
                            otp: otp
                        }
                    }
                })
            }
        );

        const text = await response.text();

        console.log(
            "Bale status:",
            response.status
        );

        console.log(
            "Bale response:",
            text
        );

        if (!response.ok) {
            otpStore.delete(phone);

            return res.status(500).json({
                success: false,
                message: "BALE_ERROR"
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP_SENT"
        });

    } catch (error) {
        console.log(
            "OTP send error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "SERVER_ERROR"
        });
    }
});


// بررسی OTP
app.post("/otp/verify", async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const otp = String(req.body.otp || "").trim();

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });
        }

        const saved = otpStore.get(phone);

        if (!saved) {
            return res.status(400).json({
                success: false,
                message: "OTP_NOT_FOUND"
            });
        }

        if (Date.now() > saved.expiresAt) {
            otpStore.delete(phone);

            return res.status(400).json({
                success: false,
                message: "OTP_EXPIRED"
            });
        }

        saved.attempts++;

        if (saved.attempts > 5) {
            otpStore.delete(phone);

            return res.status(429).json({
                success: false,
                message: "TOO_MANY_ATTEMPTS"
            });
        }

        if (otp !== saved.otp) {
            return res.status(400).json({
                success: false,
                message: "INVALID_OTP"
            });
        }

    // OTP یکبار مصرف است
    otpStore.delete(phone);


    // ========================================
    // ساخت توکن تأیید موقت
    // ========================================

    const verificationToken =
        crypto.randomBytes(32).toString("hex");


    // ذخیره توکن برای 10 دقیقه
    verifiedStore.set(verificationToken, {

        phone: phone,

        expiresAt:
            Date.now() + 10 * 60 * 1000

    });


    // پاسخ موفق
    return res.status(200).json({

        success: true,

        message: "USER_VERIFIED",

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
            message: "SERVER_ERROR"
        });
    }
});

app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            `Server started on port ${PORT}`
        );

    }

);

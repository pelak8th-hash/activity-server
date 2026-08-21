const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 8080;


// ================================
// اتصال به Supabase
// ================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);


// ================================
// تنظیمات
// ================================

app.use(cors());
app.use(express.json());


// ================================
// تست سرور
// ================================

app.get("/", (req, res) => {

    res.status(200).send(
        "Activity server is running!"
    );

});


// ================================
// دریافت رزرو
// ================================

app.post("/activity", async (req, res) => {

    try {

        console.log("Received:", req.body);


        const {
            full_name,
            date,
            time,
            activity
        } = req.body;


        // ----------------------------
        // بررسی اطلاعات
        // ----------------------------

        if (
            typeof full_name !== "string" ||
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
            full_name.trim() === "" ||
            date.trim() === "" ||
            time.trim() === "" ||
            activity.trim() === ""
        ) {

            return res.status(400).json({
                success: false,
                message: "MISSING_DATA"
            });

        }


        // ----------------------------
        // جدا کردن نام و نام خانوادگی
        // ----------------------------

        const nameParts = full_name.trim().split(/\s+/);

        const firstName = nameParts.shift();

        const lastName = nameParts.join(" ");


        // اگر فقط یک اسم وارد شده باشد
        if (!lastName) {

            return res.status(400).json({
                success: false,
                message: "NAME_ERROR"
            });

        }


        // ----------------------------
        // ذخیره در Supabase
        // ----------------------------

        const { data, error } = await supabase
            .from("users")
            .insert([
                {
                    first_name: firstName,
                    last_name: lastName,
                    date: date.trim(),
                    time: time.trim(),
                    activity: activity.trim()
                }
            ])
            .select();


        // ----------------------------
        // خطای Supabase
        // ----------------------------

        if (error) {

            console.log("Supabase error:", error);

            return res.status(500).json({
                success: false,
                message: "DATABASE_ERROR"
            });

        }


        // ----------------------------
        // موفقیت
        // ----------------------------

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


// ================================
// شروع سرور
// ================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server started on port ${PORT}`
        );

    }
);

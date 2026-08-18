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
// تنظیمات سرور
// ================================

app.use(cors());
app.use(express.json());


// ================================
// تست آنلاین بودن سرور
// ================================

app.get("/", (req, res) => {

    res.status(200).send(
        "Activity server is running!"
    );

});


// ================================
// دریافت اطلاعات فعالیت
// POST /activity
// ================================

app.post("/activity", async (req, res) => {

    try {

        const {
            first_name,
            last_name,
            date,
            time,
            activity
        } = req.body;


        // ----------------------------
        // بررسی اطلاعات
        // ----------------------------

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


        // جلوگیری از ارسال اطلاعات خالی

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


        // ----------------------------
        // ذخیره در Supabase
        // ----------------------------

        const { error } = await supabase
            .from("users")
            .insert([
                {
                    first_name: first_name.trim(),
                    last_name: last_name.trim(),
                    date: date.trim(),
                    time: time.trim(),
                    activity: activity.trim()
                }
            ]);


        // ----------------------------
        // بررسی خطای Supabase
        // ----------------------------

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


        // ----------------------------
        // موفقیت
        // ----------------------------

        console.log(
            "Activity saved:",
            first_name,
            last_name,
            date,
            time,
            activity
        );


        return res.status(200).json({
            success: true,
            message: "SAVED"
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

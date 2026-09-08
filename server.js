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

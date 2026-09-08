const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 8080;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

app.use(cors());
app.use(express.json());


// تست سرور
app.get("/", (req, res) => {
    res.status(200).send(
        "Activity server is running!"
    );
});


// ثبت فعالیت
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


        // بررسی اطلاعات
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


        // ذخیره در Supabase

        const { data, error } = await supabase
            .from("users")
            .insert([
                {
                    first_name: first_name.trim(),
                    last_name: last_name.trim(),
                    date: date.trim(),
                    time: time.trim(),
                    activity: activity.trim()
                }
            ])
            .select();


        // خطای دیتابیس

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


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server started on port ${PORT}`
        );

    }
);

const http = require("http");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 8080;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error("Supabase environment variables are missing.");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
);


const server = http.createServer(async (req, res) => {

    // اجازه دسترسی HTML
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");


    // درخواست OPTIONS
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }


    // بررسی وضعیت سرور
    if (req.method === "GET" && req.url === "/") {

        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("Activity server is running!");

        return;
    }


    // ذخیره فعالیت
    if (req.method === "POST" && req.url === "/save") {

        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });


        req.on("end", async () => {

            try {

                const data = JSON.parse(body);

                const firstName = data.first_name;
                const lastName = data.last_name;
                const date = data.date;
                const time = data.time;
                const activity = data.activity;


                // بررسی اطلاعات
                if (
                    !firstName ||
                    !lastName ||
                    !date ||
                    !time ||
                    !activity
                ) {

                    res.writeHead(400, {
                        "Content-Type": "application/json; charset=utf-8"
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: "اطلاعات ناقص است."
                    }));

                    return;
                }


                // ذخیره در Supabase
                const { data: insertedData, error } = await supabase
                    .from("activities")
                    .insert([
                        {
                            first_name: firstName,
                            last_name: lastName,
                            date: date,
                            time: time,
                            activity: activity
                        }
                    ])
                    .select();


                if (error) {

                    console.error("Supabase error:", error);

                    res.writeHead(500, {
                        "Content-Type": "application/json; charset=utf-8"
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: "خطا در ذخیره اطلاعات."
                    }));

                    return;
                }


                // موفقیت
                res.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8"
                });

                res.end(JSON.stringify({
                    success: true,
                    message: "اطلاعات با موفقیت ذخیره شد.",
                    data: insertedData
                }));

            }

            catch (error) {

                console.error("Server error:", error);

                res.writeHead(400, {
                    "Content-Type": "application/json; charset=utf-8"
                });

                res.end(JSON.stringify({
                    success: false,
                    message: "اطلاعات ارسال شده صحیح نیست."
                }));
            }

        });

        return;
    }


    // آدرس نامعتبر
    res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Not Found");

});


server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Activity server started on port ${PORT}`
    );

});
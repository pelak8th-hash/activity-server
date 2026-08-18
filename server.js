const http = require("http");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 8080;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

const server = http.createServer(async (req, res) => {

    // پاسخ ساده برای تست آنلاین بودن سرور
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("Activity server is running!");
        return;
    }


    // دریافت اطلاعات فعالیت
    if (req.method === "POST" && req.url === "/activity") {

        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", async () => {

            try {

                const data = JSON.parse(body);

                const {
                    first_name,
                    last_name,
                    date,
                    time,
                    activity
                } = data;


                // بررسی اطلاعات ضروری
                if (
                    !first_name ||
                    !last_name ||
                    !date ||
                    !time ||
                    !activity
                ) {

                    res.writeHead(400, {
                        "Content-Type": "application/json"
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: "Missing information"
                    }));

                    return;
                }


                // ذخیره در Supabase
                const { error } = await supabase
                    .from("users")
                    .insert([
                        {
                            first_name: first_name,
                            last_name: last_name,
                            date: date,
                            time: time,
                            activity: activity
                        }
                    ]);


                if (error) {

                    console.log("Supabase error:", error);

                    res.writeHead(500, {
                        "Content-Type": "application/json"
                    });

                    res.end(JSON.stringify({
                        success: false,
                        message: "Database error"
                    }));

                    return;
                }


                console.log(
                    "Activity saved:",
                    first_name,
                    last_name,
                    date,
                    time,
                    activity
                );


                res.writeHead(200, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    success: true
                }));

            } catch (error) {

                console.log("Request error:", error);

                res.writeHead(400, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    success: false,
                    message: "Invalid request"
                }));
            }

        });

        return;
    }


    // مسیر ناشناخته
    res.writeHead(404);
    res.end("Not Found");

});


server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
});

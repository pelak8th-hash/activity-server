// ========================================
// بررسی رزروهای قدیمی
// حالت آزمایشی: هیچ اطلاعاتی حذف نمی‌شود
// ========================================

const { createClient } = require("@supabase/supabase-js");
const { toJalaali } = require("jalaali-js");

// اتصال به Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

async function main() {
    try {
        // تاریخ امروز ایران
        const iranDate = new Date(
            new Date().toLocaleString("en-US", {
                timeZone: "Asia/Tehran"
            })
        );

        const today = toJalaali(
            iranDate.getFullYear(),
            iranDate.getMonth() + 1,
            iranDate.getDate()
        );

        const todayJalali = [
            today.jy,
            String(today.jm).padStart(2, "0"),
            String(today.jd).padStart(2, "0")
        ].join("/");

        console.log("امروز به تاریخ شمسی:", todayJalali);

        // دریافت رزروها
        const { data, error } = await supabase
            .from("reservations")
            .select("id, date, time")
            .limit(1000);

        if (error) {
            throw error;
        }

        const oldReservations = (data || []).filter((reservation) => {
            const date = reservation.date;

            // فقط تاریخ‌هایی با قالب معتبر بررسی می‌شوند
            if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date || "")) {
                console.log("تاریخ نامعتبر؛ نادیده گرفته شد:", date);
                return false;
            }

            // قالب YYYY/MM/DD باعث مقایسه صحیح رشته‌ای می‌شود
            return date < todayJalali;
        });

        console.log("تعداد رزروهای بررسی‌شده:", data.length);
        console.log("تعداد رزروهای قدیمی:", oldReservations.length);

        for (const reservation of oldReservations) {
            console.log(
                "رزرو قدیمی:",
                reservation.id,
                reservation.date,
                reservation.time
            );
        }

        console.log("حالت آزمایشی فعال است؛ هیچ رزروی حذف نشد.");

    } catch (error) {
        console.error("خطا در بررسی رزروها:", error);
        process.exitCode = 1;
    }
}

main();

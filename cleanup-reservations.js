const { createClient } = require("@supabase/supabase-js");
const { toJalaali } = require("jalaali-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * محاسبه تاریخ امروز ایران به تقویم شمسی
 */
function getTodayJalali() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "numeric",
        day: "numeric"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
        if (part.type !== "literal") {
            values[part.type] = Number(part.value);
        }
    }

    const jalali = toJalaali(
        values.year,
        values.month,
        values.day
    );

    return [
        jalali.jy,
        String(jalali.jm).padStart(2, "0"),
        String(jalali.jd).padStart(2, "0")
    ].join("/");
}

async function main() {
    const today = getTodayJalali();

    console.log("==================================");
    console.log("RESERVATION ARCHIVE");
    console.log("Iranian date:", today);
    console.log("MODE: LIVE ARCHIVING");
    console.log("==================================");

    // شمارش رزروهای فعال پیش از بایگانی
    const {
        count: beforeCount,
        error: countError
    } = await supabase
        .from("reservations")
        .select("*", {
            count: "exact",
            head: true
        });

    if (countError) {
        throw new Error(
            `Could not count active reservations: ${countError.message}`
        );
    }

    console.log("Active reservations before:", beforeCount);

    // انتقال رزروهای قدیمی به جدول بایگانی
    const {
        data,
        error
    } = await supabase.rpc(
        "archive_past_reservations",
        {
            p_today: today
        }
    );

    if (error) {
        throw new Error(
            `Archiving failed: ${error.message}`
        );
    }

    console.log("Reservations archived in this run:", data);

    // شمارش رزروهای فعال پس از بایگانی
    const {
        count: afterCount,
        error: afterError
    } = await supabase
        .from("reservations")
        .select("*", {
            count: "exact",
            head: true
        });

    if (afterError) {
        throw new Error(
            `Could not count active reservations after archiving: ${afterError.message}`
        );
    }

    // شمارش رزروهای بایگانی‌شده
    const {
        count: archivedCount,
        error: archivedError
    } = await supabase
        .from("reservation_delete")
        .select("*", {
            count: "exact",
            head: true
        });

    if (archivedError) {
        throw new Error(
            `Could not count archived reservations: ${archivedError.message}`
        );
    }

    console.log("Active reservations after:", afterCount);
    console.log("Total archived reservations:", archivedCount);
    console.log("Iranian date used:", today);
    console.log("Archiving operation completed.");
}

main().catch((error) => {
    console.error("Archiving failed:", error.message);
    process.exitCode = 1;
});

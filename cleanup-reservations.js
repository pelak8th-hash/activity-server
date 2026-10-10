const { createClient } = require("@supabase/supabase-js");
const { toJalaali } = require("jalaali-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTodayJalali() {
    // دریافت تاریخ میلادی امروز به وقت ایران
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

    const year = String(jalali.jy);
    const month = String(jalali.jm).padStart(2, "0");
    const day = String(jalali.jd).padStart(2, "0");

    return `${year}/${month}/${day}`;
}

async function main() {
    const today = getTodayJalali();

    console.log("Iranian date:", today);
    console.log("Checking past reservations...");

    // دریافت رزروها به‌صورت صفحه‌بندی‌شده
    const pageSize = 500;
    let offset = 0;
    const oldReservationIds = [];

    while (true) {
        const { data, error } = await supabase
            .from("reservations")
            .select("id, date")
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);

        if (error) {
            throw new Error(
                `Could not fetch reservations: ${error.message}`
            );
        }

        if (!data || data.length === 0) {
            break;
        }

        for (const reservation of data) {
            const date = reservation.date;

            // فقط تاریخ‌های شمسی با قالب معتبر بررسی می‌شوند.
            if (
                typeof date === "string" &&
                /^\d{4}\/\d{2}\/\d{2}$/.test(date) &&
                date < today
            ) {
                oldReservationIds.push(reservation.id);
            }
        }

        if (data.length < pageSize) {
            break;
        }

        offset += pageSize;
    }

    console.log(
        `Past reservations found: ${oldReservationIds.length}`
    );

    if (oldReservationIds.length === 0) {
        console.log("Nothing to delete.");
        return;
    }

    // حذف گروهی رزروهای گذشته
    const batchSize = 100;

    for (
        let i = 0;
        i < oldReservationIds.length;
        i += batchSize
    ) {
        const batch = oldReservationIds.slice(
            i,
            i + batchSize
        );

        const { data, error } = await supabase
            .from("reservations")
            .delete()
            .in("id", batch)
            .select("id");

        if (error) {
            throw new Error(
                `Deletion failed: ${error.message}`
            );
        }

        console.log(
            `Deleted ${data.length} reservations in this batch.`
        );
    }

    console.log("Cleanup completed successfully.");
}

main().catch((error) => {
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
});

const { createClient } = require("@supabase/supabase-js");
const { toJalaali } = require("jalaali-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

    const year = String(jalali.jy);
    const month = String(jalali.jm).padStart(2, "0");
    const day = String(jalali.jd).padStart(2, "0");

    return `${year}/${month}/${day}`;
}

async function main() {
    const today = getTodayJalali();

    console.log("==================================");
    console.log("RESERVATION CLEANUP - DRY RUN");
    console.log("Iranian date:", today);
    console.log("MODE: REPORT ONLY - NO DELETIONS");
    console.log("==================================");

    const pageSize = 500;
    let offset = 0;
    let totalReservations = 0;
    let totalPastReservations = 0;

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

        totalReservations += data.length;

        const pastReservations = data.filter((reservation) => {
            const date = reservation.date;

            return (
                typeof date === "string" &&
                /^\d{4}\/\d{2}\/\d{2}$/.test(date) &&
                date < today
            );
        });

        totalPastReservations += pastReservations.length;

        for (const reservation of pastReservations) {
            console.log(
                `PAST RESERVATION: id=${reservation.id}, date=${reservation.date}`
            );
        }

        if (data.length < pageSize) {
            break;
        }

        offset += pageSize;
    }

    console.log("----------------------------------");
    console.log("Total reservations checked:", totalReservations);
    console.log("Past reservations found:", totalPastReservations);
    console.log("No reservations were deleted.");
    console.log("DRY RUN COMPLETED");
}

main().catch((error) => {
    console.error("Dry run failed:", error.message);
    process.exitCode = 1;
});

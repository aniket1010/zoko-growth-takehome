import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
let lastId = 0;
for (;;) {
  try {
    const rows = await sql`select id, event, processed_at is not null as ok, error from raw_events where id > ${lastId} order by id`;
    for (const r of rows) { console.log(`#${r.id} ${r.event} ${r.ok ? "parsed" : r.error ? "ERROR " + r.error : "stored"}`); lastId = r.id; }
  } catch (e) { console.log("watch error " + e.message); }
  await new Promise((r) => setTimeout(r, 15000));
}

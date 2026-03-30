module.exports = async function handler(req, res) {
  const matches = [
    { id: "914572", date: "2026-04-08", time: "20:30", home: "FB 10",        away: "FB 8",          venue: "Jens Jessens Vej" },
    { id: "914577", date: "2026-04-18", time: "16:00", home: "FB 8",         away: "Slægtens BK",   venue: "Jens Jessens Vej" },
    { id: "914580", date: "2026-04-22", time: "19:15", home: "VLI",          away: "FB 8",          venue: "Jens Jessens Vej" },
    { id: "914587", date: "2026-05-02", time: "14:00", home: "FB 8",         away: "FA 2000 4",     venue: "Jens Jessens Vej" },
    { id: "914591", date: "2026-05-08", time: "17:30", home: "Østerbro IF 7",away: "FB 8",          venue: "Ryparken Idrætsanlæg" },
    { id: "914597", date: "2026-05-17", time: "16:00", home: "FB 8",         away: "Fremad Valby 3",venue: "Jens Jessens Vej" },
    { id: "914599", date: "2026-05-21", time: "20:30", home: "B.93 2",       away: "FB 8",          venue: "B 93 Svanemølleanlæg" },
    { id: "914610", date: "2026-05-30", time: "14:00", home: "FB 8",         away: "Frem 7",        venue: "Jens Jessens Vej" },
    { id: "914615", date: "2026-06-06", time: "15:00", home: "KFUM",         away: "FB 8",          venue: "Valby Idrætspark" },
  ];
 
  const ics = buildICS(matches);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="FB8.ics"');
  res.setHeader("Cache-Control", "s-maxage=3600");
  res.status(200).send(ics);
};
 
function buildICS(matches) {
  const events = matches.map((m) => {
    const [year, month, day] = m.date.split("-");
    const [hour, minute] = m.time.split(":");
    const endHour = String(parseInt(hour) + 1).padStart(2, "0");
 
    return `BEGIN:VEVENT
UID:${m.id}@dbu-fb8-calendar
DTSTART;TZID=Europe/Copenhagen:${year}${month}${day}T${hour}${minute}00
DTEND;TZID=Europe/Copenhagen:${year}${month}${day}T${endHour}${minute}00
SUMMARY:${m.home} vs ${m.away}
LOCATION:${m.venue}
DESCRIPTION:Kamp nr. ${m.id} - FB 8 - Herre Senior 3 7:7 Forår
END:VEVENT`;
  }).join("\n");
 
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FB8 Calendar//DA
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:FB 8 Kampprogram
X-WR-TIMEZONE:Europe/Copenhagen
${events}
END:VCALENDAR`;
}
 

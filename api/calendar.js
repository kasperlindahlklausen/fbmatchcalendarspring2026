export default async function handler(req, res) {
  // Only hardcoded thing: the DBU team URL. Change this for any other team.
  const url = "https://dbu.dk/resultater/hold/32007_489367/kampprogram";

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; calendar-bot/1.0)" },
  });

  if (!response.ok) {
    res.status(502).send("Failed to fetch DBU schedule");
    return;
  }

  const html = await response.text();
  const matches = parseMatches(html);

  if (matches.length === 0) {
    res.status(500).send("No matches found — DBU may have changed their HTML");
    return;
  }

  const ics = buildICS(matches);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="FB8.ics"');
  res.setHeader("Cache-Control", "s-maxage=3600"); // Vercel caches for 1 hour
  res.status(200).send(ics);
}

function parseMatches(html) {
  const matches = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    // Valid match rows contain a 6-digit match number
    const idMatch = row.match(/>\s*(\d{6})\s*<\/td>/);
    if (!idMatch) continue;

    // Date: e.g. "ons.08-04 2026"
    const dateMatch = row.match(/(?:man|tir|ons|tor|fre|lør|søn)\.(\d{2}-\d{2})\s+(\d{4})/i);

    // Time: e.g. "20:30"
    const timeMatch = row.match(/(\d{2}:\d{2})/);

    // Teams: links to /resultater/hold/
    const teamMatches = [...row.matchAll(/resultater\/hold\/[^"]+">([^<]+)<\/a>/g)];

    // Venue: link to /resultater/stadium/
    const venueMatch = row.match(/resultater\/stadium\/[^"]+">([^<]+)<\/a>/);

    if (!dateMatch || !timeMatch || teamMatches.length < 2) continue;

    const [day, month] = dateMatch[1].split("-");
    const year = dateMatch[2];

    matches.push({
      id: idMatch[1],
      date: `${year}-${month}-${day}`,
      time: timeMatch[1],
      home: teamMatches[0][1].trim(),
      away: teamMatches[1][1].trim(),
      venue: venueMatch ? venueMatch[1].trim() : "Ukendt spillested",
    });
  }

  return matches;
}

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

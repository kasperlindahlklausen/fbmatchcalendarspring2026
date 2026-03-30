module.exports = async function handler(req, res) {
  const url = "https://dbu.dk/resultater/hold/32007_489367/kampprogram";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      res.status(502).send("Failed to fetch DBU schedule: " + response.status);
      return;
    }

    const html = await response.text();
    const matches = parseMatches(html);

    if (matches.length === 0) {
      // Return debug info to help diagnose
      res.status(500).send("No matches found. HTML snippet: " + html.substring(0, 2000));
      return;
    }

    const ics = buildICS(matches);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="FB8.ics"');
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).send(ics);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
};

function parseMatches(html) {
  const matches = [];

  // Try multiple patterns to find match rows

  // Pattern 1: Look for 6-digit match numbers near date patterns
  const matchBlocks = html.match(/\d{6}[\s\S]{0,500}?(?:man|tir|ons|tor|fre|lør|søn)\.\d{2}-\d{2}\s+\d{4}/gi) || [];

  for (const block of matchBlocks) {
    const idMatch = block.match(/(\d{6})/);
    const dateMatch = block.match(/(?:man|tir|ons|tor|fre|lør|søn)\.(\d{2}-\d{2})\s+(\d{4})/i);
    const timeMatch = block.match(/(\d{2}:\d{2})/);

    if (!idMatch || !dateMatch || !timeMatch) continue;

    const [day, month] = dateMatch[1].split("-");
    const year = dateMatch[2];

    matches.push({
      id: idMatch[1],
      date: `${year}-${month}-${day}`,
      time: timeMatch[1],
      home: "FB 8 kamp",
      away: "",
      venue: "Se DBU",
    });
  }

  // Pattern 2: Row-based parsing
  if (matches.length === 0) {
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const idMatch = row.match(/(\d{6})/);
      if (!idMatch) continue;

      const dateMatch = row.match(/(?:man|tir|ons|tor|fre|lør|søn)\.(\d{2}-\d{2})\s+(\d{4})/i);
      const timeMatch = row.match(/(\d{2}:\d{2})/);
      const teamMatches = [...row.matchAll(/hold\/[^"]+">([^<]+)<\/a>/g)];
      const venueMatch = row.match(/stadium\/[^"]+">([^<]+)<\/a>/);

      if (!dateMatch || !timeMatch) continue;

      const [day, month] = dateMatch[1].split("-");
      const year = dateMatch[2];

      matches.push({
        id: idMatch[1],
        date: `${year}-${month}-${day}`,
        time: timeMatch[1],
        home: teamMatches[0] ? teamMatches[0][1].trim() : "Hjemmehold",
        away: teamMatches[1] ? teamMatches[1][1].trim() : "Udehold",
        venue: venueMatch ? venueMatch[1].trim() : "Ukendt spillested",
      });
    }
  }

  // Pattern 3: Plain text scan for dates and times
  if (matches.length === 0) {
    const dateTimePattern = /(\d{6})[\s\S]{1,100}?((?:man|tir|ons|tor|fre|lør|søn)\.(\d{2}-\d{2})\s+(\d{4}))[\s\S]{1,50}?(\d{2}:\d{2})/gi;
    let m;
    while ((m = dateTimePattern.exec(html)) !== null) {
      const [day, month] = m[3].split("-");
      matches.push({
        id: m[1],
        date: `${m[4]}-${month}-${day}`,
        time: m[5],
        home: "FB 8",
        away: "",
        venue: "Se DBU",
      });
    }
  }

  return matches;
}

function buildICS(matches) {
  const events = matches.map((m) => {
    const [year, month, day] = m.date.split("-");
    const [hour, minute] = m.time.split(":");
    const endHour = String(parseInt(hour) + 1).padStart(2, "0");
    const summary = m.away ? `${m.home} vs ${m.away}` : m.home;

    return `BEGIN:VEVENT
UID:${m.id}@dbu-fb8-calendar
DTSTART;TZID=Europe/Copenhagen:${year}${month}${day}T${hour}${minute}00
DTEND;TZID=Europe/Copenhagen:${year}${month}${day}T${endHour}${minute}00
SUMMARY:${summary}
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

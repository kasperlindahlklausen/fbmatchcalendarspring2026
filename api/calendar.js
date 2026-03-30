module.exports = async function handler(req, res) {
  // DBU JSON API endpoint for this team's matches
  const apiUrl = "https://dbu.dk/api/tournament/team/32007_489367/matches";

  try {
    let matches = await tryJsonApi(apiUrl);

    // If JSON API fails, try the HTML endpoint with different headers
    if (!matches || matches.length === 0) {
      matches = await tryHtmlScrape();
    }

    if (!matches || matches.length === 0) {
      res.status(500).send("Could not fetch matches from DBU");
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

async function tryJsonApi(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; calendar-bot/1.0)",
        "Referer": "https://dbu.dk/",
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    // Try to extract matches from whatever shape the API returns
    const items = data.matches || data.data || data.items || data || [];
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map(m => ({
      id: String(m.id || m.matchId || m.matchNumber || Math.random()),
      date: m.date || m.matchDate || m.startDate,
      time: m.time || m.matchTime || m.startTime || "00:00",
      home: m.homeTeam?.name || m.home || "Hjemmehold",
      away: m.awayTeam?.name || m.away || "Udehold",
      venue: m.venue?.name || m.stadium || m.location || "Ukendt spillested",
    }));
  } catch {
    return null;
  }
}

async function tryHtmlScrape() {
  const url = "https://dbu.dk/resultater/hold/32007_489367/kampprogram";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Cache-Control": "max-age=0",
    },
  });

  if (!response.ok) return null;
  const html = await response.text();

  // Check if we got real content
  if (!html.includes("kampprogram") && !html.includes("Kampnr")) return null;

  const matches = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const idMatch = row.match(/>\s*(\d{6})\s*<\/td>/);
    if (!idMatch) continue;

    const dateMatch = row.match(/(?:man|tir|ons|tor|fre|lør|søn)\.(\d{2}-\d{2})\s+(\d{4})/i);
    const timeMatch = row.match(/(\d{2}:\d{2})/);
    const teamMatches = [...row.matchAll(/hold\/[^"]+">([^<]+)<\/a>/g)];
    const venueMatch = row.match(/stadium\/[^"]+">([^<]+)<\/a>/);

    if (!dateMatch || !timeMatch) continue;

    const [day, month] = dateMatch[1].split("-");
    matches.push({
      id: idMatch[1],
      date: `${dateMatch[2]}-${month}-${day}`,
      time: timeMatch[1],
      home: teamMatches[0]?.[1]?.trim() || "Hjemmehold",
      away: teamMatches[1]?.[1]?.trim() || "Udehold",
      venue: venueMatch?.[1]?.trim() || "Ukendt spillested",
    });
  }

  return matches.length > 0 ? matches : null;
}

function buildICS(matches) {
  const events = matches.map((m) => {
    // Handle both "YYYY-MM-DD" and other date formats
    let year, month, day, hour, minute;

    if (m.date && m.date.includes("-")) {
      [year, month, day] = m.date.split("-");
    } else {
      return null;
    }

    if (m.time && m.time.includes(":")) {
      [hour, minute] = m.time.split(":");
    } else {
      hour = "12"; minute = "00";
    }

    const endHour = String(parseInt(hour) + 1).padStart(2, "0");

    return `BEGIN:VEVENT
UID:${m.id}@dbu-fb8-calendar
DTSTART;TZID=Europe/Copenhagen:${year}${month}${day}T${hour}${minute}00
DTEND;TZID=Europe/Copenhagen:${year}${month}${day}T${endHour}${minute}00
SUMMARY:${m.home} vs ${m.away}
LOCATION:${m.venue}
DESCRIPTION:Kamp nr. ${m.id} - FB 8 - Herre Senior 3 7:7 Forår
END:VEVENT`;
  }).filter(Boolean).join("\n");

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

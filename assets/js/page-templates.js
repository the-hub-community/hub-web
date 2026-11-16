(function () {
  "use strict";

  window.HubPageTemplates = [
    {
      id: "events",
      label: "Event list",
      title: "[City] Events — [Month / Season]",
      content:
        "<p>Last checked: [date]. Upcoming events in [City], [dates]. Check each official link before you go.</p>" +
        "<p><strong>UPCOMING EVENTS</strong></p>" +
        "<ul>" +
        "<li>[Event name] — [Day, date, time, place] — [FREE / price]</li>" +
        "</ul><p>[Official event link]</p>" +
        "<ul>" +
        "<li>[Event name] — [Day, date, time, place] — [FREE / price]</li>" +
        "</ul><p>[Official event link]</p>",
    },
    {
      id: "deals",
      label: "Deals",
      title: "Best Deals in [City] This Week — [week dates]",
      content:
        "<p>Last checked: [date]. Deals in [City] for [week dates]. Check store links before shopping.</p>" +
        "<p><strong>GROCERIES</strong></p><ul><li>[Store] — [<strong>X%</strong> OFF] [item], valid till [date]</li></ul><p>[Official store link]</p>" +
        "<p><strong>ELECTRONICS</strong></p><ul><li>[Store] — [<strong>X%</strong> OFF] [item], valid till [date]</li></ul><p>[Official store link]</p>" +
        "<p><strong>FASHION</strong></p><ul><li>[Store] — [<strong>X%</strong> OFF] [item], valid till [date]</li></ul><p>[Official store link]</p>" +
        "<p><strong>FOOD</strong></p><ul><li>[Store] — [<strong>X%</strong> OFF] [item], valid till [date]</li></ul><p>[Official store link]</p>",
    },
    {
      id: "restaurant",
      label: "Restaurant",
      title: "[City] Cheap Eats Near [Event / Area]",
      content:
        "<p>Last checked: [date]. Affordable places to eat near [Event / Area].</p>" +
        "<p><strong>RESTAURANT: [Restaurant name]</strong></p>" +
        "<ul><li>[What it is, one line]</li><li>What to try: [dish]</li><li>Price: [price, date checked]</li><li>Address: [address]</li><li>Website:</li></ul>" +
        "<p>[Website link]</p><ul><li>Map:</li></ul><p>[Map link]</p>" +
        "<p><strong>RESTAURANT: [Restaurant name]</strong></p>" +
        "<ul><li>[What it is, one line]</li><li>What to try: [dish]</li><li>Price: [price, date checked]</li><li>Address: [address]</li><li>Website:</li></ul>" +
        "<p>[Website link]</p><ul><li>Map:</li></ul><p>[Map link]</p>",
    },
    {
      id: "course",
      label: "Course",
      title: "[Provider] Online Course — [Course name] — Register by [date]",
      content:
        "<p>Last checked: [date]. [One-line course introduction.]</p>" +
        "<p><strong>COURSE DETAILS</strong></p>" +
        "<ul>" +
        "<li>What it is: [one line]</li>" +
        "<li>Duration: [hours, self-paced / dates]</li>" +
        "<li>Fee: [Free / exact fee and currency, certificate included / extra]</li>" +
        "<li>Who can join: [level, worldwide]</li>" +
        "<li>Deadline: [date]</li>" +
        "<li>How to apply: [step 1, step 2, step 3]</li>" +
        "<li>Official link:</li>" +
        "</ul><p>[Official course link]</p>",
    },
    {
      id: "guide",
      label: "Guide / trip",
      title: "[Place] — [What it covers]",
      content:
        "<p>Last checked: [date]. [One-line introduction to this place or trip.]</p>" +
        "<p><strong>AT A GLANCE</strong></p><ul><li>[3–4 facts]</li></ul>" +
        "<p><strong>HOW TO GET THERE</strong></p><ul><li>[Options]</li></ul>" +
        "<p><strong>DAY 1</strong></p><ul><li>[One bullet per stop]</li></ul>" +
        "<p><strong>DAY 2</strong></p><ul><li>[One bullet per stop]</li></ul>" +
        "<p><strong>WHAT TO CHECK BEFORE YOU GO</strong></p><ul><li>[Passes, bookings, season]</li></ul>" +
        "<p><strong>REFERENCE LINKS</strong></p><p>[Official link]</p>",
    },
    {
      id: "movies",
      label: "Movie / community wall",
      title: "[City] Movies — What We Are Watching",
      content:
        "<p>Last checked: [date]. Movies community wall for [City].</p>" +
        "<p><strong>MOVIES</strong></p>" +
        "<ul>" +
        "<li>[Movie name] — [where to watch, language]</li>" +
        "<li>[One-line, non-spoiler take]</li>" +
        "<li>Trailer:</li>" +
        "</ul><p>[YouTube link]</p>" +
        "<ul>" +
        "<li>[Movie name] — [where to watch, language]</li>" +
        "<li>[One-line, non-spoiler take]</li>" +
        "<li>Trailer:</li>" +
        "</ul><p>[YouTube link]</p>" +
        "<p>Add one bullet per movie. Add a take in a comment instead of editing the whole page.</p>",
    },
    {
      id: "community-home",
      label: "Community home page (Stock Market Investors example)",
      title: "[Community name]",
      content:
        "<p>Last checked: [date]. [One-line introduction to this community.]</p>" +
        "<p><strong>WHAT THIS COMMUNITY COVERS</strong></p><ul><li>[Topics and purpose]</li></ul>" +
        "<p><strong>HOW TO USE IT</strong></p><ul><li>[How readers find and use information]</li></ul>" +
        "<p><strong>PORTFOLIOS / SECTIONS</strong></p><ul><li>[Section name]</li></ul><p>[Section link]</p>" +
        "<p><strong>HOW TO CONTRIBUTE</strong></p><ul><li>[How to submit a page or comment]</li></ul>" +
        "<p><strong>WHAT NOT TO POST</strong></p><ul><li>[Privacy and content boundaries]</li></ul>" +
        "<p><strong>SOURCES TO CHECK</strong></p><ul><li>[Source name or claim]</li></ul><p>[Official source link]</p>",
    },
  ];
})();

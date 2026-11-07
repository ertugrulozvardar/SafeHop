# App Review Information → Notes (resubmission after Guideline 2.1 – Information Needed)

Paste everything inside the block into the **Notes** field (replace the old text).

```
1. Screen recording
Screen recording on a physical iPhone (iPhone 17, iOS 26.5.2), starting from app launch and showing the typical user flow:
https://www.youtube.com/watch?v=KUvfB9_0rNE
SafeHop has no account registration or login, no user-generated content, and no paid content or in-app purchases, so there are no such flows to show.

2. Purpose and target audience
SafeHop helps travelers (tourists and business travelers visiting U.S. cities) understand which neighborhoods have more or fewer reported crime incidents before they book a place to stay, park a rental car or go out. For Chicago, Los Angeles, New York City, Miami and Seattle it shows a neighborhood map colored by the last 6 months of incidents reported to police (per km², compared only with other areas in the same city), with filters for the categories that matter to travelers: pickpocketing, car break-ins, theft, robbery, assault, burglary and vehicle theft.
Problem solved: official police data is public but hard for visitors to find and interpret. SafeHop turns it into a simple, transparent map and clearly explains its limitations (not every crime is reported; it is not a guarantee of safety).

3. How to use the app
No setup, login or sample files are needed.
- Open the app and choose a city.
- The map loads with every area colored green / yellow / red.
- Tap the category buttons at the top of the map to filter (e.g. "Pickpocketing").
- Tap any colored area to see the number of reported incidents, the rate per km², the 6-month trend and the breakdown by category.
- "About" (top right on the map screen, or the link on the home screen) explains the methodology, limitations and data sources, with links to each source and to the privacy policy.
The app downloads the latest data over the internet; if the device is offline, a bundled copy of the data is shown.

4. External services used
- Official city open-data portals (public government data). They are read by our own daily server-side job, not directly by the app: Chicago Data Portal (data.cityofchicago.org), NYC Open Data (data.cityofnewyork.us), Los Angeles Open Data (data.lacity.org), Seattle Open Data (data.seattle.gov) and City of Miami Open Data GIS (ArcGIS).
- GitHub Actions and GitHub Pages: the daily job aggregates the public records by neighborhood and publishes small static JSON files at ertugrulozvardar.github.io/SafeHop, which the app downloads.
- Apple Maps (MapKit) for the base map.
No authentication, payment, analytics, advertising or AI services are used. The app collects no personal data and does not use location.

5. Regional differences
The app works the same way in all regions. Its content covers five U.S. cities and is in English. Data freshness differs by city because each police department publishes on its own schedule (for example, NYPD publishes quarterly); the app shows the date range for each city.

6. Regulated industry / third-party material
Not applicable. SafeHop does not provide services in a regulated industry. It shows aggregated statistics derived from public open data that the city governments publish for public reuse; each source is credited in the app and in the App Store description. SafeHop is independent and not affiliated with or endorsed by any police department or government agency.
```

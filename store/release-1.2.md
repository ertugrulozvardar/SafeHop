# SafeHop 1.2 – App Store texts

Everything below goes into App Store Connect → SafeHop → **iOS App 1.2.0** (the new version).
Fields not listed here (category, privacy URL, age rating, App Privacy answers…) carry over from 1.1 and stay as they are.

---

## Screenshots — replace all of them

The 1.1 screenshots are copied into the new version. In **both** iPhone slots, delete them and upload the 10 files below in this order (max 10 per slot):

| # | File | Headline |
|---|------|----------|
| 1 | 01-chicago-map.png | Know the neighborhood before you go |
| 2 | 02-stay-prices.png | **NEW** Safety and price, side by side |
| 3 | 03-monthly-rent.png | **NEW** Staying longer? Compare rents |
| 4 | 04-safest-route.png | Find the safest route |
| 5 | 05-area-details.png | Tap any area for the details |
| 6 | 06-rent-map.png | **NEW** Lower-crime areas within your budget |
| 7 | 07-nyc-pickpocketing.png | Spot pickpocketing hot spots |
| 8 | 08-la-robbery.png | Robbery, assault, car break-ins & more |
| 9 | 09-plan-a-route.png | Pick two places, walk or drive |
| 10 | 10-cities.png | 5 major US cities |

- **iPhone 6.9"** → `store/screenshots/` (1320×2868)
- **iPhone 6.3"** → `store/screenshots-6.3/` (1206×2622)

The first three show up in App Store search results, so the two new price screens are at #2 and #3.
Not uploaded (kept in `unused/`): Miami area card, methodology page, and a New York nightly-price variant.

## What's New in This Version (max 4000)

```
NEW: Stay and Rent prices
Two new tabs on every city map show what it costs to live or stay in each neighborhood, right next to how much crime is reported there.

• Stay: typical nightly price for an entire place or a private room, from short-term rental listings
• Rent: typical monthly rent from a studio to 3 bedrooms, from U.S. government (HUD) estimates
• "Lower-crime areas only" fades out higher-crime areas so you can compare the rest
• Tap any area to see its safety level and its price on one card

Nightly prices are not available for Miami yet. SafeHop still has no accounts, no ads and no tracking.
```

## Promotional Text (max 170) — can be changed any time without review

```
New: see what a night or a month costs in each neighborhood, right next to its crime level. Plus safest routes in Chicago, LA, New York, Miami & Seattle.
```

## Subtitle (max 30) — no change

```
Safe routes & neighborhoods
```

## Keywords (max 100) — replace

Words already in the name and subtitle (safe, routes, neighborhoods) are left out, and single words let Apple combine them ("crime map", "crime rate", "safety map"…).

```
crime,map,rate,safety,tourist,pickpocket,rent,stay,hotel,chicago,new york,los angeles,miami,seattle
```

## Description (max 4000) — full text, replace the old one

```
SafeHop helps travelers and newcomers understand which neighborhoods see more reported crime, what it costs to stay there, and how to get around safely, before you book a hotel, sign a lease or head out for the evening.

Pick a city and the map colors every neighborhood green, yellow or red based on six months of official police data. Tap any area to see what was reported there, how it compares with the rest of the city and how it changed over time.

STAY AND RENT PRICES
Switch the map to Stay or Rent to see what each neighborhood typically costs, right next to its crime level.
• Stay: the typical nightly price for an entire place or a private room
• Rent: the typical monthly rent from a studio to 3 bedrooms
• Turn on "Lower-crime areas only" to fade out higher-crime areas and compare the rest
• Tap an area to see its safety level and its price on one card

SAFEST ROUTE
Choose a start and a destination, walking or driving, and SafeHop compares realistic routes by the crime reported in the areas they pass through. You see the safest and the least safe route with their travel times, and can start the route in Apple Maps or Google Maps.

WHAT YOU CAN SEE
• Pickpocketing & bag/phone snatching
• Car break-ins
• Other theft
• Robbery
• Assault
• Burglary
• Vehicle theft
Filter the map, and the route comparison, by any category.

CITIES
Chicago, Los Angeles, New York City, Miami and Seattle.

HOW IT WORKS
SafeHop counts incidents reported to police over the last 6 months and divides them by each area's size. Areas are compared only with other areas in the same city: green is the third with the fewest reports per km², red the third with the most. Prices are split the same way into cheaper, mid-range and pricier thirds within each city. Routes are compared by the crime level of the areas they pass through, weighted by the distance in each area. Crime data is refreshed daily as police departments publish new records.

DATA SOURCES
Crime data comes from official open-data portals:
• Chicago Police Department – data.cityofchicago.org
• Los Angeles Police Department – data.lacity.org
• New York City Police Department – data.cityofnewyork.us
• City of Miami Police Department – City of Miami Open Data
• Seattle Police Department – data.seattle.gov
Nightly prices: median of active short-term rental listings per area, from Inside Airbnb (insideairbnb.com, CC BY 4.0).
Monthly rents: HUD Small Area Fair Market Rents, U.S. Department of Housing and Urban Development.
Routes and place search: © OpenStreetMap contributors.

PLEASE NOTE
SafeHop is an independent app and is not affiliated with, or endorsed by, any police department, government agency, Airbnb or Inside Airbnb. It shows reported incidents, not a guarantee of safety: not every crime is reported, and busy areas see more reports simply because more people are there. Crime data is per neighborhood, so two streets in the same area can't be told apart. Prices are guides, not quotes: they change with season, events and the specific home, and SafeHop does not offer bookings or listings. Nightly prices are not available for Miami. New York crime data is published quarterly. Miami covers the City of Miami only (not Miami Beach). In an emergency, call 911.

PRIVACY
No accounts, no ads, no tracking. SafeHop does not collect personal data or use your location.
```

## App Review Information → Notes — replace the old text

```
Version 1.2 adds "Stay" and "Rent" tabs to each city map. Everything from version 1.1 (including "Safest route") is unchanged.

How to test the new feature:
1. Open the app and choose a city (for example Chicago).
2. At the top of the map, tap "Stay". Areas are colored by their typical nightly price. Switch between "Entire place" and "Private room".
3. Tap "Lower-crime areas only" to fade out the higher-crime areas.
4. Tap any area. The card shows its safety level and its price; "See crime details for this area" switches to the crime view.
5. Tap "Rent" and choose Studio, 1 bed, 2 beds or 3 beds to see typical monthly rents.
Miami has no nightly price data; the app shows a message on the Stay tab there.

Screen recording on a physical iPhone (version 1.0 flow): https://www.youtube.com/watch?v=KUvfB9_0rNE

Where the price data comes from:
The prices are prepared by the same scheduled job that prepares the crime data and are downloaded from our own data server on GitHub Pages (ertugrulozvardar.github.io/SafeHop). The app contacts no new third-party service for this feature.
- Nightly prices: median price per area of short-term rental listings collected by Inside Airbnb (insideairbnb.com), licensed CC BY 4.0 and attributed in the app. Only area medians are shown; no individual listings, hosts or links.
- Monthly rents: HUD Small Area Fair Market Rents (U.S. Department of Housing and Urban Development, public data).
SafeHop is not affiliated with Airbnb, Inside Airbnb or HUD and offers no bookings, payments or listings.

The app still has no login, no user-generated content, no ads, no analytics, no in-app purchases, collects no personal data and does not use location. The route feature sends only the two points the user chooses to Valhalla (FOSSGIS) and Photon (komoot), as described in version 1.1.

SafeHop is independent and not affiliated with or endorsed by any police department or government agency.
```

---

## Steps

1. **Build and send to App Store Connect** (from the `app` folder):
   ```
   eas build --platform ios --profile production --auto-submit
   ```
   The build number goes up automatically; the version is 1.2.0 (app.config.ts). Apple processes the build in about 10–30 minutes.
2. **App Store Connect → SafeHop → "+" next to iOS App** → new version **1.2.0** (same as the app's version).
3. Paste What's New, Promotional Text, Keywords and Description from above.
4. Replace the screenshots in the 6.9" and 6.3" slots (table above).
5. **Build** → pick the new 1.2.0 build once it has finished processing.
6. Replace the **App Review notes**.
7. **Add for Review → Submit**.

The App Privacy answers stay "Data Not Collected": the new tabs only download price summaries from the same GitHub Pages server.

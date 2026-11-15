# SafeHop 1.3 – App Store texts

Everything below goes into App Store Connect → SafeHop → **iOS App 1.3.0** (the new version).
Category, privacy URL, age rating and the App Privacy answers ("Data Not Collected") stay as they are.

---

## Screenshots — replace all of them (9 files)

In **both** iPhone slots, delete the 1.2 screenshots and upload these in order:

| # | File | Headline |
|---|------|----------|
| 1 | 01-chicago-map.png | Know the neighborhood before you go (now "10 US cities") |
| 2 | 02-price-map.png | **NEW** Prices right on the map |
| 3 | 03-good-value.png | **NEW** Safety and price, side by side (Boston, ★ good value) |
| 4 | 04-monthly-rent.png | Staying longer? Compare rents |
| 5 | 05-safest-route.png | Find the safest route |
| 6 | 06-area-details.png | Tap any area for the details |
| 7 | 07-nyc-pickpocketing.png | Spot pickpocketing hot spots |
| 8 | 08-la-robbery.png | Robbery, assault, car break-ins & more |
| 9 | 09-plan-a-route.png | Pick two places, walk or drive |

- **iPhone 6.3"** (medium display) → `store/screenshots-6.3/` (1206×2622)
- **iPhone 6.9"** (large display, if you use it) → `store/screenshots/` (1320×2868)

Moved to `unused/`: the 1.2 Chicago price card, the New York rent map and the old "5 major US cities" list.

## What's New in This Version

```
NEW: 5 more cities and prices on the map

• Now in 10 US cities: San Francisco, Washington DC, Boston, San Diego and Austin join Chicago, Los Angeles, New York City, Miami and Seattle
• The Stay and Rent maps show each neighborhood's price right on the map. Zoom in to see more
• A star marks good-value areas: lower reported crime, and not among the city's priciest
• New icons for the map layers and crime types

Everything works in the new cities: crime map, safest route, nightly stay prices and monthly rents.
```

## Promotional Text (max 170)

```
Now in 10 US cities: crime, stay prices and rents on one map, plus the safest route between two places. A star marks lower-crime areas that aren't the priciest.
```

## Subtitle (max 30) — change

The words in the name and subtitle count as search keywords, so moving "crime map" here frees room for the new city names.

```
Crime map, rents & safe routes
```

## Keywords (max 100) — replace

```
safety,tourist,hotel,chicago,new,york,los,angeles,miami,seattle,san,francisco,diego,boston,austin,dc
```

## Description — replace the old one

```
SafeHop helps travelers and newcomers understand which neighborhoods see more reported crime, what it costs to stay there, and how to get around safely, before you book a hotel, sign a lease or head out for the evening.

Pick a city and the map colors every neighborhood green, yellow or red based on six months of official police data. Tap any area to see what was reported there, how it compares with the rest of the city and how it changed over time.

10 US CITIES
Austin, Boston, Chicago, Los Angeles, Miami, New York City, San Diego, San Francisco, Seattle and Washington DC.

STAY AND RENT PRICES
Switch the map to Stay or Rent and every neighborhood shows its typical price right on the map, next to its crime level.
• Stay: the typical nightly price for an entire place or a private room
• Rent: the typical monthly rent from a studio to 3 bedrooms
• A star marks good-value areas: lower reported crime, and not among the city's priciest
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

HOW IT WORKS
SafeHop counts incidents reported to police over the last 6 months and divides them by each area's size. Areas are compared only with other areas in the same city: green is the third with the fewest reports per km², red the third with the most. Prices are split the same way into cheaper, mid-range and pricier thirds within each city. Routes are compared by the crime level of the areas they pass through, weighted by the distance in each area.

DATA SOURCES
Crime data comes from each city's official open-data portal: Austin, Boston, Chicago, Los Angeles, City of Miami, New York City, San Diego, San Francisco and Seattle police departments, and the Metropolitan Police Department of Washington DC.
Nightly prices: median of active short-term rental listings per area, from Inside Airbnb (insideairbnb.com, CC BY 4.0).
Monthly rents: HUD Small Area Fair Market Rents, U.S. Department of Housing and Urban Development.
Routes and place search: © OpenStreetMap contributors.

PLEASE NOTE
SafeHop is an independent app and is not affiliated with, or endorsed by, any police department, government agency, Airbnb or Inside Airbnb. It shows reported incidents, not a guarantee of safety: not every crime is reported, and busy areas see more reports simply because more people are there. Crime data is per neighborhood, so two streets in the same area can't be told apart. Prices are guides, not quotes, and SafeHop does not offer bookings or listings.
City notes: Washington DC publishes serious offenses only, so pickpocketing isn't shown there. Boston is shown by police district. Austin and New York data are updated less often (weekly and quarterly). Miami covers the City of Miami only (not Miami Beach) and has no nightly prices. In an emergency, call 911.

PRIVACY
No accounts, no ads, no tracking. SafeHop does not collect personal data or use your location.
```

## App Review Information → Notes — replace

```
Version 1.3 adds five cities and price labels on the map. Everything from version 1.2 is unchanged.

What's new and how to test it:
1. On the first screen, the city list now has 10 cities (new: Austin, Boston, San Diego, San Francisco, Washington DC). Open any of them; the crime map, "Find a safe route", and the Stay and Rent tabs work the same way as in the other cities.
2. In a city, tap "Stay" or "Rent" at the top of the map. Each area now shows its typical price on the map; zoom in to see more labels. A star marks areas with lower reported crime that are not among the priciest. Tap a price label to open that area's card.
3. The map layers and crime categories now have icons.

Data: like before, all data is prepared by our scheduled job from official public sources (city police open-data portals, Inside Airbnb CC BY 4.0, HUD Small Area Fair Market Rents) and downloaded from our own data server on GitHub Pages (ertugrulozvardar.github.io/SafeHop). The app contacts no new services in this version.

Screen recording on a physical iPhone (version 1.0 flow): https://www.youtube.com/watch?v=KUvfB9_0rNE

The app has no login, no user-generated content, no ads, no analytics, no in-app purchases, collects no personal data and does not use location. The route feature sends only the two points the user chooses to Valhalla (FOSSGIS) and Photon (komoot), as described in version 1.1.

SafeHop is independent and not affiliated with or endorsed by any police department, government agency, Airbnb or Inside Airbnb.
```

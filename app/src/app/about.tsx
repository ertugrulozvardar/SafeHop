import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRIVACY_URL } from '../config';
import { CATEGORY_META, CATEGORY_ORDER } from '../data/categories';
import { colors, levelColors, radius } from '../theme';

const SOURCES = [
  { city: 'Chicago', agency: 'Chicago Police Department', url: 'https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2' },
  { city: 'Los Angeles', agency: 'Los Angeles Police Department', url: 'https://data.lacity.org/' },
  { city: 'New York City', agency: 'NYPD (NYC Open Data)', url: 'https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243' },
  { city: 'Miami', agency: 'City of Miami Police Department', url: 'https://datahub-miamigis.opendata.arcgis.com/' },
  { city: 'Seattle', agency: 'Seattle Police Department', url: 'https://data.seattle.gov/Public-Safety/SPD-Crime-Data-2008-Present/tazs-3rd5' },
];

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title="What the colors mean">
        <P>
          SafeHop counts incidents reported to the police over the last 6 months and divides them by each area’s size
          (incidents per km² per month). Areas are then split into thirds within the same city:
        </P>
        {(['lower', 'moderate', 'higher'] as const).map((l) => (
          <View key={l} style={styles.levelRow}>
            <View style={[styles.swatch, { backgroundColor: levelColors[l].solid }]} />
            <Text style={styles.body}>
              <Text style={styles.bold}>{levelColors[l].label}</Text> —{' '}
              {l === 'lower' ? 'the third of areas with the fewest reports per km²' : l === 'moderate' ? 'the middle third' : 'the third with the most reports per km²'}
            </Text>
          </View>
        ))}
        <P>
          Colors compare areas inside one city only. A “higher” area in one city is not comparable to a “higher” area in
          another, because police departments record crime differently.
        </P>
      </Section>

      <Section title="Please keep in mind">
        <Bullet>Not every crime is reported to the police, and busy areas (downtowns, nightlife, transit hubs) see more reports simply because more people are there.</Bullet>
        <Bullet>The most recent weeks may be incomplete because reports are added late.</Bullet>
        <Bullet>New York data is published quarterly, so it can be a few months behind.</Bullet>
        <Bullet>Miami covers the City of Miami only. Miami Beach (including South Beach) has its own police department and is not included.</Bullet>
        <Bullet>SafeHop is an information tool, not a guarantee of safety. In an emergency, call 911.</Bullet>
      </Section>

      <Section title="Categories">
        {CATEGORY_ORDER.map((id) => (
          <View key={id} style={{ marginBottom: 10 }}>
            <Text style={styles.bold}>{CATEGORY_META[id].label}</Text>
            <Text style={styles.body}>{CATEGORY_META[id].description}</Text>
          </View>
        ))}
        <P>Shoplifting, fraud, drug offenses and traffic violations are not counted.</P>
      </Section>

      <Section title="Safest route">
        <P>
          “Safe route” on a city map lets you choose a start and a destination. SafeHop then gets a few realistic walking or
          driving routes, including detours through areas with less reported crime, and compares them by the reported crime
          of the areas each route passes through (weighted by the distance travelled in each area). It shows the safest and
          the least safe of these routes, with the total travel time of each.
        </P>
        <Bullet>“Safest” and “least safe” only compare these routes with each other, based on crimes reported to police. They are not a guarantee of safety.</Bullet>
        <Bullet>The data is per area (neighborhood, precinct or police division), so SafeHop can’t tell two streets in the same area apart.</Bullet>
        <Bullet>Directions don’t account for traffic, closures or construction. Follow local signs and your own judgment.</Bullet>
        <P>
          Routes and place search use OpenStreetMap data (© OpenStreetMap contributors, ODbL) via the community-run
          Valhalla routing service of FOSSGIS e.V. and the Photon search service by komoot.
        </P>
        <Pressable onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')} accessibilityRole="link">
          <Text style={styles.link}>OpenStreetMap copyright and license</Text>
        </Pressable>
      </Section>

      <Section title="Data sources">
        <P>All data comes from official open-data portals and is refreshed daily when new data is published.</P>
        {SOURCES.map((s) => (
          <Pressable key={s.city} onPress={() => Linking.openURL(s.url)} style={styles.sourceRow} accessibilityRole="link">
            <Text style={styles.bold}>{s.city}</Text>
            <Text style={styles.link}>{s.agency}</Text>
          </Pressable>
        ))}
        <P>SafeHop is independent and is not affiliated with, or endorsed by, any police department or government agency.</P>
      </Section>

      <Section title="Privacy">
        <P>SafeHop does not collect personal data, does not use your location and has no accounts or ads.</P>
        <P>
          When you compare routes, the points you choose and the text you type in the search box are sent to the routing and
          place-search services only to calculate the result. SafeHop doesn’t store them.
        </P>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
          <Text style={styles.link}>Privacy policy</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const P = ({ children }: { children: ReactNode }) => <Text style={[styles.body, { marginBottom: 10 }]}>{children}</Text>;

const Bullet = ({ children }: { children: ReactNode }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.body}>•</Text>
    <Text style={[styles.body, { flex: 1 }]}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  section: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
  bold: { fontSize: 14, fontWeight: '700', color: colors.text },
  link: { fontSize: 14, color: colors.brand, fontWeight: '600' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  swatch: { width: 16, height: 16, borderRadius: 4 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sourceRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
});

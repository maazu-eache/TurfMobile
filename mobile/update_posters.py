import re

with open("src/features/tournament/components/PosterTemplates.js", "r") as f:
    content = f.read()

# 1. Add ImageBackground to imports
content = content.replace(
    "import { View, Text, StyleSheet, Image } from 'react-native';",
    "import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';"
)

# 2. Change Powered by SportVerse to Powered by Decolz Sports
content = content.replace("Powered by SportVerse", "Powered by Decolz Sports")

# 3. Update TournamentSummaryPoster
summary_old = """export const TournamentSummaryPoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  
  return (
    <View style={[styles.posterContainer, { backgroundColor: t.bgColor, borderColor: t.borderColor }]}>"""
summary_new = """export const TournamentSummaryPoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournament?.banner ? getImageUrl(tournament.banner) : SPORTVERSE_LOGO;
  
  return (
    <ImageBackground source={{ uri: bgImage }} style={[styles.posterContainer, { borderColor: t.borderColor }]}>
      <View style={{ flex: 1, backgroundColor: t.bgColor === '#0B192C' ? 'rgba(11,25,44,0.85)' : 'rgba(0,0,0,0.85)' }}>"""

content = content.replace(summary_old, summary_new)
content = content.replace("    </View>\n  );\n};\n\nconst styles", "      </View>\n    </ImageBackground>\n  );\n};\n\nconst styles")

# 4. Update FixturePoster
fixture_old = """export const FixturePoster = ({ match, tournamentName, theme }) => {
  const t = getThemeStyles(theme);
  
  return (
    <View style={[styles.posterContainer, { backgroundColor: t.bgColor, borderColor: t.borderColor, width: 340 }]}"""
fixture_new = """export const FixturePoster = ({ match, tournamentName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournamentBanner ? getImageUrl(tournamentBanner) : SPORTVERSE_LOGO;
  
  return (
    <ImageBackground source={{ uri: bgImage }} style={[styles.posterContainer, { borderColor: t.borderColor, width: 340 }]}>
      <View style={{ flex: 1, backgroundColor: t.bgColor === '#0B192C' ? 'rgba(11,25,44,0.85)' : 'rgba(0,0,0,0.85)' }}"""

content = content.replace(fixture_old, fixture_new)
content = re.sub(r'    </View>\n  \);\n};\n\nexport const PointsTablePoster', r'      </View>\n    </ImageBackground>\n  );\n};\n\nexport const PointsTablePoster', content)

# 5. Update PointsTablePoster
points_old = """export const PointsTablePoster = ({ pointsTable, tournamentName, groupName, theme }) => {
  const t = getThemeStyles(theme);
  
  return (
    <View style={[styles.posterContainer, { backgroundColor: t.bgColor, borderColor: t.borderColor, width: 360 }]}"""
points_new = """export const PointsTablePoster = ({ pointsTable, tournamentName, groupName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournamentBanner ? getImageUrl(tournamentBanner) : SPORTVERSE_LOGO;
  
  return (
    <ImageBackground source={{ uri: bgImage }} style={[styles.posterContainer, { borderColor: t.borderColor, width: 360 }]}>
      <View style={{ flex: 1, backgroundColor: t.bgColor === '#0B192C' ? 'rgba(11,25,44,0.85)' : 'rgba(0,0,0,0.85)' }}"""

content = content.replace(points_old, points_new)
content = re.sub(r'    </View>\n  \);\n};\n\nexport const LeaderboardPoster', r'      </View>\n    </ImageBackground>\n  );\n};\n\nexport const LeaderboardPoster', content)

# 6. Update LeaderboardPoster
leaderboard_old = """export const LeaderboardPoster = ({ type, data, tournamentName, theme }) => {
  const t = getThemeStyles(theme);"""
leaderboard_new = """export const LeaderboardPoster = ({ type, data, tournamentName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournamentBanner ? getImageUrl(tournamentBanner) : SPORTVERSE_LOGO;"""

content = content.replace(leaderboard_old, leaderboard_new)

# Wait, Leaderboard poster has return:
leader_return_old = """  return (
    <View style={[styles.posterContainer, { backgroundColor: t.bgColor, borderColor: t.borderColor, width: 340 }]}"""
leader_return_new = """  return (
    <ImageBackground source={{ uri: bgImage }} style={[styles.posterContainer, { borderColor: t.borderColor, width: 340 }]}>
      <View style={{ flex: 1, backgroundColor: t.bgColor === '#0B192C' ? 'rgba(11,25,44,0.85)' : 'rgba(0,0,0,0.85)' }}"""
content = content.replace(leader_return_old, leader_return_new)
content = re.sub(r'    </View>\n  \);\n};\n\nexport const FullSchedulePoster', r'      </View>\n    </ImageBackground>\n  );\n};\n\nexport const FullSchedulePoster', content)


# 7. Update FullSchedulePoster
fullschedule_old = """export const FullSchedulePoster = ({ matches, tournamentName, theme }) => {
  const t = getThemeStyles(theme);"""
fullschedule_new = """export const FullSchedulePoster = ({ matches, tournamentName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournamentBanner ? getImageUrl(tournamentBanner) : SPORTVERSE_LOGO;"""

content = content.replace(fullschedule_old, fullschedule_new)

full_return_old = """  return (
    <View style={[styles.posterContainer, { backgroundColor: t.bgColor, borderColor: t.borderColor, width: 350 }]}"""
full_return_new = """  return (
    <ImageBackground source={{ uri: bgImage }} style={[styles.posterContainer, { borderColor: t.borderColor, width: 350 }]}>
      <View style={{ flex: 1, backgroundColor: t.bgColor === '#0B192C' ? 'rgba(11,25,44,0.85)' : 'rgba(0,0,0,0.85)' }}"""
content = content.replace(full_return_old, full_return_new)
content = re.sub(r'    </View>\n  \);\n};', r'      </View>\n    </ImageBackground>\n  );\n};', content)

with open("src/features/tournament/components/PosterTemplates.js", "w") as f:
    f.write(content)

print("Done updating PosterTemplates.js")

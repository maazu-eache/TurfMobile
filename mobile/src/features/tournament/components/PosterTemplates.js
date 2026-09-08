import React from "react";
import { View, Text, StyleSheet, Image, ImageBackground } from "react-native";
import moment from "moment";
import { Typography, Spacing } from "../../../theme/theme";
import { getImageUrl } from "../../../api/axios";
import LinearGradient from "react-native-linear-gradient";
import QRCode from "react-native-qrcode-svg";

const SPORTVERSE_LOGO = require("../../../../SportVerse.png");
const TOURNAMENT_FALLBACK = require("../../../assets/images/TournamentFallBack.png");
const STADIUM_BG = require("../../../../share.png");
const getSource = (url) => (url ? { uri: getImageUrl(url) } : SPORTVERSE_LOGO);

// ---------------------------------------------------------------------------
// Cinematic theme grades
// ---------------------------------------------------------------------------

const RADIUS_MAP = {
  golden: 20,
  neonnoir: 16,
  velvet: 28,
  silverscreen: 8,
  crimson: 12,
  amber: 18,
};

const CARD_RADIUS_MAP = {
  golden: 14,
  neonnoir: 10,
  velvet: 20,
  silverscreen: 4,
  crimson: 8,
  amber: 12,
};

const getThemeStyles = (theme) => {
  switch (theme) {
    case "Hype":
      return {
        bgColor: "#05060F",
        textColor: "#F2F5FF",
        secTextColor: "#8CA0C7",
        accentColor: "#38F2E0",
        borderColor: "rgba(56, 242, 224, 0.22)",
        cardBg: "rgba(56, 242, 224, 0.06)",
        badgeBg: "rgba(56, 242, 224, 0.13)",
        overlayBg: "rgba(5, 6, 15, 0.92)",
        gradientBar: ["#38F2E0", "#B14CFF"],
        type: "neonnoir",
      };
    case "Aura":
      return {
        bgColor: "#140A1F",
        textColor: "#F5EEFB",
        secTextColor: "#C3AEDD",
        accentColor: "#C9A24B",
        borderColor: "rgba(201, 162, 75, 0.22)",
        cardBg: "rgba(201, 162, 75, 0.07)",
        badgeBg: "rgba(201, 162, 75, 0.13)",
        overlayBg: "rgba(20, 10, 31, 0.92)",
        gradientBar: ["#C9A24B", "#7C3AED"],
        type: "velvet",
      };
    case "Chrome":
      return {
        bgColor: "#0C0C0C",
        textColor: "#F2F2F2",
        secTextColor: "#A6A6A6",
        accentColor: "#E4E4E4",
        borderColor: "rgba(228, 228, 228, 0.18)",
        cardBg: "rgba(255, 255, 255, 0.05)",
        badgeBg: "rgba(228, 228, 228, 0.11)",
        overlayBg: "rgba(12, 12, 12, 0.93)",
        gradientBar: ["#FFFFFF", "#6B6B6B"],
        type: "silverscreen",
      };
    case "Cyber":
      return {
        bgColor: "#0D0505",
        textColor: "#FBEAEA",
        secTextColor: "#C79191",
        accentColor: "#E8384F",
        borderColor: "rgba(232, 56, 79, 0.28)",
        cardBg: "rgba(232, 56, 79, 0.07)",
        badgeBg: "rgba(232, 56, 79, 0.13)",
        overlayBg: "rgba(13, 5, 5, 0.92)",
        gradientBar: ["#E8384F", "#7A0C1A"],
        type: "crimson",
      };
    case "Drip":
      return {
        bgColor: "#120B04",
        textColor: "#F7ECD9",
        secTextColor: "#C9A876",
        accentColor: "#D98A3D",
        borderColor: "rgba(217, 138, 61, 0.22)",
        cardBg: "rgba(217, 138, 61, 0.07)",
        badgeBg: "rgba(217, 138, 61, 0.13)",
        overlayBg: "rgba(18, 11, 4, 0.92)",
        gradientBar: ["#D98A3D", "#7A4A16"],
        type: "amber",
      };
    case "Aesthetic":
    default:
      return {
        bgColor: "#0A0906",
        textColor: "#F5EFE0",
        secTextColor: "#B8AD94",
        accentColor: "#E8C468",
        borderColor: "rgba(232, 196, 104, 0.22)",
        cardBg: "rgba(232, 196, 104, 0.07)",
        badgeBg: "rgba(232, 196, 104, 0.13)",
        overlayBg: "rgba(10, 9, 6, 0.92)",
        gradientBar: ["#E8C468", "#8A6D2F"],
        type: "golden",
      };
  }
};

const getContainerStyle = (t, baseWidth) => [
  styles.posterContainer,
  styles.posterShadow,
  {
    width: baseWidth,
    borderRadius: RADIUS_MAP[t.type] ?? 20,
    borderWidth: 1,
    borderColor: t.accentColor + "44",
  },
];

const cardShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.45,
  shadowRadius: 12,
  elevation: 6,
};

const getCardStyle = (t) => ({
  backgroundColor: t.cardBg,
  borderRadius: CARD_RADIUS_MAP[t.type] ?? 10,
  borderWidth: 1,
  borderColor: t.borderColor,
  padding: Spacing.md,
  ...cardShadow,
});

// ---------------------------------------------------------------------------
// Shared cinematic chrome components
// ---------------------------------------------------------------------------

const PosterAtmosphere = ({ accentColor }) => (
  <>
    <LinearGradient
      colors={["rgba(0,0,0,0.6)", "transparent", "rgba(0,0,0,0.75)"]}
      locations={[0, 0.38, 1]}
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
    />
    <LinearGradient
      colors={[accentColor + "16", "transparent"]}
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
    />
    {[
      { start: { x: 0, y: 0 }, end: { x: 0.5, y: 0.5 } },
      { start: { x: 1, y: 0 }, end: { x: 0.5, y: 0.5 } },
      { start: { x: 0, y: 1 }, end: { x: 0.5, y: 0.5 } },
      { start: { x: 1, y: 1 }, end: { x: 0.5, y: 0.5 } },
    ].map((dir, i) => (
      <LinearGradient
        key={i}
        colors={["rgba(0,0,0,0.4)", "transparent"]}
        start={dir.start}
        end={dir.end}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
    ))}
  </>
);

const PosterGlowBand = ({ accentColor }) => (
  <LinearGradient
    colors={["transparent", accentColor + "22", "transparent"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    pointerEvents="none"
    style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2 }}
  />
);

const Kicker = ({ text, color }) => (
  <View style={styles.kickerRow}>
    <LinearGradient
      colors={["transparent", color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.kickerLine}
    />
    <Text style={[styles.kickerText, { color }]} numberOfLines={1}>
      {text}
    </Text>
    <LinearGradient
      colors={[color, "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.kickerLine}
    />
  </View>
);

const RingAvatar = ({ source, isDefault, size = 60, colors }) => (
  <LinearGradient
    colors={colors}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{
      width: size + 6,
      height: size + 6,
      borderRadius: (size + 6) / 2,
      padding: 3,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "#050505",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={source}
        style={{
          width: isDefault ? size * 0.6 : size,
          height: isDefault ? size * 0.6 : size,
          borderRadius: isDefault ? 0 : size / 2,
        }}
        resizeMode={isDefault ? "contain" : "cover"}
      />
    </View>
  </LinearGradient>
);

const MEDAL_COLORS = {
  1: ["#FFE9A8", "#D4AF37"],
  2: ["#F5F5F5", "#B9B9B9"],
  3: ["#F0C48A", "#B87333"],
};

const RankMedallion = ({ rank, accentColor }) => {
  const colors = MEDAL_COLORS[rank];
  if (!colors) {
    return (
      <View style={styles.rankPlain}>
        <Text style={[styles.rankPlainText, { color: accentColor }]}>#{rank}</Text>
      </View>
    );
  }
  return (
    <LinearGradient colors={colors} style={styles.rankMedal}>
      <Text style={styles.rankMedalText}>{rank}</Text>
    </LinearGradient>
  );
};

const PosterFooter = ({ t, variant = "boxed" }) => {
  if (variant === "minimal") {
    return (
      <View style={styles.footerMinimal}>
        <LinearGradient
          colors={t.gradientBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.footerDividerWide}
        />
        <Text style={styles.footerTextMinimal}>POWERED BY ✦ DECOLZ × OCA</Text>
      </View>
    );
  }
  return (
    <View style={[styles.footer, { borderTopColor: t.borderColor }]}>
      <LinearGradient
        colors={t.gradientBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.footerDividerWide}
      />
      <Text style={[styles.footerText, { color: t.secTextColor }]}>POWERED BY ✦ DECOLZ × OCA</Text>
    </View>
  );
};

const PosterChrome = ({ t }) => (
  <>
    <LinearGradient
      colors={t.gradientBar}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.topBar}
    />
    <PosterAtmosphere accentColor={t.accentColor} />
    <PosterGlowBand accentColor={t.accentColor} />
  </>
);

// Re-usable bordered stat chip
const StatChip = ({ label, value, t }) => (
  <View style={[styles.statChip, { backgroundColor: t.cardBg, borderColor: t.borderColor }]}>
    <Text style={[styles.statChipValue, { color: t.accentColor, textAlign: "center" }]}>{value}</Text>
    <Text style={[styles.statChipLabel, { color: t.secTextColor, textAlign: "center" }]}>{label}</Text>
  </View>
);

// Gradient accent hairline divider
const AccentDivider = ({ t, widthPct = "55%", style }) => (
  <LinearGradient
    colors={t.gradientBar}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, width: widthPct, borderRadius: 1, alignSelf: "center" }, style]}
  />
);

// ---------------------------------------------------------------------------
// Poster templates
// ---------------------------------------------------------------------------

export const TournamentSummaryPoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 355)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <Image
          source={tournament?.banner ? { uri: getImageUrl(tournament.banner) } : TOURNAMENT_FALLBACK}
          style={styles.posterBanner}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", t.overlayBg]}
          style={{ position: "absolute", top: 5, left: 0, right: 0, height: 175 }}
          pointerEvents="none"
        />
        <View style={styles.posterContent}>
          <Kicker text="TOURNAMENT SHOWCASE" color={t.accentColor} />
          <Text style={[styles.posterTitle, { color: t.textColor, textShadowColor: t.accentColor + "55" }]}>
            {tournament?.name}
          </Text>
          <Text style={[styles.posterSubtitle, { color: t.secTextColor }]}>
            {tournament?.city}{tournament?.overs ? ` • ${tournament.overs} Overs` : ""}
          </Text>
          <AccentDivider t={t} widthPct="60%" style={{ marginBottom: Spacing.lg }} />
          <View style={styles.statsRow}>
            <StatChip label="TEAMS" value={tournament?.registeredTeams?.length || 0} t={t} />
            <StatChip label="MATCHES" value={tournament?.matches?.length || 0} t={t} />
            <StatChip label="GROUND" value={tournament?.groundType || "Open"} t={t} />
          </View>
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

export const TurfPoster = ({ turf, theme, shareUrl }) => {
  const t = getThemeStyles(theme);
  const bgImage = turf?.coverImage ? { uri: getImageUrl(turf.coverImage) } : STADIUM_BG;
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 355)}>
      <View style={{ width: "100%", height: "100%", backgroundColor: t.overlayBg, justifyContent: "flex-end" }}>
        <PosterChrome t={t} />
        <LinearGradient
          colors={["transparent", t.bgColor + "CC", t.bgColor]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 280 }}
          pointerEvents="none"
        />
        <View style={[styles.posterContent, { paddingBottom: Spacing.lg }]}>
          <Kicker text={turf?.type || "PREMIUM TURF"} color={t.accentColor} />
          <Text style={[styles.posterTitle, { color: t.textColor, textShadowColor: t.accentColor + "55" }]}>
            {turf?.name}
          </Text>
          <Text style={[styles.posterSubtitle, { color: t.secTextColor }]}>
            {turf?.city}{turf?.type ? ` • ${turf.type}` : ""}
          </Text>
          <View style={styles.statsRow}>
            <StatChip label="RATING" value={turf?.rating > 0 ? turf.rating.toFixed(1) : "New"} t={t} />
            <StatChip label="SIZE" value={turf?.size || "8v8"} t={t} />
            <StatChip label="CITY" value={turf?.city || "Ambur"} t={t} />
          </View>
        </View>
        <View
          style={[
            styles.footer,
            { borderTopColor: t.borderColor, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.footerText, { color: t.secTextColor, fontSize: 8 }]}>POWERED BY ✦ DECOLZ × OCA</Text>
            {shareUrl ? (
              <Text style={{ fontSize: 7, color: t.secTextColor, marginTop: 2, opacity: 0.75 }} numberOfLines={1}>
                {shareUrl}
              </Text>
            ) : null}
          </View>
          {shareUrl ? (
            <View style={{ padding: 5, backgroundColor: "#FFFFFF", borderRadius: 8, marginLeft: Spacing.sm, borderWidth: 1.5, borderColor: t.accentColor, ...cardShadow }}>
              <QRCode value={shareUrl} size={34} color="#000000" backgroundColor="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </View>
    </ImageBackground>
  );
};

export const RegistrationPoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  const isAuction = tournament?.tournamentType === "Auction";
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 345)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <Image
          source={tournament?.banner ? { uri: getImageUrl(tournament.banner) } : TOURNAMENT_FALLBACK}
          style={styles.posterBanner}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", t.overlayBg]}
          style={{ position: "absolute", top: 5, left: 0, right: 0, height: 175 }}
          pointerEvents="none"
        />
        <View style={styles.posterContent}>
          <Kicker text={isAuction ? "AUCTION EVENT" : "TOURNAMENT EVENT"} color={t.accentColor} />
          <Text style={[styles.posterTitle, { color: t.textColor, fontSize: 24, textShadowColor: t.accentColor + "55" }]}>
            {tournament?.name}
          </Text>
          <LinearGradient
            colors={[t.accentColor + "38", t.accentColor + "18"]}
            style={[styles.pillBadge, { borderColor: t.accentColor, marginTop: 14 }]}
          >
            <Text style={[styles.pillBadgeText, { color: t.accentColor, textShadowColor: '#000000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]}>
              {isAuction ? "⚡ AUCTION REGISTRATIONS OPEN" : "⚡ REGISTRATIONS OPEN"}
            </Text>
          </LinearGradient>
          <Text style={{ color: t.secTextColor, fontSize: 13, marginTop: 14, textAlign: "center", fontFamily: Typography.fontFamily.medium, lineHeight: 20 }}>
            {isAuction
              ? "Enter the pool and wait to be picked by a team captain."
              : "Join the player pool and get ready to compete!"}
          </Text>
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

export const TeamInvitePoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 345)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <Image
          source={tournament?.banner ? { uri: getImageUrl(tournament.banner) } : TOURNAMENT_FALLBACK}
          style={styles.posterBanner}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", t.overlayBg]}
          style={{ position: "absolute", top: 5, left: 0, right: 0, height: 175 }}
          pointerEvents="none"
        />
        <View style={styles.posterContent}>
          <Kicker text="TEAM REGISTRATION" color={t.accentColor} />
          <Text style={[styles.posterTitle, { color: t.textColor, fontSize: 24, textShadowColor: t.accentColor + "55" }]}>
            {tournament?.name}
          </Text>
          <LinearGradient
            colors={[t.accentColor + "22", t.accentColor + "08"]}
            style={[styles.pillBadge, { borderColor: t.accentColor, marginTop: 14 }]}
          >
            <Text style={[styles.pillBadgeText, { color: t.accentColor }]}>🏆 REGISTER YOUR TEAM</Text>
          </LinearGradient>
          <Text style={{ color: t.secTextColor, fontSize: 13, marginTop: 14, textAlign: "center", fontFamily: Typography.fontFamily.medium, lineHeight: 20 }}>
            Gather your squad and compete for the championship!
          </Text>
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

const MatchupRow = ({ teamA, teamB, teamAScore, teamBScore, status, t, crestSize = 68 }) => {
  const isStarted = status && status !== "scheduled";
  return (
    <View style={styles.matchupRow}>
      <View style={{ alignItems: "center", flex: 1 }}>
        <RingAvatar source={getSource(teamA?.logo)} isDefault={!teamA?.logo} size={crestSize} colors={t.gradientBar} />
        <Text style={[styles.crestName, { color: t.textColor }]} numberOfLines={2}>{teamA?.name || "Team A"}</Text>
        {isStarted && teamAScore ? (
          <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.extraBold, fontSize: 15, marginTop: 4 }}>
            {teamAScore.runs}/{teamAScore.wickets}
            <Text style={{ fontSize: 10, color: t.secTextColor, fontFamily: Typography.fontFamily.medium }}>
              {" "}
              ({teamAScore.overs || "0.0"})
            </Text>
          </Text>
        ) : null}
      </View>
      <LinearGradient
        colors={[t.accentColor + "30", t.accentColor + "10"]}
        style={[styles.vsChip, { borderColor: t.accentColor + "80", marginTop: isStarted ? -12 : 0 }]}
      >
        <Text style={[styles.vsChipText, { color: t.accentColor }]}>VS</Text>
      </LinearGradient>
      <View style={{ alignItems: "center", flex: 1 }}>
        <RingAvatar source={getSource(teamB?.logo)} isDefault={!teamB?.logo} size={crestSize} colors={t.gradientBar} />
        <Text style={[styles.crestName, { color: t.textColor }]} numberOfLines={2}>{teamB?.name || "Team B"}</Text>
        {isStarted && teamBScore ? (
          <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.extraBold, fontSize: 15, marginTop: 4 }}>
            {teamBScore.runs}/{teamBScore.wickets}
            <Text style={{ fontSize: 10, color: t.secTextColor, fontFamily: Typography.fontFamily.medium }}>
              {" "}
              ({teamBScore.overs || "0.0"})
            </Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export const FixturePoster = ({ match, tournamentName, theme }) => {
  const t = getThemeStyles(theme);
  const isCompleted = match?.status === 'completed';
  const isLive = ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(match?.status);

  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.md, alignItems: "center" }}>
          <Kicker text={tournamentName || "MATCHDAY"} color={t.accentColor} />
          <Text style={{ color: t.textColor, fontSize: 15, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.lg, textAlign: "center", letterSpacing: 0.5 }}>
            {match?.stage || "Group Stage"} • {match?.format?.toUpperCase() || "MATCH"}
          </Text>
          <MatchupRow
            teamA={match?.teamA}
            teamB={match?.teamB}
            teamAScore={match?.teamAScore}
            teamBScore={match?.teamBScore}
            status={match?.status}
            t={t}
          />
          <View style={[getCardStyle(t), { marginTop: Spacing.xl, width: "100%", alignItems: "center", gap: 4 }]}>
            <AccentDivider t={t} widthPct="40%" style={{ marginBottom: 8 }} />
            {isCompleted ? (
              <>
                <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  🏆 RESULT
                </Text>
                <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 15, marginTop: 4, textAlign: "center", paddingHorizontal: 12 }}>
                  {match?.result?.summary || "Match Completed"}
                </Text>
                <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 6 }}>
                  Played on {new Date(match?.scheduledAt || match?.createdAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </>
            ) : isLive ? (
              <>
                <Text style={{ color: "#E8384F", fontFamily: Typography.fontFamily.bold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  🔴 LIVE MATCH
                </Text>
                <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginTop: 4, textAlign: "center" }}>
                  Match In Progress
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.medium, fontSize: 13 }}>
                  {new Date(match?.scheduledAt || match?.createdAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 22, marginTop: 2, letterSpacing: 1.5 }}>
                  {new Date(match?.scheduledAt || match?.createdAt || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </>
            )}
            {match?.venue ? (
              <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 4 }}>
                📍 {match.venue}
              </Text>
            ) : null}
          </View>
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

export const PointsTablePoster = ({ pointsTable, tournamentName, groupName, theme }) => {
  const t = getThemeStyles(theme);
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 378)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.sm, alignItems: "center" }}>
          <Kicker text={tournamentName || "STANDINGS"} color={t.accentColor} />
          <Text style={{ color: t.textColor, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 2, letterSpacing: 0.5 }}>
            Points Table
          </Text>
          {groupName ? (
            <Text style={{ color: t.secTextColor, fontSize: 13, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm }}>
              {groupName}
            </Text>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg }}>
          <LinearGradient
            colors={[t.accentColor + "20", "transparent"]}
            style={{ flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: t.accentColor, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6 }}
          >
            <Text style={[styles.tableHeadCell, { flex: 3, color: t.secTextColor, textAlign: "left" }]}>TEAM</Text>
            <Text style={[styles.tableHeadCell, { flex: 1, color: t.secTextColor }]}>M</Text>
            <Text style={[styles.tableHeadCell, { flex: 1, color: t.secTextColor }]}>W</Text>
            <Text style={[styles.tableHeadCell, { flex: 1, color: t.secTextColor }]}>L</Text>
            <Text style={[styles.tableHeadCell, { flex: 1, color: t.accentColor, fontFamily: Typography.fontFamily.bold }]}>PTS</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.5, color: t.secTextColor }]}>NRR</Text>
          </LinearGradient>
          {(pointsTable || []).slice(0, 10).map((row, index) => (
            <View
              key={row.team?._id || index}
              style={{
                flexDirection: "row",
                backgroundColor: index === 0 ? t.badgeBg : index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: t.borderColor,
                borderRadius: index === 0 ? 8 : 0,
                paddingVertical: 10,
                paddingHorizontal: 6,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 3, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: index === 0 ? t.accentColor : t.secTextColor, fontSize: 11, width: 16, marginRight: 4, fontFamily: index === 0 ? Typography.fontFamily.bold : Typography.fontFamily.regular }}>
                  {index + 1}
                </Text>
                <Image source={getSource(row.team?.logo)} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6 }} />
                <Text
                  style={{ flex: 1, color: index === 0 ? t.textColor : t.secTextColor, fontFamily: index === 0 ? Typography.fontFamily.bold : Typography.fontFamily.semiBold, fontSize: 12 }}
                  numberOfLines={1} ellipsizeMode="tail"
                >
                  {row.team?.name || "Unknown"}
                </Text>
              </View>
              <Text style={[styles.tableCell, { flex: 1, color: t.secTextColor }]}>{row.played}</Text>
              <Text style={[styles.tableCell, { flex: 1, color: t.secTextColor }]}>{row.won}</Text>
              <Text style={[styles.tableCell, { flex: 1, color: t.secTextColor }]}>{row.lost}</Text>
              <Text style={[styles.tableCell, { flex: 1, color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 13 }]}>{row.points}</Text>
              <Text style={[styles.tableCell, { flex: 1.5, color: t.secTextColor, fontSize: 11 }]}>
                {row.netRunRate ? parseFloat(row.netRunRate).toFixed(3) : "0.000"}
              </Text>
            </View>
          ))}
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

export const LeaderboardPoster = ({ type, data, tournamentName, theme, startIndex = 0, pageInfo = null }) => {
  const t = getThemeStyles(theme);
  const getTitle = () => {
    switch (type) {
      case "runs": return "Most Runs";
      case "wickets": return "Most Wickets";
      case "sixes": return "Most Sixes";
      case "fours": return "Most Fours";
      case "strikeRate": return "Highest Strike Rate";
      case "economy": return "Best Economy";
      case "catches": return "Best Fielders";
      case "mvp": return "MVP Rankings";
      default: return "Leaderboard";
    }
  };
  const getValueKey = () => {
    switch (type) {
      case "runs": return "runs";
      case "wickets": return "wickets";
      case "sixes": return "sixes";
      case "fours": return "fours";
      case "strikeRate": return "strikeRate";
      case "economy": return "economy";
      case "catches": return "dismissals";
      case "mvp": return "totalMvp";
      default: return "value";
    }
  };
  const unitLabel = { runs: "Runs", wickets: "Wkts", sixes: "6s", fours: "4s", strikeRate: "SR", economy: "Eco", catches: "Dis", mvp: "Pts" }[type] || type;
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)} resizeMode="cover">
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.md, alignItems: "center" }}>
          <Kicker text={tournamentName || "LEADERBOARD"} color={t.accentColor} />
          <Text style={{ color: t.textColor, fontSize: 22, fontFamily: Typography.fontFamily.bold, marginBottom: 2, letterSpacing: 0.5 }}>
            {getTitle()}
          </Text>
          {pageInfo ? (
            <View style={{ backgroundColor: t.badgeBg, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: t.borderColor, marginTop: 6 }}>
              <Text style={{ color: t.secTextColor, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>PAGE {pageInfo.current} / {pageInfo.total}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}>
          {(data || [])
            .filter(player => {
              if (type === "mvp") {
                const val = parseFloat(player[getValueKey()] || player.totalMvp || player.value || 0);
                return val > 1;
              }
              return true;
            })
            .map((player, index) => {
            const photoUrl = player.player?.photo || player.player?.userId?.photo || player.player?.avatar;
            const rank = startIndex + index + 1;
            const teamLogoUrl = player.team?.logo ? getImageUrl(player.team.logo) : null;
            const isTop = rank <= 3;
            return (
              <View
                key={player.player?._id || index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: rank === 1 ? t.accentColor + "18" : isTop ? t.badgeBg : "rgba(255,255,255,0.025)",
                  borderRadius: CARD_RADIUS_MAP[t.type] ?? 10,
                  borderWidth: 1,
                  borderColor: rank === 1 ? t.accentColor + "80" : t.borderColor,
                  padding: 7,
                  marginBottom: 5,
                }}
              >
                <RankMedallion rank={rank} accentColor={t.accentColor} />
                {teamLogoUrl ? (
                  <Image source={{ uri: teamLogoUrl }} style={{ width: 16, height: 16, borderRadius: 8, marginRight: 6, marginLeft: 4 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, marginRight: 6, marginLeft: 4, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: t.secTextColor, fontSize: 7, fontFamily: Typography.fontFamily.bold }}>T</Text>
                  </View>
                )}
                {photoUrl ? (
                  <Image source={{ uri: getImageUrl(photoUrl) }} style={{ width: 26, height: 26, borderRadius: 13, marginRight: 8 }} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>{player.player?.name || "Player"}</Text>
                  <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.medium, fontSize: 9, marginTop: 1 }}>{player.team?.name || player.teamName || "—"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: rank === 1 ? t.accentColor : t.textColor, fontFamily: Typography.fontFamily.extraBold, fontSize: rank === 1 ? 18 : 14 }}>
                    {type === "economy" || type === "strikeRate" ? parseFloat(player[getValueKey()]).toFixed(2) : player[getValueKey()]}
                  </Text>
                  <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 8 }}>{unitLabel}</Text>
                </View>
              </View>
            );
          })}
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

export const FullSchedulePoster = ({ matches, tournamentName, theme, pageInfo }) => {
  const t = getThemeStyles(theme);
  const displayMatches = pageInfo ? matches || [] : (matches || []).slice(0, 7);
  const totalMatchesCount = pageInfo?.totalMatches || matches?.length || 0;
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.xs, alignItems: "center" }}>
          <Kicker text={tournamentName || "TOURNAMENT FIXTURES"} color={t.accentColor} />
          <Text style={{ color: t.textColor, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 2, letterSpacing: 0.4 }}>Match Schedule</Text>
          <Text style={{ color: t.secTextColor, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm }}>{totalMatchesCount} Fixtures</Text>
          {pageInfo ? (
            <View style={{ backgroundColor: t.badgeBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: t.borderColor }}>
              <Text style={{ color: t.textColor, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>PAGE {pageInfo.current} OF {pageInfo.total}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}>
          {displayMatches.map((m, idx) => (
            <View key={m._id || idx} style={[getCardStyle(t), { marginBottom: 8, padding: 0, overflow: "hidden" }]}>
              <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0, flexDirection: "row", backgroundColor: "#050505" }}>
                <View style={{ flex: 1, position: "relative" }}>
                  <Image source={getSource(m.teamA?.logo)} style={{ width: "100%", height: "100%", opacity: 0.35 }} resizeMode="cover" />
                  <LinearGradient colors={["transparent", "#050505"]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                </View>
                <View style={{ flex: 1, position: "relative" }}>
                  <Image source={getSource(m.teamB?.logo)} style={{ width: "100%", height: "100%", opacity: 0.35 }} resizeMode="cover" />
                  <LinearGradient colors={["#050505", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                </View>
              </View>
              <LinearGradient colors={t.gradientBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2, width: "100%" }} />
              <View style={{ padding: Spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: t.accentColor, fontSize: 10, fontFamily: Typography.fontFamily.bold, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                    MATCH {idx + 1} • {m.format?.toUpperCase() || "CUSTOM"}
                  </Text>
                  <Text style={{ color: "#E2E8F0", fontSize: 10, fontFamily: Typography.fontFamily.medium, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                    {moment(m.scheduledAt || m.createdAt).format("DD MMM, hh:mm A")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: Typography.fontFamily.bold, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} numberOfLines={1}>
                      {m.teamA?.name || "Team A"}
                    </Text>
                  </View>
                  <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold, marginHorizontal: 12 }}>VS</Text>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: Typography.fontFamily.bold, textAlign: "right", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} numberOfLines={1}>
                      {m.teamB?.name || "Team B"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
        <PosterFooter t={t} />
      </View>
    </ImageBackground>
  );
};

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  posterContainer: { overflow: "hidden" },
  posterShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 12,
  },
  posterBanner: { width: "100%", height: 165, resizeMode: "cover" },
  posterContent: { padding: Spacing.lg, alignItems: "center" },
  posterTitle: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    textAlign: "center",
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  posterSubtitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: Spacing.md,
    letterSpacing: 0.3,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 8 },
  statChip: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6 },
  statChipValue: { fontSize: 17, fontFamily: Typography.fontFamily.bold },
  statChipLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 },
  footer: { padding: Spacing.md, alignItems: "center", borderTopWidth: 1 },
  footerText: { fontSize: 9, fontFamily: Typography.fontFamily.semiBold, textTransform: "uppercase", letterSpacing: 2 },
  footerDividerWide: { width: "55%", height: 1.5, borderRadius: 1, marginBottom: 8 },
  footerMinimal: { alignItems: "center", marginTop: 16, marginBottom: 4 },
  footerTextMinimal: { fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 6 },
  topBar: { height: 5, width: "100%" },
  kickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, width: "100%" },
  kickerLine: { flex: 1, height: 1, opacity: 0.7, marginHorizontal: 10, maxWidth: 55 },
  kickerText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 3.5, textTransform: "uppercase" },
  pillBadge: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10 },
  pillBadgeText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5, textAlign: "center" },
  matchupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: Spacing.sm },
  crestName: { fontFamily: Typography.fontFamily.bold, textAlign: "center", marginTop: 9, fontSize: 13, lineHeight: 18 },
  vsChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginHorizontal: Spacing.sm },
  vsChipText: { fontSize: 13, fontFamily: Typography.fontFamily.extraBold, fontStyle: "italic", letterSpacing: 1 },
  tableHeadCell: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  tableCell: { fontFamily: Typography.fontFamily.regular, fontSize: 12, textAlign: "center" },
  rankMedal: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 4 },
  rankMedalText: { color: "#0C0C0C", fontSize: 10, fontFamily: Typography.fontFamily.extraBold },
  rankPlain: { width: 26, alignItems: "center" },
  rankPlainText: { fontSize: 11, fontFamily: Typography.fontFamily.bold },
});

// ---------------------------------------------------------------------------
// Live / match summary posters (defined after styles)
// ---------------------------------------------------------------------------

export const MatchSummaryPoster = ({ liveState, theme }) => {
  const t = getThemeStyles(theme);
  const { match, teamAScore, teamBScore, currentInnings } = liveState || {};
  const teamA = match?.teamA;
  const teamB = match?.teamB;
  const matchStatus = match?.status?.toLowerCase();
  const currentInningsNum = liveState?.score?.inningsNumber || match?.currentInnings || currentInnings || 1;

  let mainScore = "";
  if (matchStatus === "completed" && teamAScore && teamBScore) {
    mainScore = teamAScore.runs + "/" + teamAScore.wickets + "  –  " + teamBScore.runs + "/" + teamBScore.wickets;
  } else if (currentInningsNum === 1 && teamAScore) {
    mainScore = teamAScore.runs + "/" + teamAScore.wickets + " (" + teamAScore.overs + ")";
  } else if (currentInningsNum === 2 && teamBScore) {
    mainScore = teamAScore.runs + "/" + teamAScore.wickets + "  –  " + teamBScore.runs + "/" + teamBScore.wickets;
  } else if (teamAScore && (teamAScore.runs > 0 || teamAScore.overs > 0)) {
    mainScore = teamAScore.runs + "/" + teamAScore.wickets + " (" + teamAScore.overs + ")";
  }

  const statusLabel = matchStatus === "live" || matchStatus === "in_progress" ? "🔴 LIVE SCORE" : matchStatus === "completed" ? "FINAL SCORE" : "SCORE";

  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.lg, alignItems: "center" }}>
          <Kicker text={match?.tournament?.name || "Friendly Match"} color={t.accentColor} />
          <View style={{ marginVertical: Spacing.md, width: "100%" }}>
            <MatchupRow teamA={teamA} teamB={teamB} t={t} />
          </View>
          {mainScore ? (
            <View style={{ alignItems: "center", marginTop: 10, paddingVertical: 20, paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: CARD_RADIUS_MAP[t.type] ?? 12, borderWidth: 1, borderColor: t.accentColor + "55", width: "100%" }}>
              <AccentDivider t={t} widthPct="50%" style={{ marginBottom: 10 }} />
              <Text style={{ color: t.accentColor, fontSize: 11, fontFamily: Typography.fontFamily.bold, marginBottom: 8, letterSpacing: 3 }}>{statusLabel}</Text>
              <Text style={{ color: t.textColor, fontSize: 30, fontFamily: Typography.fontFamily.extraBold, letterSpacing: 1, textAlign: "center" }}>{mainScore}</Text>
              {liveState?.match?.result?.margin ? (
                <Text style={{ color: t.secTextColor, fontSize: 14, fontFamily: Typography.fontFamily.medium, marginTop: 8, textAlign: "center" }}>{liveState.match.result.margin}</Text>
              ) : null}
              <AccentDivider t={t} widthPct="50%" style={{ marginTop: 10 }} />
            </View>
          ) : (
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Text style={{ color: t.secTextColor, fontSize: 16, fontFamily: Typography.fontFamily.medium }}>Match yet to begin</Text>
            </View>
          )}
          <PosterFooter t={t} variant="minimal" />
        </View>
      </View>
    </ImageBackground>
  );
};

export const AiReportPoster = ({ liveState, aiReport, theme }) => {
  const t = getThemeStyles(theme);
  const { match } = liveState || {};
  const teamA = match?.teamA;
  const teamB = match?.teamB;
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.md }}>
          <Kicker text="MATCH INTELLIGENCE" color={t.accentColor} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <RingAvatar source={teamA?.logo ? { uri: getImageUrl(teamA.logo) } : SPORTVERSE_LOGO} isDefault={!teamA?.logo} size={28} colors={t.gradientBar} />
              <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>VS</Text>
              <RingAvatar source={teamB?.logo ? { uri: getImageUrl(teamB.logo) } : SPORTVERSE_LOGO} isDefault={!teamB?.logo} size={28} colors={t.gradientBar} />
            </View>
            <LinearGradient
              colors={[t.accentColor + "30", t.accentColor + "10"]}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: t.accentColor + "55" }}
            >
              <Text style={{ color: t.accentColor, fontSize: 9, fontFamily: Typography.fontFamily.bold, textTransform: "uppercase", letterSpacing: 1 }}>✦ AI Analysis</Text>
            </LinearGradient>
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: t.secTextColor, fontSize: 9, fontFamily: Typography.fontFamily.bold, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Headline</Text>
            <Text style={{ color: t.textColor, fontSize: 16, fontFamily: Typography.fontFamily.bold, lineHeight: 22 }} numberOfLines={2}>
              {aiReport?.headline?.[0] || "Match Summary"}
            </Text>
          </View>
          <View style={[getCardStyle(t), { marginBottom: 12 }]}>
            <Text style={{ color: t.accentColor, fontSize: 9, fontFamily: Typography.fontFamily.bold, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Summary</Text>
            <Text style={{ color: t.textColor, fontSize: 13, fontFamily: Typography.fontFamily.regular, lineHeight: 20 }}>
              {aiReport?.summary || "No summary available."}
            </Text>
          </View>
          <PosterFooter t={t} variant="minimal" />
        </View>
      </View>
    </ImageBackground>
  );
};

export const MotmPoster = ({ liveState, mvp, theme }) => {
  const t = getThemeStyles(theme);
  const { match } = liveState || {};
  const motm = mvp || match?.playerOfMatch;
  const motmPhoto = motm?.photo || motm?.userId?.photo || null;
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.md, alignItems: "center" }}>
          <Kicker text="PLAYER OF THE MATCH" color={t.accentColor} />
          <View style={{ alignItems: "center", marginVertical: 14, shadowColor: t.accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 10 }}>
            <RingAvatar source={motmPhoto ? { uri: getImageUrl(motmPhoto) } : SPORTVERSE_LOGO} isDefault={!motmPhoto} size={108} colors={t.gradientBar} />
          </View>
          <Text style={{ color: t.textColor, fontSize: 24, fontFamily: Typography.fontFamily.bold, marginBottom: 4, textAlign: "center", letterSpacing: 0.5 }}>
            {motm?.name || "N/A"}
          </Text>
          <Text style={{ color: t.secTextColor, fontSize: 13, fontFamily: Typography.fontFamily.medium, textAlign: "center" }}>
            {match?.teamA?.name} vs {match?.teamB?.name}
          </Text>
          <AccentDivider t={t} widthPct="60%" style={{ marginVertical: 14 }} />
          <View style={[getCardStyle(t), { alignSelf: "stretch", alignItems: "center" }]}>
            <Text style={{ color: t.accentColor, fontSize: 24, fontFamily: Typography.fontFamily.bold, marginBottom: 4 }}>❝</Text>
            <Text style={{ color: t.textColor, fontSize: 13, fontFamily: Typography.fontFamily.regular, textAlign: "center", fontStyle: "italic", lineHeight: 20 }} numberOfLines={2}>
              Outstanding Match-Winning Contribution
            </Text>
          </View>
          <PosterFooter t={t} variant="minimal" />
        </View>
      </View>
    </ImageBackground>
  );
};

export const PlayerProfilePoster = ({ player, career, batting, bowling, theme }) => {
  const t = getThemeStyles(theme);
  const photoUrl = player?.photo || player?.userId?.photo || null;
  const city = player?.city || player?.userId?.city || player?.location || "";
  const state = player?.state || player?.userId?.state || "";
  const loc = [city, state].filter(Boolean).join(", ");
  const matches = career?.matches || 0;
  const runs = career?.batting?.runs || batting?.runs || 0;
  const wickets = career?.bowling?.wickets || bowling?.wickets || 0;
  const followersCount = player?.followers?.length || 0;
  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 358)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg }}>
        <PosterChrome t={t} />
        <View style={{ padding: Spacing.md }}>
          <Kicker text="PLAYER CARD" color={t.accentColor} />
          <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 14, gap: 16 }}>
            <View style={{ shadowColor: t.accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 18, elevation: 8 }}>
              <RingAvatar source={photoUrl ? { uri: getImageUrl(photoUrl) } : SPORTVERSE_LOGO} isDefault={!photoUrl} size={88} colors={t.gradientBar} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.textColor, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 6, letterSpacing: 0.3 }} numberOfLines={1}>
                {player?.name || "N/A"}
              </Text>
              <LinearGradient
                colors={[t.accentColor + "22", t.accentColor + "08"]}
                style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", borderWidth: 1, borderColor: t.accentColor + "55", marginBottom: 6 }}
              >
                <Text style={{ color: t.accentColor, fontSize: 11, fontFamily: Typography.fontFamily.bold }}>
                  {player?.playingRole || "Player"}
                </Text>
              </LinearGradient>
              {loc ? <Text style={{ fontSize: 11, color: t.secTextColor, fontFamily: Typography.fontFamily.regular }}>📍 {loc}</Text> : null}
            </View>
          </View>
          <AccentDivider t={t} widthPct="100%" style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
            {[
              { label: "MATCHES", value: matches },
              { label: "RUNS", value: runs },
              { label: "WICKETS", value: wickets },
              { label: "FANS", value: followersCount },
            ].map((s, i) => (
              <StatChip key={i} label={s.label} value={s.value} t={t} />
            ))}
          </View>
          <PosterFooter t={t} variant="minimal" />
        </View>
      </View>
    </ImageBackground>
  );
};

export const TeamQRPoster = ({ team, theme }) => {
  const t = getThemeStyles(theme);
  const shareUrl = `https://scoreverse.in/team/${team?._id}`;
  const qrPayload = `SCOREVERSE_TEAM:${team?._id || ''}`;
  const winPct = team?.stats?.matches > 0 ? ((team.stats.wins / team.stats.matches) * 100).toFixed(0) : '0';

  return (
    <ImageBackground source={STADIUM_BG} style={getContainerStyle(t, 420)}>
      <View style={{ width: "100%", backgroundColor: t.overlayBg, alignItems: 'center', paddingBottom: Spacing.md }}>
        <PosterChrome t={t} />

        {/* Header Kicker */}
        <View style={{ marginTop: 14, marginBottom: 8 }}>
          <Kicker text="OFFICIAL TEAM CARD" color={t.accentColor} />
        </View>

        {/* Team Logo */}
        <View style={{ marginVertical: 10, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            borderWidth: 2.5,
            borderColor: t.accentColor,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: t.cardBg,
            ...cardShadow,
          }}>
            {team?.logo ? (
              <Image source={{ uri: getImageUrl(team.logo) }} style={{ width: 70, height: 70, borderRadius: 35 }} />
            ) : (
              <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 28 }}>
                {(team?.name || 'T').trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        {/* Team Title & City */}
        <Text style={[styles.posterTitle, { color: t.textColor, fontSize: 22, textAlign: 'center', marginHorizontal: 16, textShadowColor: t.accentColor + '55' }]} numberOfLines={1}>
          {team?.name || 'Cricket Team'}
        </Text>
        {team?.city ? (
          <Text style={{ color: t.secTextColor, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginTop: 4 }}>
            📍 {team.city}{team.state ? `, ${team.state}` : ''}
          </Text>
        ) : null}

        {/* Team Quick Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginVertical: 12 }}>
          <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: t.cardBg, borderRadius: 8, borderWidth: 1, borderColor: t.borderColor }}>
            <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{team?.stats?.matches || 0}</Text>
            <Text style={{ color: t.secTextColor, fontSize: 9, fontFamily: Typography.fontFamily.regular }}>MATCHES</Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: t.cardBg, borderRadius: 8, borderWidth: 1, borderColor: t.borderColor }}>
            <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{team?.stats?.wins || 0}</Text>
            <Text style={{ color: t.secTextColor, fontSize: 9, fontFamily: Typography.fontFamily.regular }}>WINS</Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: t.cardBg, borderRadius: 8, borderWidth: 1, borderColor: t.borderColor }}>
            <Text style={{ color: t.accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{winPct}%</Text>
            <Text style={{ color: t.secTextColor, fontSize: 9, fontFamily: Typography.fontFamily.regular }}>WIN RATE</Text>
          </View>
        </View>

        {/* Embedded QR Code Card */}
        <View style={{
          padding: 12,
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          marginVertical: 6,
          borderWidth: 2,
          borderColor: t.accentColor,
          ...cardShadow
        }}>
          <QRCode value={qrPayload} size={145} color="#000000" backgroundColor="#FFFFFF" />
        </View>

        {/* Code Badge & CTA */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.accentColor + '18',
          borderWidth: 1,
          borderColor: t.accentColor,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          marginTop: 8,
        }}>
          <Text style={{ color: t.accentColor, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
            TEAM CODE: {team?._id}
          </Text>
        </View>

        <Text style={{ color: t.secTextColor, fontSize: 10, fontFamily: Typography.fontFamily.medium, marginTop: 8, opacity: 0.85 }}>
          SCAN QR TO SELECT TEAM IN MATCH CREATION
        </Text>

        <PosterFooter t={t} shareUrl={shareUrl} />
      </View>
    </ImageBackground>
  );
};


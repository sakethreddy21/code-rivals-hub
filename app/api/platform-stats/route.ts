import { NextResponse } from "next/server";

/* ─────────────────────── Types ─────────────────────── */

type LeetCodeStats = {
  platform: "LeetCode";
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalQuestions: number;
  easyTotal: number;
  mediumTotal: number;
  hardTotal: number;
  ranking: number;
  streak: number;
  reputation: number;
  contributionPoints: number;
  solvedSlugs: string[];
};

type GfgStats = {
  platform: "GeeksforGeeks";
  username: string;
  totalSolved: number;
  codingScore: number;
  totalScore: number;
  monthlyScore: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  instituteRank: string;
  solvedSlugs: string[];
};

/* ─────────────────── LeetCode via GraphQL ─────────────────── */

async function fetchLeetCodeStats(username: string): Promise<LeetCodeStats> {
  const query = `
    query getUserProfile($username: String!) {
      recentAcSubmissionList(username: $username, limit: 50) {
        titleSlug
      }
      matchedUser(username: $username) {
        username
        profile {
          ranking
          reputation
          starRating
        }
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          streak
        }
        contributions {
          points
        }
      }
      allQuestionsCount {
        difficulty
        count
      }
    }
  `;

  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({ query, variables: { username } }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`LeetCode API returned ${res.status}`);

  const json = await res.json();
  const user = json?.data?.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found`);

  const acSubs: { difficulty: string; count: number }[] =
    user.submitStatsGlobal?.acSubmissionNum ?? [];
  const allQ: { difficulty: string; count: number }[] =
    json?.data?.allQuestionsCount ?? [];

  const findCount = (arr: { difficulty: string; count: number }[], d: string) =>
    arr.find((x) => x.difficulty === d)?.count ?? 0;

  // Collect recently-solved problem slugs for auto-marking
  const recentAc: { titleSlug: string }[] = json?.data?.recentAcSubmissionList ?? [];
  const solvedSlugs = recentAc.map((s) => s.titleSlug).filter(Boolean);

  return {
    platform: "LeetCode",
    username: user.username,
    totalSolved: findCount(acSubs, "All"),
    easySolved: findCount(acSubs, "Easy"),
    mediumSolved: findCount(acSubs, "Medium"),
    hardSolved: findCount(acSubs, "Hard"),
    totalQuestions: findCount(allQ, "All"),
    easyTotal: findCount(allQ, "Easy"),
    mediumTotal: findCount(allQ, "Medium"),
    hardTotal: findCount(allQ, "Hard"),
    ranking: user.profile?.ranking ?? 0,
    streak: user.userCalendar?.streak ?? 0,
    reputation: user.profile?.reputation ?? 0,
    contributionPoints: user.contributions?.points ?? 0,
    solvedSlugs,
  };
}

/* ─────────────────── GFG via Practice Submissions API ─────────────────── */

async function fetchGfgStats(username: string): Promise<GfgStats> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: "https://www.geeksforgeeks.org",
    Referer: "https://www.geeksforgeeks.org/",
  };

  // Primary approach: GFG Practice Submissions API (POST)
  // This is the actual API that GFG's frontend uses to load user submissions
  const submissionsUrl = "https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/";
  const body = JSON.stringify({
    handle: username,
    requestType: "",
    year: "",
    month: "",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(submissionsUrl, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`GFG Practice API returned ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new Error("GFG returned non-JSON response");
    }

    const data = await res.json();

    if (data.status !== "success") {
      throw new Error(data.message || "GFG API returned an error");
    }

    const result = data.result ?? {};
    const totalCount = data.count ?? 0;

    // Count problems by difficulty category
    const basicCount = result.Basic ? Object.keys(result.Basic).length : 0;
    const schoolCount = result.School ? Object.keys(result.School).length : 0;
    const easyCount = result.Easy ? Object.keys(result.Easy).length : 0;
    const mediumCount = result.Medium ? Object.keys(result.Medium).length : 0;
    const hardCount = result.Hard ? Object.keys(result.Hard).length : 0;

    // Combine Basic + School into "easy" category for simplified display
    const easySolved = basicCount + schoolCount + easyCount;
    const mediumSolved = mediumCount;
    const hardSolved = hardCount;

    // Collect all solved problem slugs for auto-marking
    const solvedSlugs: string[] = [];
    for (const category of Object.values(result)) {
      if (category && typeof category === "object") {
        for (const prob of Object.values(category as Record<string, { slug?: string }>)) {
          if (prob?.slug) solvedSlugs.push(prob.slug);
        }
      }
    }

    return {
      platform: "GeeksforGeeks",
      username,
      totalSolved: totalCount || (easySolved + mediumSolved + hardSolved),
      codingScore: 0,
      totalScore: 0,
      monthlyScore: 0,
      easySolved,
      mediumSolved,
      hardSolved,
      instituteRank: "--",
      solvedSlugs,
    };
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Could not fetch GFG stats for "${username}": ${message}`);
  }
}

/* ─────────────────── API Handler ─────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform")?.toLowerCase();
  const username = searchParams.get("username")?.trim();

  if (!platform || !username) {
    return NextResponse.json(
      { error: "Missing platform or username" },
      { status: 400 }
    );
  }

  try {
    if (platform === "leetcode") {
      const stats = await fetchLeetCodeStats(username);
      return NextResponse.json(stats);
    }

    if (platform === "gfg" || platform === "geeksforgeeks") {
      const stats = await fetchGfgStats(username);
      return NextResponse.json(stats);
    }

    return NextResponse.json(
      { error: `Unsupported platform: ${platform}` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

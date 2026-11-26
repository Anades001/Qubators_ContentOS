/**
 * Seeds the Ombra Fiore demo workspace (PRD §8 example brand).
 * Idempotent: re-running replaces the demo brand and its content.
 *
 * Demo login: demo@contentos.local / ombrafiore-demo
 */
import { hashPassword } from "better-auth/crypto";
import { ContentStatus, ContentType, Platform, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_ID = "seed_demo_user";
const DEMO_EMAIL = "demo@contentos.local";
const DEMO_PASSWORD = "ombrafiore-demo";
const BRAND_SLUG = "ombra-fiore";

const day = (offset: number, hour = 10) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { id: DEMO_USER_ID, name: "Ombra Fiore Studio", email: DEMO_EMAIL, emailVerified: true },
  });

  const hasPassword = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!hasPassword) {
    await prisma.account.create({
      data: {
        id: "seed_demo_account",
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await hashPassword(DEMO_PASSWORD),
      },
    });
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, plan: "FREE" },
  });

  // Replace the demo brand wholesale (cascades to all brand-owned rows).
  await prisma.brand.deleteMany({ where: { ownerId: user.id, slug: BRAND_SLUG } });

  const brand = await prisma.brand.create({
    data: {
      ownerId: user.id,
      slug: BRAND_SLUG,
      name: "Ombra Fiore",
      industry: "Crochet fashion & accessories",
      products: ["Crochet phone pouch", "Crochet mini handbag", "Crochet bucket hat", "Custom colour orders"],
      audience:
        "Young, fashion-conscious customers (18–30) who value handmade, slow fashion and soft-luxury style",
      platforms: [Platform.INSTAGRAM, Platform.TIKTOK, Platform.PINTEREST],
      personality: "Warm, artistic, feminine, quietly confident",
      tone: "Warm, artistic, feminine",
      goals: [
        "Launch the new crochet phone pouch",
        "Grow Instagram saves and shares",
        "Increase custom orders",
      ],
      visualStyle: "Minimal, soft luxury — cream backdrops, natural light, close-up texture shots",
      colors: { primary: "#E8B4B8", accent: "#C9A96A", ink: "#1E1B1E", background: "#FAF7F2" },
    },
  });

  await prisma.brandDna.create({
    data: {
      brandId: brand.id,
      version: 1,
      voice: ["Warm", "Artistic", "Feminine", "Honest about craft"],
      pillars: [
        "Craftsmanship & process",
        "Styling inspiration",
        "Behind the scenes",
        "Customer stories",
        "Product launches",
      ],
      ctas: ["Shop the pouch — link in bio", "DM us for a custom colour", "Save this for your next outfit"],
      usePhrases: ["handmade with intention", "stitch by stitch", "made to last"],
      avoidPhrases: ["cheap", "fast fashion", "mass-produced", "100% organic"],
      guidelines:
        "Lead with texture and process. Be specific about time and materials. Never claim certifications we don't hold.",
    },
  });

  await prisma.asset.createMany({
    data: [
      {
        brandId: brand.id,
        kind: "FAQ",
        name: "How long does a pouch take?",
        text: "Each phone pouch takes about 4–6 hours to crochet by hand, plus finishing.",
        tags: ["pouch", "process"],
      },
      {
        brandId: brand.id,
        kind: "FAQ",
        name: "What yarn do you use?",
        text: "We use a soft cotton-blend yarn. It is not certified organic.",
        tags: ["materials"],
      },
      {
        brandId: brand.id,
        kind: "TESTIMONIAL",
        name: "Amara — pouch review",
        text: "It's even prettier in person. I get asked where it's from every time I go out.",
        tags: ["pouch", "review"],
      },
    ],
  });

  await prisma.inboxItem.createMany({
    data: [
      {
        brandId: brand.id,
        rawText: "packaging post — show the tissue + wax seal unboxing",
        category: "IDEA",
        status: "TRIAGED",
      },
      {
        brandId: brand.id,
        rawText: "shipping FAQ — how long to Abuja / Lagos?",
        category: "FAQ",
        status: "TRIAGED",
      },
      {
        brandId: brand.id,
        rawText: "trend: 'what I ordered vs what I got' audio",
        category: "TREND",
        status: "NEW",
      },
      {
        brandId: brand.id,
        rawText: "book photo shoot for the bucket hat",
        category: "UNSORTED",
        status: "NEW",
      },
    ],
  });

  const campaign = await prisma.campaign.create({
    data: {
      brandId: brand.id,
      name: "Phone Pouch Launch",
      goal: "Launch new product",
      description:
        "14-day launch: teaser → BTS → detail → problem/solution → reveal → education → testimonial → launch → reminder → CTA",
      startDate: day(0),
      endDate: day(13),
      status: "ACTIVE",
    },
  });

  const ideaWhyHandmade = await prisma.idea.create({
    data: {
      brandId: brand.id,
      campaignId: campaign.id,
      title: "Why handmade costs more",
      description: "Educational carousel breaking down materials, time and craftsmanship behind one pouch.",
      goal: "Justify price and build trust",
      pillar: "Craftsmanship & process",
      product: "Crochet phone pouch",
      format: ContentType.CAROUSEL,
      platform: Platform.INSTAGRAM,
      rationale: "Educational carousels earned more saves than promo statics last month.",
      status: "BRIEFED",
    },
  });

  await prisma.idea.createMany({
    data: [
      {
        brandId: brand.id,
        campaignId: campaign.id,
        title: "Teaser: a close-up you can almost feel",
        pillar: "Product launches",
        product: "Crochet phone pouch",
        format: ContentType.REEL,
        platform: Platform.TIKTOK,
        status: "SELECTED",
      },
      {
        brandId: brand.id,
        title: "3 ways to style a crochet pouch",
        pillar: "Styling inspiration",
        product: "Crochet phone pouch",
        format: ContentType.CAROUSEL,
        platform: Platform.PINTEREST,
      },
      {
        brandId: brand.id,
        title: "Packaging ASMR unboxing",
        pillar: "Behind the scenes",
        format: ContentType.REEL,
        platform: Platform.INSTAGRAM,
      },
    ],
  });

  const brief = await prisma.brief.create({
    data: {
      brandId: brand.id,
      ideaId: ideaWhyHandmade.id,
      title: "Why handmade costs more",
      hook: "This pouch took 6 hours. Here's where your money actually goes.",
      objective: "Educate on value; reduce price objections in DMs",
      cta: "Save this & shop the pouch — link in bio",
      slidesJson: [
        {
          slide: 1,
          purpose: "Hook",
          copy: "This pouch took 6 hours.",
          visual: "Close-up of pouch on cream linen",
        },
        {
          slide: 2,
          purpose: "Materials",
          copy: "Soft cotton-blend yarn, chosen for drape and durability.",
          visual: "Yarn skeins flat-lay",
        },
        {
          slide: 3,
          purpose: "Time",
          copy: "4–6 hours of hand-crocheting, stitch by stitch.",
          visual: "Hands mid-stitch, warm light",
        },
        {
          slide: 4,
          purpose: "Craftsmanship",
          copy: "Every edge finished by hand so it's made to last.",
          visual: "Macro of edge detail",
        },
        {
          slide: 5,
          purpose: "Customization",
          copy: "Your colours, your strap length.",
          visual: "Colour swatch grid",
        },
        {
          slide: 6,
          purpose: "CTA",
          copy: "Save this & shop the pouch — link in bio.",
          visual: "Pouch styled with outfit",
        },
      ],
    },
  });

  const carousel = await prisma.contentItem.create({
    data: {
      brandId: brand.id,
      ideaId: ideaWhyHandmade.id,
      briefId: brief.id,
      campaignId: campaign.id,
      title: "Why handmade costs more — carousel",
      type: ContentType.CAROUSEL,
      platform: [Platform.INSTAGRAM],
      status: ContentStatus.REVIEW,
      payloadJson: {
        caption:
          "Six hours, one pouch, zero shortcuts. Swipe to see where the value really lives — then save this for the next time someone asks why handmade costs more. 🌸",
        hashtags: ["#crochet", "#handmade", "#slowfashion", "#crochetbag", "#ombrafiore"],
      },
      imagePrompt:
        "Crochet phone pouch on cream linen, minimal studio, soft natural window light, soft-luxury mood, blush rose and gold accents",
      scheduledAt: day(4, 17),
    },
  });

  const tiktok = await prisma.contentItem.create({
    data: {
      brandId: brand.id,
      campaignId: campaign.id,
      parentId: carousel.id,
      title: "Why handmade costs more — TikTok script",
      type: ContentType.VIDEO_SCRIPT,
      platform: [Platform.TIKTOK],
      status: ContentStatus.DRAFT,
      payloadJson: {
        hook: "POV: you asked why my pouch costs more.",
        beats: ["Show yarn", "Timelapse of stitching", "Finishing the edges", "Final reveal on outfit"],
        cta: "Link in bio 🌸",
      },
    },
  });

  const teaser = await prisma.contentItem.create({
    data: {
      brandId: brand.id,
      campaignId: campaign.id,
      title: "Teaser — something soft is coming",
      type: ContentType.REEL,
      platform: [Platform.INSTAGRAM, Platform.TIKTOK],
      status: ContentStatus.SCHEDULED,
      payloadJson: {
        caption: "Something soft is coming. 🌸 Day 1 of 14.",
        hashtags: ["#comingsoon", "#crochet"],
      },
      scheduledAt: day(1, 17),
    },
  });

  await prisma.contentItem.create({
    data: {
      brandId: brand.id,
      title: "Meet the maker",
      type: ContentType.POST,
      platform: [Platform.INSTAGRAM],
      status: ContentStatus.PUBLISHED,
      payloadJson: { caption: "Hi, I'm the hands behind Ombra Fiore. 🧶" },
      publishedAt: day(-7, 17),
    },
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        brandId: brand.id,
        contentItemId: teaser.id,
        title: "Publish: Teaser reel",
        kind: "PUBLISH",
        startsAt: day(1, 17),
      },
      {
        brandId: brand.id,
        contentItemId: carousel.id,
        title: "Publish: Why handmade costs more",
        kind: "PUBLISH",
        startsAt: day(4, 17),
      },
      {
        brandId: brand.id,
        contentItemId: tiktok.id,
        title: "Review: TikTok script",
        kind: "REVIEW",
        startsAt: day(2, 11),
      },
      {
        brandId: brand.id,
        title: "Photo shoot: pouch styling",
        kind: "SHOOT",
        startsAt: day(3, 9),
        endsAt: day(3, 12),
      },
    ],
  });

  const counts = await Promise.all([
    prisma.idea.count({ where: { brandId: brand.id } }),
    prisma.contentItem.count({ where: { brandId: brand.id } }),
    prisma.calendarEvent.count({ where: { brandId: brand.id } }),
  ]);
  console.log(
    `Seeded "${brand.name}" for ${DEMO_EMAIL} — ${counts[0]} ideas, ${counts[1]} content items, ${counts[2]} calendar events`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

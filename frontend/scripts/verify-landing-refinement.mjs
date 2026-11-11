/** Focused guest-only regression checks. Requires an already-running frontend. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.LANDING_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  channel: process.env.LANDING_BROWSER_CHANNEL || "msedge",
  headless: true,
});
const results = [];
const errors = [];
const mutations = [];
const visibleSlide = (page) =>
  page.locator('.public-carousel__slide[data-active="true"]');
const position = async (page, number) => {
  await expect(visibleSlide(page)).toHaveAttribute(
    "aria-label",
    `${number} of 3`,
  );
  await expect(page.locator(".public-carousel__slide--entering")).toHaveCount(
    0,
  );
};

async function open(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await page.clock.install();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await expect(
    page.getByRole("button", { name: "Next announcement", exact: true }),
  ).toBeVisible();
  return page;
}

async function check(name, run) {
  await run();
  results.push(name);
  console.log(`PASS ${name}`);
}

// Give real browser observers/React events time to settle, without advancing the
// virtual eight-second carousel timer. No API responses or application data mocked.
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
async function releaseCarousel(page) {
  await page.locator(".public-masthead__identity").focus();
  await page.mouse.move(0, 0);
  await settle();
}

try {
  await check(
    "Continuous horizontal motion, forward wrap and rapid navigation",
    async () => {
      const page = await open();

      async function inspectMotion(forward = true) {
        await expect(
          page.locator(".public-carousel__slide--entering"),
        ).toHaveCount(1);
        const samples = await page.evaluate(() => {
          const incoming = document.querySelector(
            ".public-carousel__slide--entering",
          );
          const outgoing = document.querySelector(
            ".public-carousel__slide--leaving",
          );
          const animations = [
            incoming.getAnimations()[0],
            outgoing.getAnimations()[0],
          ];
          if (animations.some((animation) => !animation))
            throw Error("Missing paired animations");
          const duration = Number(animations[0].effect.getTiming().duration);
          animations.forEach((animation) => animation.pause());
          return [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            animations.forEach((animation) => {
              animation.currentTime = duration * fraction;
            });
            const next = incoming.getBoundingClientRect();
            const old = outgoing.getBoundingClientRect();
            return {
              fraction,
              duration,
              incomingX: next.x,
              incomingRight: next.right,
              outgoingX: old.x,
              outgoingRight: old.right,
              width: next.width,
              opacity: getComputedStyle(incoming).opacity,
              outgoingInert: outgoing.inert,
              outgoingHiddenFromAT: outgoing.getAttribute("aria-hidden"),
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
        });
        assert.ok(samples[0].duration >= 600 && samples[0].duration <= 1200);
        assert.ok(
          Math.abs(samples[0].incomingX - (forward ? 1440 : -1440)) < 1,
        );
        assert.ok(Math.abs(samples.at(-1).incomingX) < 1);
        for (let index = 0; index < samples.length; index++) {
          const sample = samples[index];
          assert.equal(
            sample.opacity,
            "1",
            "The slide must move, not fade through an empty background",
          );
          assert.equal(sample.outgoingInert, true);
          assert.equal(sample.outgoingHiddenFromAT, "true");
          assert.equal(sample.overflow, 0);
          const seam = forward
            ? sample.outgoingRight - sample.incomingX
            : sample.incomingRight - sample.outgoingX;
          assert.ok(
            Math.abs(seam) < 1,
            "Incoming and outgoing panels must meet without a gap",
          );
          if (index > 0) {
            assert.ok(
              forward
                ? sample.incomingX < samples[index - 1].incomingX
                : sample.incomingX > samples[index - 1].incomingX,
            );
          }
        }
        await page.evaluate(() => {
          document
            .querySelectorAll(".public-carousel__slide")
            .forEach((slide) =>
              slide.getAnimations().forEach((animation) => animation.finish()),
            );
        });
        await page.clock.fastForward(1_100);
        await expect(
          page.locator(".public-carousel__slide--entering"),
        ).toHaveCount(0);
        await expect(
          page.locator(".public-carousel__slide:not([hidden])"),
        ).toHaveCount(1);
      }

      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await inspectMotion();
      await position(page, 2);
      await page.getByRole("button", { name: /^Show announcement 3:/ }).click();
      await position(page, 3);
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await inspectMotion();
      await position(page, 1);
      await page
        .getByRole("button", { name: "Previous announcement", exact: true })
        .click();
      await inspectMotion(false);
      await position(page, 3);
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await page.getByRole("button", { name: /^Show announcement 2:/ }).click();
      const lastChoice = page.getByRole("button", {
        name: /^Show announcement 3:/,
      });
      await lastChoice.click();
      await position(page, 3);
      await expect(lastChoice).toBeFocused();
      await expect(
        page.locator(".public-carousel__slide:not([hidden])"),
      ).toHaveCount(1);
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await expect(
        page.locator(".public-carousel__slide--entering"),
      ).toHaveCount(1);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.fastForward(100);
      await position(page, 1);
      assert.equal(
        await visibleSlide(page).evaluate(
          (slide) => getComputedStyle(slide).animationName,
        ),
        "none",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await settle();
      await page.evaluate(() => {
        document
          .querySelectorAll(".public-carousel__slide")
          .forEach((slide) =>
            slide.getAnimations().forEach((animation) => animation.cancel()),
          );
      });
      await page.clock.fastForward(1_100);
      await position(page, 2);
      await page.close();
    },
  );

  await check(
    "Home hierarchy, complete catalog, truthful destinations and removed CTAs",
    async () => {
      const page = await open({ reducedMotion: "reduce" });
      assert.deepEqual(
        await page
          .locator("main > section")
          .evaluateAll((items) => items.map((item) => item.id)),
        ["home", "news", "about", "programs", "graduate-research", "contact"],
      );
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("body")).not.toContainText("Design preview —");
      await expect(page.locator("main")).not.toContainText(
        "Sample content — design review only",
      );
      await expect(page.locator("main")).not.toContainText(
        "Design placeholder image",
      );
      await expect(page.locator(".public-carousel__position")).toHaveCount(0);
      assert.ok(
        (
          await page.locator(".public-carousel__playback").allTextContents()
        ).every((text) => text.trim() === ""),
        "Playback control must have no visible Play/Pause text",
      );
      const hero = await page.locator(".public-carousel").boundingBox();
      assert.equal(hero.x, 0, "Hero must start at the viewport edge");
      assert.equal(hero.width, 1440, "Hero must span the full viewport");
      assert.ok(
        hero.height >= 640,
        "Hero must be the dominant opening feature",
      );
      await expect(page.locator(".public-opening__sidebar")).toHaveCount(0);
      await expect(
        visibleSlide(page).locator(".public-carousel__action"),
      ).toHaveCount(2);
      await expect(page.locator("main details")).toHaveCount(0);
      await expect(
        page.locator('#about a[href="/about"], #programs a[href="/programs"]'),
      ).toHaveCount(0);
      await expect(page.locator(".public-programs__list > li")).toHaveCount(11);
      await expect(page.locator(".public-programs__majors li")).toHaveCount(9);
      await expect(
        page.getByRole("link", { name: "Entrance Examination", exact: true }),
      ).toHaveAttribute("href", "/login");
      await expect(page.locator("#applicant-access")).toHaveCount(0);
      await expect(
        page.locator(
          'footer a[href="/#getting-started"], footer a[href="/faq"]',
        ),
      ).toHaveCount(0);
      await expect(page.locator("#news h2")).toHaveText(
        "Graduate School updates and advisories",
      );
      await expect(page.locator(".public-news__card")).toHaveCount(3);
      await expect(page.locator(".public-news__photo-count")).toContainText(
        "4 Photos",
      );
      await expect(page.locator(".public-about__goal-item")).toHaveCount(3);
      await page.locator(".public-news__read-btn").first().click();
      await expect(page.locator(".public-news__lightbox")).toBeVisible();
      await expect(page.locator(".public-news__modal-thumb")).toHaveCount(4);
      await page
        .getByRole("button", { name: "Next photo", exact: true })
        .click();
      await expect(
        page.locator(".public-news__modal-thumb").nth(1),
      ).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Escape");
      await expect(page.locator(".public-news__lightbox")).toHaveCount(0);
      await page.close();
    },
  );

  await check(
    "Automatic rotation, interaction suspension, manual-navigation resume and keyboard pause",
    async () => {
      const page = await open();
      await expect(page.locator(".public-carousel__playback")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Pause slideshow", exact: true }),
      ).toHaveCount(1);
      await settle();
      await page.clock.fastForward(8_100);
      await position(page, 2);
      await expect(page.locator('.public-carousel [role="status"]')).toHaveText(
        "",
      );
      // Merely resting over the image/text must not stall automatic playback.
      await page
        .locator(".public-carousel")
        .hover({ position: { x: 100, y: 100 } });
      await page.clock.fastForward(8_100);
      await position(page, 3);
      await visibleSlide(page)
        .locator(".public-carousel__action")
        .first()
        .hover();
      await settle();
      await page.clock.fastForward(16_100);
      await position(page, 3);
      await releaseCarousel(page);
      await page.clock.fastForward(8_100);
      await position(page, 1);
      await page
        .getByRole("button", { name: "Previous announcement", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Next announcement", exact: true }),
      ).toBeFocused();
      await page.clock.fastForward(16_100);
      await position(page, 1);
      await page.keyboard.press("Enter");
      await position(page, 2);
      await releaseCarousel(page);
      await page.clock.fastForward(8_100);
      await position(page, 3);
      // No on-screen Play button is required; keyboard users retain pause/resume.
      await page
        .getByRole("button", { name: "Pause slideshow", exact: true })
        .focus();
      await page.keyboard.press("Space");
      await releaseCarousel(page);
      await page.clock.fastForward(16_100);
      await position(page, 3);
      await page
        .getByRole("button", { name: "Resume slideshow", exact: true })
        .focus();
      await page.keyboard.press("Space");
      await releaseCarousel(page);
      await page.clock.fastForward(8_100);
      await position(page, 1);
      await page.close();
    },
  );

  await check("Offscreen and document-visibility suspension", async () => {
    const page = await open();
    await settle();
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await settle();
    await page.clock.fastForward(16_100);
    await position(page, 1);
    await page.locator("#landing-title").scrollIntoViewIfNeeded();
    await releaseCarousel(page);
    await settle();
    await page.clock.fastForward(8_100);
    await position(page, 2);
    // Explicit browser-event simulation; separate from actual offscreen scrolling.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();
    await page.clock.fastForward(16_100);
    await position(page, 2);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();
    await page.clock.fastForward(8_100);
    await position(page, 3);
    await page.close();
  });

  await check(
    "Mobile autoplay, wraparound, headline selection and image availability",
    async () => {
      const page = await open({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await expect(page.locator(".public-carousel__playback")).toHaveCount(0);
      await settle();
      await page.clock.fastForward(8_100);
      await position(page, 2);
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .tap();
      await position(page, 3);
      await settle();
      await page.clock.fastForward(8_100);
      await position(page, 1);
      await page.getByRole("button", { name: /^Show announcement 1:/ }).click();
      await page
        .getByRole("button", { name: "Previous announcement", exact: true })
        .click();
      await position(page, 3);
      await releaseCarousel(page);
      await page.clock.fastForward(8_100);
      await position(page, 1);
      for (let index = 1; index <= 3; index++) {
        const choice = page.getByRole("button", {
          name: new RegExp(`^Show announcement ${index}:`),
        });
        await choice.focus();
        await page.keyboard.press("Enter");
        await position(page, index);
        await expect(choice).toBeFocused();
        await expect(choice).toHaveAttribute("aria-pressed", "true");
        await expect(
          page.locator(".public-carousel__slide[hidden]:visible"),
        ).toHaveCount(0);
        if (await visibleSlide(page).locator("img").count()) {
          await expect
            .poll(() =>
              visibleSlide(page)
                .locator("img")
                .evaluate((image) => image.complete && image.naturalWidth > 0),
            )
            .toBe(true);
        }
      }
      await page.close();
    },
  );

  await check(
    "Reduced motion suppresses autoplay/animation and retains manual controls",
    async () => {
      const page = await open({ reducedMotion: "reduce" });
      await expect(page.locator(".public-carousel__playback")).toHaveCount(0);
      await page.clock.fastForward(16_100);
      await position(page, 1);
      await page
        .getByRole("button", { name: "Next announcement", exact: true })
        .click();
      await position(page, 2);
      assert.equal(
        await visibleSlide(page).evaluate(
          (slide) => getComputedStyle(slide).animationName,
        ),
        "none",
      );
      await page.close();
    },
  );

  await check("320px reflow and stable slide height", async () => {
    const page = await open({
      viewport: { width: 320, height: 740 },
      reducedMotion: "reduce",
    });
    const heights = [];
    for (let index = 1; index <= 3; index++) {
      await page
        .getByRole("button", {
          name: new RegExp(`^Show announcement ${index}:`),
        })
        .click();
      heights.push(
        await page
          .locator(".public-carousel")
          .evaluate((item) => item.getBoundingClientRect().height),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        0,
      );
    }
    assert.ok(
      Math.max(...heights) - Math.min(...heights) < 1,
      `Slide height changed: ${heights}`,
    );
    const prev = await page
      .getByRole("button", { name: "Previous announcement", exact: true })
      .boundingBox();
    const next = await page
      .getByRole("button", { name: "Next announcement", exact: true })
      .boundingBox();
    assert.ok(
      Math.abs(prev.y - next.y) < 1,
      "Mobile previous and next arrows must align on the same horizontal row",
    );
    assert.ok(
      Math.abs(prev.x - (320 - (next.x + next.width))) < 2,
      "Mobile previous and next arrows must be symmetrically positioned",
    );
    await page.close();
  });

  await check(
    "Shared shell routes and cross-route mobile anchors / Escape focus return",
    async () => {
      const page = await open({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const expected = [
        "Home",
        "News",
        "About",
        "Programs",
        "Research",
        "Contact",
      ];
      for (const route of ["/about", "/programs", "/repository", "/faq"]) {
        const response = await page.goto(baseURL + route, {
          waitUntil: "networkidle",
        });
        assert.equal(response.status(), 200);
        await expect(page.locator("main h1")).toHaveCount(1);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
          0,
        );
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
        const menu = page.getByRole("navigation", {
          name: "Mobile navigation",
          exact: true,
        });
        assert.deepEqual(
          await menu
            .locator("a")
            .evaluateAll((items) =>
              items.slice(0, 6).map((item) => item.textContent.trim()),
            ),
          expected,
        );
        await menu.getByRole("link", { name: "News", exact: true }).focus();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: "Open menu", exact: true }),
        ).toBeFocused();
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
        await menu.getByRole("link", { name: "Contact", exact: true }).click();
        await page.waitForURL(`${baseURL}/#contact`);
        await expect(menu).toBeHidden();
        await expect
          .poll(() =>
            page
              .locator("#contact")
              .evaluate((item) => item.getBoundingClientRect().top),
          )
          .toBeGreaterThan(75);
        assert.ok(
          await page
            .locator("#contact")
            .evaluate((item) => item.getBoundingClientRect().top < innerHeight),
        );
      }
      await page.close();
    },
  );

  assert.deepEqual(errors, [], "Uncaught browser errors");
  assert.deepEqual(mutations, [], "Unexpected data-mutating requests");
  console.log(
    JSON.stringify(
      {
        passed: results.length,
        results,
        uncaughtErrors: errors,
        mutatingRequests: mutations,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
